// Pricing System Types

export interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  description: string
  price_monthly: number // in cents
  price_yearly?: number // in cents
  validations_per_month: number // -1 for unlimited
  features: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  billing_cycle: 'monthly' | 'yearly'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  stripe_subscription_id?: string
  stripe_customer_id?: string
  created_at: string
  updated_at: string
  
  // Joined data from plan
  plan_name?: string
  plan_display_name?: string
  validations_per_month?: number
  features?: string[]
  price_monthly?: number
  price_yearly?: number
}

export interface UserUsage {
  id: string
  user_id: string
  subscription_id: string
  usage_type: string
  usage_count: number
  usage_date: string
  metadata: Record<string, any>
  created_at: string
}

export interface BillingHistory {
  id: string
  user_id: string
  subscription_id: string
  amount: number // in cents
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  stripe_invoice_id?: string
  stripe_payment_intent_id?: string
  billing_period_start?: string
  billing_period_end?: string
  created_at: string
  paid_at?: string
}

export interface UsageSummary {
  user_id: string
  subscription_id: string
  usage_type: string
  total_usage: number
  usage_month: string
}

export interface PricingContext {
  currentSubscription: UserSubscription | null
  currentUsage: UsageSummary[]
  availablePlans: SubscriptionPlan[]
  canValidateIdea: boolean
  isLoading: boolean
  error: string | null
}

export interface UpgradeDowngradeRequest {
  new_plan_id: string
  billing_cycle: 'monthly' | 'yearly'
  immediate?: boolean
}

// Utility types
export type PlanName = 'starter' | 'pro' | 'enterprise'
export type UsageType = 'idea_validation' | 'api_call' | 'export' | 'team_member'

// Plan configuration matching the database
export const PLAN_CONFIGS: Record<PlanName, Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>> = {
  starter: {
    name: 'starter',
    display_name: 'Starter',
    description: 'Perfect for individual entrepreneurs and side projects',
    price_monthly: 4900, // $49
    price_yearly: 49000, // $490 (2 months free)
    validations_per_month: 25,
    features: [
      'AI-powered market analysis',
      'Reddit data integration',
      'Email support',
      'Implementation prompts',
      'Basic competitive analysis',
      'Export to CSV'
    ],
    is_active: true
  },
  pro: {
    name: 'pro',
    display_name: 'Pro',
    description: 'Ideal for serious builders and small teams',
    price_monthly: 9900, // $99
    price_yearly: 99000, // $990 (2 months free)
    validations_per_month: 100,
    features: [
      'Advanced AI analysis with GPT-4',
      'Reddit + Twitter integration',
      'Priority support & live chat',
      'Custom implementation plans',
      'Advanced competitive intelligence',
      'Revenue modeling & pricing analysis',
      'API access',
      'Advanced export capabilities',
      'Team collaboration (up to 3 users)'
    ],
    is_active: true
  },
  enterprise: {
    name: 'enterprise',
    display_name: 'Enterprise',
    description: 'For agencies, VCs, and large teams',
    price_monthly: 19900, // $199
    price_yearly: 199000, // $1990 (2 months free)
    validations_per_month: -1, // unlimited
    features: [
      'Unlimited idea validations',
      'Multi-platform data integration',
      'White-label options',
      'Dedicated account manager',
      'Custom AI training',
      'Advanced analytics dashboard',
      'Team collaboration (unlimited users)',
      'Priority feature requests',
      'Custom integrations',
      'SLA guarantee',
      'On-premise deployment option'
    ],
    is_active: true
  }
}

// Helper functions
export const formatPrice = (priceInCents: number): string => {
  return `$${(priceInCents / 100).toFixed(0)}`
}

export const formatPriceWithCents = (priceInCents: number): string => {
  return `$${(priceInCents / 100).toFixed(2)}`
}

export const getYearlySavings = (monthlyPrice: number, yearlyPrice: number): number => {
  const yearlyEquivalent = monthlyPrice * 12
  return yearlyEquivalent - yearlyPrice
}

export const getYearlySavingsPercentage = (monthlyPrice: number, yearlyPrice: number): number => {
  const savings = getYearlySavings(monthlyPrice, yearlyPrice)
  const yearlyEquivalent = monthlyPrice * 12
  return Math.round((savings / yearlyEquivalent) * 100)
}

export const isUnlimitedPlan = (validationsPerMonth: number): boolean => {
  return validationsPerMonth === -1
}

export const getRemainingValidations = (limit: number, used: number): number => {
  if (isUnlimitedPlan(limit)) return -1
  return Math.max(0, limit - used)
}

export const getUsagePercentage = (used: number, limit: number): number => {
  if (isUnlimitedPlan(limit)) return 0
  return Math.min(100, (used / limit) * 100)
}