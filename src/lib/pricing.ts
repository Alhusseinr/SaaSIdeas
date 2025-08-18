import { supabase } from './supabase'
import type { 
  SubscriptionPlan, 
  UserSubscription, 
  UserUsage, 
  BillingHistory, 
  UsageSummary,
  UpgradeDowngradeRequest,
  UsageType 
} from '@/types/pricing'

export class PricingService {
  // Create a paid subscription for a user after payment
  static async createPaidSubscription(
    userId: string, 
    planName: string = 'pro',
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<UserSubscription | null> {
    try {
      // Get the plan by name
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('name', planName)
        .eq('is_active', true)
        .single()

      if (planError || !plan) {
        console.error('Error fetching plan:', planError)
        throw new Error(`Plan "${planName}" not found`)
      }

      // Create paid subscription (starts immediately, no trial)
      const subscriptionStart = new Date()
      const subscriptionEnd = new Date()
      
      if (billingCycle === 'yearly') {
        subscriptionEnd.setFullYear(subscriptionStart.getFullYear() + 1)
      } else {
        subscriptionEnd.setMonth(subscriptionStart.getMonth() + 1)
      }

      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: plan.id,
          status: 'active',
          billing_cycle: billingCycle,
          current_period_start: subscriptionStart.toISOString(),
          current_period_end: subscriptionEnd.toISOString(),
          cancel_at_period_end: false,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId
        })
        .select()
        .single()

      if (subError) {
        console.error('Error creating paid subscription:', subError)
        throw subError
      }

      return subscription
    } catch (error) {
      console.error('Failed to create paid subscription:', error)
      return null
    }
  }

  // Get all available subscription plans
  static async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true })

    if (error) {
      console.error('Error fetching subscription plans:', error)
      throw error
    }

    return data || []
  }

  // Get user's current subscription
  static async getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    const { data, error } = await supabase
      .from('user_current_subscription')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null
      }
      console.error('Error fetching current subscription:', error)
      throw error
    }

    return data
  }

  // Get user's current month usage
  static async getCurrentMonthUsage(userId: string): Promise<UsageSummary[]> {
    const { data, error } = await supabase
      .from('user_current_month_usage')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching current usage:', error)
      throw error
    }

    return data || []
  }

  // Check if user can validate an idea
  static async canUserValidateIdea(userId: string): Promise<boolean> {
    try {
      // Use the reliable fallback logic as the primary method
      // The database function has persistent RLS/permission issues
      return await this.canUserValidateIdeaFallback(userId)
    } catch (error) {
      console.error('Error in canUserValidateIdea:', error)
      return false
    }
  }

  // Reliable validation check that bypasses problematic database function
  static async canUserValidateIdeaFallback(userId: string): Promise<boolean> {
    try {
      console.log('🔍 Checking validation permissions for user:', userId)
      
      // Get current subscription
      const subscription = await this.getCurrentSubscription(userId)
      if (!subscription) {
        console.log('❌ No active subscription found')
        return false
      }

      console.log(`✅ Found subscription: ${subscription.plan_display_name}`)
      console.log(`   Validations per month: ${subscription.validations_per_month}`)

      // If unlimited validations, return true
      if (subscription.validations_per_month === -1) {
        console.log('✅ Unlimited validations - access granted')
        return true
      }

      // Get current usage
      const usage = await this.getCurrentMonthUsage(userId)
      const validationUsage = usage.find(u => u.usage_type === 'idea_validation')?.total_usage || 0

      console.log(`   Current usage: ${validationUsage}/${subscription.validations_per_month}`)

      // Return true if under limit
      const canValidate = validationUsage < subscription.validations_per_month
      console.log(`   Can validate: ${canValidate}`)
      
      return canValidate
    } catch (error) {
      console.error('Error in validation check:', error)
      return false
    }
  }

  // Record usage for a user
  static async recordUsage(
    userId: string, 
    usageType: UsageType, 
    count: number = 1, 
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('record_user_usage', {
      user_uuid: userId,
      usage_type_param: usageType,
      usage_count_param: count,
      metadata_param: metadata
    })

    if (error) {
      console.error('Error recording usage:', error)
      throw error
    }

    return data || false
  }

  // Get user's billing history
  static async getBillingHistory(userId: string): Promise<BillingHistory[]> {
    const { data, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching billing history:', error)
      throw error
    }

    return data || []
  }

  // Create a new subscription (this would typically integrate with Stripe)
  static async createSubscription(
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<UserSubscription> {
    const now = new Date()
    const periodEnd = new Date(now)
    
    // Add period based on billing cycle
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
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
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating subscription:', error)
      throw error
    }

    return data
  }

  // Cancel subscription
  static async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<UserSubscription> {
    const updates: Partial<UserSubscription> = {
      cancel_at_period_end: cancelAtPeriodEnd
    }

    if (!cancelAtPeriodEnd) {
      updates.status = 'canceled'
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select()
      .single()

    if (error) {
      console.error('Error canceling subscription:', error)
      throw error
    }

    return data
  }

  // Upgrade/downgrade subscription
  static async changeSubscription(
    userId: string,
    request: UpgradeDowngradeRequest
  ): Promise<UserSubscription> {
    // Get current subscription
    const currentSub = await this.getCurrentSubscription(userId)
    if (!currentSub) {
      throw new Error('No active subscription found')
    }

    // Cancel current subscription
    await this.cancelSubscription(currentSub.id, !request.immediate)

    // Create new subscription
    return this.createSubscription(
      userId,
      request.new_plan_id,
      request.billing_cycle,
      currentSub.stripe_customer_id || undefined,
      undefined // New Stripe subscription would be created
    )
  }

  // Get usage statistics for analytics
  static async getUsageAnalytics(userId: string, days: number = 30): Promise<{
    daily_usage: Array<{ date: string; count: number }>
    total_usage: number
    average_daily: number
  }> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('user_usage')
      .select('usage_date, usage_count')
      .eq('user_id', userId)
      .eq('usage_type', 'idea_validation')
      .gte('usage_date', startDate.toISOString().split('T')[0])
      .lte('usage_date', endDate.toISOString().split('T')[0])
      .order('usage_date', { ascending: true })

    if (error) {
      console.error('Error fetching usage analytics:', error)
      throw error
    }

    const daily_usage = (data || []).map(item => ({
      date: item.usage_date,
      count: item.usage_count
    }))

    const total_usage = daily_usage.reduce((sum, day) => sum + day.count, 0)
    const average_daily = daily_usage.length > 0 ? total_usage / daily_usage.length : 0

    return {
      daily_usage,
      total_usage,
      average_daily: Math.round(average_daily * 100) / 100
    }
  }

  // Helper method to get plan by name
  static async getPlanByName(planName: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', planName)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching plan by name:', error)
      throw error
    }

    return data
  }

  // Create a free trial subscription
  static async createTrialSubscription(
    userId: string,
    planName: string = 'pro',
    trialDays: number = 7
  ): Promise<UserSubscription> {
    const plan = await this.getPlanByName(planName)
    if (!plan) {
      throw new Error(`Plan ${planName} not found`)
    }

    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + trialDays)

    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
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
      console.error('Error creating trial subscription:', error)
      throw error
    }

    return data
  }
}

// Convenience functions for use in components
export const {
  getSubscriptionPlans,
  getCurrentSubscription,
  getCurrentMonthUsage,
  canUserValidateIdea,
  recordUsage,
  getBillingHistory,
  createSubscription,
  cancelSubscription,
  changeSubscription,
  getUsageAnalytics,
  getPlanByName,
  createTrialSubscription
} = PricingService