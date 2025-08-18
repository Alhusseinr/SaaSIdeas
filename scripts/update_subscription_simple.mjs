#!/usr/bin/env node

/**
 * Simple subscription update script using ES modules
 * 
 * Usage:
 * node scripts/update_subscription_simple.mjs user@example.com pro monthly
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
async function loadEnvVars() {
  try {
    const envPath = join(__dirname, '..', '.env.local')
    const envContent = await readFile(envPath, 'utf8')
    
    const envVars = {}
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        envVars[key.trim()] = value.trim()
      }
    })
    
    return envVars
  } catch (error) {
    console.error('Could not load .env.local file:', error.message)
    return {}
  }
}

// Get environment variables
const envVars = await loadEnvVars()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables in .env.local:')
  if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateUserSubscription(userEmail, newPlanName, billingCycle = 'monthly') {
  try {
    console.log(`🚀 Updating subscription for ${userEmail} to ${newPlanName} (${billingCycle})`)
    
    // 1. Find user by email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) throw new Error(`Failed to fetch users: ${userError.message}`)
    
    const user = userData.users.find(u => u.email === userEmail)
    if (!user) throw new Error(`User with email "${userEmail}" not found`)
    
    console.log(`✅ Found user: ${user.id}`)
    
    // 2. Get target plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', newPlanName)
      .eq('is_active', true)
      .single()
    
    if (planError || !plan) throw new Error(`Plan "${newPlanName}" not found`)
    console.log(`✅ Found plan: ${plan.display_name} - $${plan.price_monthly / 100}/month`)
    
    // 3. Get current subscription
    const { data: currentSub, error: subError } = await supabase
      .from('user_current_subscription')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (subError && subError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch current subscription: ${subError.message}`)
    }
    
    if (currentSub) {
      console.log(`📋 Current plan: ${currentSub.plan_display_name}`)
      
      // Cancel current subscription
      const { error: cancelError } = await supabase
        .from('user_subscriptions')
        .update({ 
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSub.id)
      
      if (cancelError) throw new Error(`Failed to cancel current subscription: ${cancelError.message}`)
      console.log('✅ Canceled current subscription')
    }
    
    // 4. Create new subscription
    const now = new Date()
    const periodEnd = new Date(now)
    
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }
    
    const { data: newSub, error: newSubError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        billing_cycle: billingCycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        stripe_customer_id: currentSub?.stripe_customer_id
      })
      .select()
      .single()
    
    if (newSubError) throw new Error(`Failed to create new subscription: ${newSubError.message}`)
    
    console.log('✅ Created new subscription successfully!')
    console.log(`📊 Plan: ${plan.display_name}`)
    console.log(`💰 Price: $${plan[`price_${billingCycle}`] / 100}/${billingCycle === 'yearly' ? 'year' : 'month'}`)
    console.log(`📅 Period: ${newSub.current_period_start} to ${newSub.current_period_end}`)
    
    return newSub
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length < 2) {
  console.log(`
🎯 Simple Subscription Update Script

Usage:
  node scripts/update_subscription_simple.mjs <user_email> <plan_name> [billing_cycle]

Examples:
  node scripts/update_subscription_simple.mjs user@example.com pro monthly
  node scripts/update_subscription_simple.mjs user@example.com enterprise yearly
  
Available plans: starter, pro, enterprise
Available billing cycles: monthly, yearly
`)
  process.exit(1)
}

const userEmail = args[0]
const planName = args[1]
const billingCycle = args[2] || 'monthly'

await updateUserSubscription(userEmail, planName, billingCycle)