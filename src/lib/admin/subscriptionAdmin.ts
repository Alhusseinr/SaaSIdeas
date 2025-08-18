/**
 * Administrative functions for managing user subscriptions
 * This should only be used with service role permissions
 */

import { createClient } from '@supabase/supabase-js'
import type { UserSubscription, SubscriptionPlan } from '@/types/pricing'

// Initialize Supabase with service role key for admin operations
const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing required environment variables for admin operations')
  }
  
  return createClient(supabaseUrl, serviceKey)
}

export interface SubscriptionUpdateParams {
  userEmail: string
  newPlanName: 'starter' | 'pro' | 'enterprise'
  billingCycle?: 'monthly' | 'yearly'
  immediate?: boolean
  reason?: string
}

export interface SubscriptionUpdateResult {
  success: boolean
  message: string
  oldSubscription?: UserSubscription
  newSubscription?: UserSubscription
  warnings?: string[]
}

export class SubscriptionAdminService {
  private supabase = getAdminClient()

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    const { data, error } = await this.supabase.auth.admin.listUsers()
    
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
  async getPlanByName(planName: string): Promise<SubscriptionPlan> {
    const { data, error } = await this.supabase
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
  async getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    const { data, error } = await this.supabase
      .from('user_current_subscription')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch current subscription: ${error.message}`)
    }
    
    return data
  }

  /**
   * Get user's current usage for validation checks
   */
  async getCurrentUsage(userId: string) {
    const { data, error } = await this.supabase
      .from('user_current_month_usage')
      .select('*')
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`Failed to fetch current usage: ${error.message}`)
    }
    
    return data
  }

  /**
   * Cancel current subscription
   */
  async cancelSubscription(subscriptionId: string, immediate = false) {
    const updates: any = {
      cancel_at_period_end: !immediate,
      updated_at: new Date().toISOString()
    }
    
    if (immediate) {
      updates.status = 'canceled'
    }
    
    const { error } = await this.supabase
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
  async createSubscription(
    userId: string, 
    planId: string, 
    billingCycle: 'monthly' | 'yearly',
    stripeCustomerId?: string
  ): Promise<UserSubscription> {
    const now = new Date()
    const periodEnd = new Date(now)
    
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }
    
    const { data, error } = await this.supabase
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
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to create subscription: ${error.message}`)
    }
    
    return data
  }

  /**
   * Update user subscription tier
   */
  async updateSubscriptionTier(params: SubscriptionUpdateParams): Promise<SubscriptionUpdateResult> {
    const { userEmail, newPlanName, billingCycle = 'monthly', immediate = false, reason } = params
    const warnings: string[] = []
    
    try {
      // 1. Find user
      const user = await this.findUserByEmail(userEmail)
      
      // 2. Get target plan
      const newPlan = await this.getPlanByName(newPlanName)
      
      // 3. Get current subscription
      const currentSub = await this.getCurrentSubscription(user.id)
      
      // 4. Handle case where user has no subscription
      if (!currentSub) {
        const newSub = await this.createSubscription(user.id, newPlan.id, billingCycle)
        return {
          success: true,
          message: `Created new ${newPlan.display_name} subscription for ${userEmail}`,
          newSubscription: newSub
        }
      }
      
      // 5. Check if same plan
      if (currentSub.plan_name === newPlanName && currentSub.billing_cycle === billingCycle) {
        return {
          success: true,
          message: `User ${userEmail} is already on the ${newPlan.display_name} plan with ${billingCycle} billing`,
          oldSubscription: currentSub
        }
      }
      
      // 6. Check usage vs new plan limits
      const usage = await this.getCurrentUsage(user.id)
      const validationUsage = usage.find(u => u.usage_type === 'idea_validation')?.total_usage || 0
      
      if (newPlan.validations_per_month !== -1 && validationUsage > newPlan.validations_per_month) {
        warnings.push(
          `User has used ${validationUsage} validations this month, but new plan only allows ${newPlan.validations_per_month}. ` +
          `Consider waiting until next billing period.`
        )
      }
      
      // 7. Cancel current subscription
      await this.cancelSubscription(currentSub.id, immediate)
      
      // 8. Create new subscription
      const newSub = await this.createSubscription(
        user.id,
        newPlan.id,
        billingCycle,
        currentSub.stripe_customer_id || undefined
      )
      
      // 9. Log the change (you might want to create an audit log table)
      console.log(`Subscription updated: ${userEmail} from ${currentSub.plan_display_name} to ${newPlan.display_name}. Reason: ${reason || 'Not specified'}`)
      
      return {
        success: true,
        message: `Successfully updated ${userEmail} from ${currentSub.plan_display_name} to ${newPlan.display_name}`,
        oldSubscription: currentSub,
        newSubscription: newSub,
        warnings: warnings.length > 0 ? warnings : undefined
      }
      
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update subscription: ${error.message}`
      }
    }
  }

  /**
   * Bulk update subscriptions
   */
  async bulkUpdateSubscriptions(updates: SubscriptionUpdateParams[]): Promise<SubscriptionUpdateResult[]> {
    const results: SubscriptionUpdateResult[] = []
    
    for (const update of updates) {
      try {
        const result = await this.updateSubscriptionTier(update)
        results.push(result)
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error: any) {
        results.push({
          success: false,
          message: `Failed to update ${update.userEmail}: ${error.message}`
        })
      }
    }
    
    return results
  }

  /**
   * Get all users with subscriptions for admin overview
   */
  async getAllSubscriptions() {
    const { data, error } = await this.supabase
      .from('user_current_subscription')
      .select('*')
      .order('plan_display_name')
    
    if (error) {
      throw new Error(`Failed to fetch subscriptions: ${error.message}`)
    }
    
    // Get user emails
    const { data: users } = await this.supabase.auth.admin.listUsers()
    const userMap = new Map(users.users.map((u: any) => [u.id, u.email]))
    
    return data.map(sub => ({
      ...sub,
      email: userMap.get(sub.user_id) || 'Unknown'
    }))
  }

  /**
   * Grant free trial to user
   */
  async grantFreeTrial(userEmail: string, planName: string = 'pro', trialDays: number = 7): Promise<SubscriptionUpdateResult> {
    try {
      const user = await this.findUserByEmail(userEmail)
      const plan = await this.getPlanByName(planName)
      
      // Check if user already has a subscription
      const currentSub = await this.getCurrentSubscription(user.id)
      if (currentSub) {
        return {
          success: false,
          message: `User ${userEmail} already has an active subscription`
        }
      }
      
      const now = new Date()
      const trialEnd = new Date(now)
      trialEnd.setDate(trialEnd.getDate() + trialDays)
      
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'trialing',
          billing_cycle: 'monthly',
          current_period_start: now.toISOString(),
          current_period_end: trialEnd.toISOString(),
          cancel_at_period_end: false
        })
        .select()
        .single()
      
      if (error) {
        throw new Error(`Failed to create trial: ${error.message}`)
      }
      
      return {
        success: true,
        message: `Granted ${trialDays}-day trial of ${plan.display_name} to ${userEmail}`,
        newSubscription: data
      }
      
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to grant trial: ${error.message}`
      }
    }
  }
}

// Export singleton instance
export const subscriptionAdmin = new SubscriptionAdminService()