'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { PricingService } from '@/lib/pricing'
import type { PricingContext as PricingContextType, UserSubscription, SubscriptionPlan, UsageSummary } from '@/types/pricing'

const PricingContext = createContext<PricingContextType | undefined>(undefined)

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null)
  const [currentUsage, setCurrentUsage] = useState<UsageSummary[]>([])
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([])
  const [canValidateIdea, setCanValidateIdea] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load initial data
  useEffect(() => {
    if (user) {
      loadPricingData()
    } else {
      // Reset state when user logs out
      setCurrentSubscription(null)
      setCurrentUsage([])
      setCanValidateIdea(false)
      setIsLoading(false)
    }
  }, [user])

  const loadPricingData = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      // Load data in parallel
      const [subscription, usage, plans, canValidate] = await Promise.all([
        PricingService.getCurrentSubscription(user.id),
        PricingService.getCurrentMonthUsage(user.id),
        PricingService.getSubscriptionPlans(),
        PricingService.canUserValidateIdea(user.id)
      ])

      // For pay-first model, don't create automatic subscriptions
      // Users must complete payment before accessing dashboard
      setCurrentSubscription(subscription)
      setCanValidateIdea(canValidate)

      setCurrentUsage(usage)
      setAvailablePlans(plans)
    } catch (err: any) {
      console.error('Error loading pricing data:', err)
      setError(err.message || 'Failed to load pricing data')
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh pricing data
  const refreshPricingData = () => {
    if (user) {
      loadPricingData()
    }
  }

  // Record usage and update state
  const recordUsage = async (usageType: string, count: number = 1, metadata: Record<string, any> = {}) => {
    if (!user) return false

    try {
      const success = await PricingService.recordUsage(user.id, usageType as any, count, metadata)
      
      if (success) {
        // Refresh usage data and validation permissions
        const [newUsage, newCanValidate] = await Promise.all([
          PricingService.getCurrentMonthUsage(user.id),
          PricingService.canUserValidateIdea(user.id)
        ])
        
        setCurrentUsage(newUsage)
        setCanValidateIdea(newCanValidate)
      }
      
      return success
    } catch (err: any) {
      console.error('Error recording usage:', err)
      setError(err.message || 'Failed to record usage')
      return false
    }
  }

  // Get current plan
  const getCurrentPlan = () => {
    if (!currentSubscription) return null
    return availablePlans.find(plan => plan.id === currentSubscription.plan_id) || null
  }

  // Get usage for specific type
  const getUsageForType = (usageType: string) => {
    return currentUsage.find(usage => usage.usage_type === usageType)?.total_usage || 0
  }

  // Get remaining validations
  const getRemainingValidations = () => {
    const plan = getCurrentPlan()
    if (!plan) return 0
    
    if (plan.validations_per_month === -1) return -1 // unlimited
    
    const used = getUsageForType('idea_validation')
    return Math.max(0, plan.validations_per_month - used)
  }

  // Get usage percentage
  const getUsagePercentage = (usageType: string = 'idea_validation') => {
    const plan = getCurrentPlan()
    if (!plan || plan.validations_per_month === -1) return 0
    
    const used = getUsageForType(usageType)
    return Math.min(100, (used / plan.validations_per_month) * 100)
  }

  // Check if user is on trial
  const isOnTrial = () => {
    return currentSubscription?.status === 'trialing'
  }

  // Check if subscription is active
  const hasActiveSubscription = () => {
    return currentSubscription?.status === 'active' || isOnTrial()
  }

  // Get days remaining in trial
  const getTrialDaysRemaining = () => {
    if (!isOnTrial() || !currentSubscription) return 0
    
    const endDate = new Date(currentSubscription.current_period_end)
    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  }

  const contextValue: PricingContextType = {
    currentSubscription,
    currentUsage,
    availablePlans,
    canValidateIdea,
    isLoading,
    error
  }

  return (
    <PricingContext.Provider value={contextValue}>
      {children}
    </PricingContext.Provider>
  )
}

// Custom hook to use pricing context
export function usePricing() {
  const context = useContext(PricingContext)
  
  if (context === undefined) {
    throw new Error('usePricing must be used within a PricingProvider')
  }
  
  return context
}

// Extended hook with additional utilities
export function usePricingActions() {
  const pricing = usePricing()
  const { user } = useAuth()

  const refreshPricingData = async () => {
    if (!user) return

    try {
      const [subscription, usage, canValidate] = await Promise.all([
        PricingService.getCurrentSubscription(user.id),
        PricingService.getCurrentMonthUsage(user.id),
        PricingService.canUserValidateIdea(user.id)
      ])

      // This would need to be updated to use a reducer or state management
      // For now, we'll just return the data
      return { subscription, usage, canValidate }
    } catch (err: any) {
      console.error('Error refreshing pricing data:', err)
      throw err
    }
  }

  const recordUsage = async (usageType: string, count: number = 1, metadata: Record<string, any> = {}) => {
    if (!user) return false

    try {
      const success = await PricingService.recordUsage(user.id, usageType as any, count, metadata)
      
      if (success) {
        // Refresh data
        await refreshPricingData()
      }
      
      return success
    } catch (err: any) {
      console.error('Error recording usage:', err)
      throw err
    }
  }

  const getCurrentPlan = () => {
    if (!pricing.currentSubscription) return null
    return pricing.availablePlans.find(plan => plan.id === pricing.currentSubscription?.plan_id) || null
  }

  const getUsageForType = (usageType: string) => {
    return pricing.currentUsage.find(usage => usage.usage_type === usageType)?.total_usage || 0
  }

  const getRemainingValidations = () => {
    const plan = getCurrentPlan()
    if (!plan) return 0
    
    if (plan.validations_per_month === -1) return -1 // unlimited
    
    const used = getUsageForType('idea_validation')
    return Math.max(0, plan.validations_per_month - used)
  }

  const getUsagePercentage = (usageType: string = 'idea_validation') => {
    const plan = getCurrentPlan()
    if (!plan || plan.validations_per_month === -1) return 0
    
    const used = getUsageForType(usageType)
    return Math.min(100, (used / plan.validations_per_month) * 100)
  }

  const isOnTrial = () => {
    return pricing.currentSubscription?.status === 'trialing'
  }

  const hasActiveSubscription = () => {
    return pricing.currentSubscription?.status === 'active' || isOnTrial()
  }

  const getTrialDaysRemaining = () => {
    if (!isOnTrial() || !pricing.currentSubscription) return 0
    
    const endDate = new Date(pricing.currentSubscription.current_period_end)
    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  }

  return {
    ...pricing,
    refreshPricingData,
    recordUsage,
    getCurrentPlan,
    getUsageForType,
    getRemainingValidations,
    getUsagePercentage,
    isOnTrial,
    hasActiveSubscription,
    getTrialDaysRemaining
  }
}