#!/usr/bin/env node

/**
 * Script to update a user's subscription tier
 * 
 * Usage:
 * node scripts/update_user_subscription_tier.js <user_email> <new_plan_name> [billing_cycle] [--immediate]
 * 
 * Examples:
 * node scripts/update_user_subscription_tier.js user@example.com pro monthly
 * node scripts/update_user_subscription_tier.js user@example.com enterprise yearly --immediate
 * node scripts/update_user_subscription_tier.js user@example.com starter monthly
 */

const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env.local if dotenv is available
try {
  require('dotenv').config({ path: '.env.local' })
} catch (e) {
  // dotenv not available, try to load from process.env
  console.log('dotenv not found, using environment variables directly')
}

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_ROLE_KEY')
  console.error('')
  console.error('💡 Please ensure these are set in your .env.local file:')
  console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url')
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  console.error('')
  console.error('📍 You can find these values in your Supabase dashboard:')
  console.error('   Settings > API > Project URL & Service Role Key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Available plans
const VALID_PLANS = ['starter', 'pro', 'enterprise']
const VALID_BILLING_CYCLES = ['monthly', 'yearly']

class SubscriptionUpdater {
  
  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    const { data, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }
    
    const user = data.users.find(u => u.email === email)
    if (!user) {
      throw new Error(`User with email "${email}" not found`)
    }
    
    return user
  }
  
  /**
   * Get plan by name
   */
  async getPlanByName(planName) {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', planName)
      .eq('is_active', true)
      .single()
    
    if (error) {
      throw new Error(`Failed to fetch plan "${planName}": ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get user's current subscription
   */
  async getCurrentSubscription(userId) {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          display_name,
          price_monthly,
          price_yearly,
          validations_per_month
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()
    
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch current subscription: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Cancel current subscription
   */
  async cancelCurrentSubscription(subscriptionId, immediate = false) {
    const updates = {
      cancel_at_period_end: !immediate,
      updated_at: new Date().toISOString()
    }
    
    if (immediate) {
      updates.status = 'canceled'
    }
    
    const { error } = await supabase
      .from('user_subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
    
    if (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`)
    }
  }
  
  /**
   * Create new subscription
   */
  async createNewSubscription(userId, planId, billingCycle, stripeCustomerId = null) {
    const now = new Date()
    const periodEnd = new Date(now)
    
    // Calculate period end based on billing cycle
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        billing_cycle: billingCycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        stripe_customer_id: stripeCustomerId
      })
      .select(`
        *,
        subscription_plans (
          name,
          display_name,
          price_monthly,
          price_yearly,
          validations_per_month
        )
      `)
      .single()
    
    if (error) {
      throw new Error(`Failed to create new subscription: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get user's current usage for this month
   */
  async getCurrentUsage(userId) {
    const { data, error } = await supabase
      .from('user_current_month_usage')
      .select('*')
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`Failed to fetch current usage: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Main function to update subscription
   */
  async updateSubscription(userEmail, newPlanName, billingCycle = 'monthly', immediate = false) {
    console.log(`🚀 Starting subscription update for ${userEmail}`)
    console.log(`📋 Target plan: ${newPlanName} (${billingCycle})`)
    console.log(`⚡ Immediate change: ${immediate ? 'Yes' : 'No (at period end)'}`)
    console.log('')
    
    try {
      // 1. Validate inputs
      if (!VALID_PLANS.includes(newPlanName)) {
        throw new Error(`Invalid plan name. Valid options: ${VALID_PLANS.join(', ')}`)
      }
      
      if (!VALID_BILLING_CYCLES.includes(billingCycle)) {
        throw new Error(`Invalid billing cycle. Valid options: ${VALID_BILLING_CYCLES.join(', ')}`)
      }
      
      // 2. Find user
      console.log('👤 Finding user...')
      const user = await this.findUserByEmail(userEmail)
      console.log(`✅ Found user: ${user.email} (ID: ${user.id})`)
      
      // 3. Get target plan
      console.log('📦 Fetching target plan...')
      const newPlan = await this.getPlanByName(newPlanName)
      console.log(`✅ Found plan: ${newPlan.display_name} - $${newPlan.price_monthly / 100}/month`)
      
      // 4. Get current subscription
      console.log('🔍 Checking current subscription...')
      const currentSub = await this.getCurrentSubscription(user.id)
      
      if (!currentSub) {
        console.log('⚠️  No active subscription found, creating new subscription...')
        
        // Create new subscription
        const newSub = await this.createNewSubscription(user.id, newPlan.id, billingCycle)
        console.log('✅ New subscription created successfully!')
        console.log(`📊 Plan: ${newSub.subscription_plans.display_name}`)
        console.log(`💰 Price: $${newSub.subscription_plans.price_monthly / 100}/month`)
        console.log(`📅 Period: ${newSub.current_period_start} to ${newSub.current_period_end}`)
        return newSub
      }
      
      // 5. Check if it's the same plan
      if (currentSub.subscription_plans.name === newPlanName) {
        console.log(`⚠️  User is already on the ${newPlanName} plan`)
        
        // Check if billing cycle is different
        if (currentSub.billing_cycle !== billingCycle) {
          console.log(`🔄 Updating billing cycle from ${currentSub.billing_cycle} to ${billingCycle}`)
          // Cancel current and create new with different billing cycle
          await this.cancelCurrentSubscription(currentSub.id, immediate)
          const newSub = await this.createNewSubscription(user.id, newPlan.id, billingCycle, currentSub.stripe_customer_id)
          console.log('✅ Billing cycle updated successfully!')
          return newSub
        } else {
          console.log('ℹ️  No changes needed')
          return currentSub
        }
      }
      
      console.log(`📈 Current plan: ${currentSub.subscription_plans.display_name}`)
      console.log(`📈 Target plan: ${newPlan.display_name}`)
      
      // 6. Get current usage
      console.log('📊 Checking current usage...')
      const usage = await this.getCurrentUsage(user.id)
      const validationUsage = usage.find(u => u.usage_type === 'idea_validation')?.total_usage || 0
      console.log(`📊 Current month validations used: ${validationUsage}`)
      
      // 7. Check if downgrading and usage exceeds new limit
      const newLimit = newPlan.validations_per_month
      if (newLimit !== -1 && validationUsage > newLimit) {
        console.warn(`⚠️  WARNING: User has used ${validationUsage} validations this month, but the new plan only allows ${newLimit}`)
        console.warn('⚠️  Consider waiting until next billing period or choose a higher tier plan')
        
        if (!immediate) {
          console.log('ℹ️  Scheduling change for next billing period to avoid service disruption')
        }
      }
      
      // 8. Cancel current subscription
      console.log(`${immediate ? '⚡' : '📅'} ${immediate ? 'Immediately canceling' : 'Scheduling cancellation of'} current subscription...`)
      await this.cancelCurrentSubscription(currentSub.id, immediate)
      console.log('✅ Current subscription canceled')
      
      // 9. Create new subscription
      console.log('🆕 Creating new subscription...')
      const newSub = await this.createNewSubscription(user.id, newPlan.id, billingCycle, currentSub.stripe_customer_id)
      console.log('✅ New subscription created successfully!')
      
      // 10. Display summary
      console.log('')
      console.log('📋 SUBSCRIPTION UPDATE SUMMARY')
      console.log('=' .repeat(50))
      console.log(`👤 User: ${user.email}`)
      console.log(`📦 Old Plan: ${currentSub.subscription_plans.display_name} (${currentSub.billing_cycle})`)
      console.log(`📦 New Plan: ${newSub.subscription_plans.display_name} (${newSub.billing_cycle})`)
      console.log(`💰 New Price: $${newSub.subscription_plans[`price_${billingCycle}`] / 100}/${billingCycle === 'yearly' ? 'year' : 'month'}`)
      console.log(`🎯 Validations: ${newSub.subscription_plans.validations_per_month === -1 ? 'Unlimited' : newSub.subscription_plans.validations_per_month}/month`)
      console.log(`📅 Period: ${newSub.current_period_start} to ${newSub.current_period_end}`)
      console.log(`⚡ Change Type: ${immediate ? 'Immediate' : 'At period end'}`)
      console.log('')
      
      return newSub
      
    } catch (error) {
      console.error('❌ Error updating subscription:', error.message)
      throw error
    }
  }
  
  /**
   * List all users with their current subscriptions
   */
  async listUsersWithSubscriptions() {
    console.log('👥 Fetching all users with subscriptions...')
    
    const { data, error } = await supabase
      .from('user_current_subscription')
      .select(`
        user_id,
        plan_name,
        plan_display_name,
        billing_cycle,
        status,
        validations_per_month,
        current_period_start,
        current_period_end,
        price_monthly,
        price_yearly
      `)
      .order('plan_display_name')
    
    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }
    
    // Get user emails
    const { data: users } = await supabase.auth.admin.listUsers()
    const userMap = new Map(users.users.map(u => [u.id, u.email]))
    
    console.log('')
    console.log('📋 CURRENT SUBSCRIPTIONS')
    console.log('=' .repeat(80))
    
    for (const sub of data) {
      const email = userMap.get(sub.user_id) || 'Unknown'
      const price = sub.billing_cycle === 'yearly' ? sub.price_yearly : sub.price_monthly
      console.log(`👤 ${email}`)
      console.log(`   📦 Plan: ${sub.plan_display_name} (${sub.billing_cycle})`)
      console.log(`   💰 Price: $${price / 100}/${sub.billing_cycle === 'yearly' ? 'year' : 'month'}`)
      console.log(`   🎯 Validations: ${sub.validations_per_month === -1 ? 'Unlimited' : sub.validations_per_month}/month`)
      console.log(`   📅 Period: ${sub.current_period_start} to ${sub.current_period_end}`)
      console.log('')
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🎯 Subscription Tier Update Script

Usage:
  node scripts/update_user_subscription_tier.js <user_email> <new_plan> [billing_cycle] [--immediate]
  node scripts/update_user_subscription_tier.js --list

Commands:
  --list                    List all users with their current subscriptions

Arguments:
  user_email               Email address of the user
  new_plan                 Target plan (${VALID_PLANS.join(', ')})
  billing_cycle            Billing cycle (${VALID_BILLING_CYCLES.join(', ')}) [default: monthly]
  --immediate              Apply changes immediately vs at period end

Examples:
  # Upgrade user to Pro plan with monthly billing
  node scripts/update_user_subscription_tier.js user@example.com pro monthly
  
  # Upgrade to Enterprise with yearly billing, immediate change
  node scripts/update_user_subscription_tier.js user@example.com enterprise yearly --immediate
  
  # Downgrade to Starter (will warn about usage limits)
  node scripts/update_user_subscription_tier.js user@example.com starter
  
  # List all current subscriptions
  node scripts/update_user_subscription_tier.js --list
`)
    process.exit(0)
  }
  
  const updater = new SubscriptionUpdater()
  
  try {
    // Handle list command
    if (args[0] === '--list') {
      await updater.listUsersWithSubscriptions()
      return
    }
    
    // Handle subscription update
    const userEmail = args[0]
    const newPlan = args[1]
    const billingCycle = args[2] || 'monthly'
    const immediate = args.includes('--immediate')
    
    if (!userEmail || !newPlan) {
      console.error('❌ Missing required arguments: user_email and new_plan')
      console.error('Run with --help for usage information')
      process.exit(1)
    }
    
    await updater.updateSubscription(userEmail, newPlan, billingCycle, immediate)
    console.log('🎉 Subscription update completed successfully!')
    
  } catch (error) {
    console.error('💥 Script failed:', error.message)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { SubscriptionUpdater }