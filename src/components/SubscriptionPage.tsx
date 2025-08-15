'use client'

import { useState } from 'react'
import { usePricingActions } from '@/contexts/PricingContext'
import { formatPrice, isUnlimitedPlan } from '@/types/pricing'

export default function SubscriptionPage() {
  const {
    currentSubscription,
    getCurrentPlan,
    getUsageForType,
    getRemainingValidations,
    getUsagePercentage,
    isOnTrial,
    hasActiveSubscription,
    getTrialDaysRemaining,
    isLoading
  } = usePricingActions()

  const [showUsageDetails, setShowUsageDetails] = useState(false)
  const [isManaging, setIsManaging] = useState(false)

  const handleManageSubscription = async () => {
    setIsManaging(true)
    
    try {
      // Create Stripe customer portal session
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const { url, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Redirect to Stripe customer portal
      window.location.href = url
    } catch (error) {
      console.error('Customer portal error:', error)
      alert('Unable to open subscription management. Please try again.')
    } finally {
      setIsManaging(false)
    }
  }

  const handleUpgradePlan = () => {
    // Redirect to landing page pricing section
    window.location.href = '/#pricing'
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const currentPlan = getCurrentPlan()
  const usedValidations = getUsageForType('idea_validation')
  const remainingValidations = getRemainingValidations()
  const usagePercentage = getUsagePercentage()
  const trialDaysRemaining = getTrialDaysRemaining()

  const getUsageBarColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500'
    if (usagePercentage >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusBadgeColor = () => {
    if (isOnTrial()) return 'bg-blue-100 text-blue-800'
    if (currentSubscription?.status === 'active') return 'bg-green-100 text-green-800'
    if (currentSubscription?.status === 'past_due') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Current Subscription</h3>
                <p className="text-sm text-gray-600">Your plan and usage overview</p>
              </div>
            </div>
            <button
              onClick={() => setShowUsageDetails(!showUsageDetails)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {showUsageDetails ? 'Hide Details' : 'View Details'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!hasActiveSubscription() ? (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-yellow-900 mb-2">No Active Subscription</h3>
              <p className="text-yellow-700 mb-4">Subscribe to start validating your SaaS ideas</p>
              <button
                onClick={handleUpgradePlan}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
              >
                View Pricing Plans
              </button>
            </div>
          ) : (
            <>
              {/* Plan Info */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-xl font-bold text-gray-900">{currentPlan?.display_name}</h4>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor()}`}>
                      {isOnTrial() ? `Trial (${trialDaysRemaining} days left)` : currentSubscription?.status}
                    </span>
                  </div>
                  <p className="text-gray-600">{currentPlan?.description}</p>
                  {currentSubscription && (
                    <p className="text-sm text-gray-500 mt-1">
                      {formatPrice(currentSubscription.billing_cycle === 'yearly' ? currentPlan?.price_yearly || 0 : currentPlan?.price_monthly || 0)} 
                      / {currentSubscription.billing_cycle === 'yearly' ? 'year' : 'month'}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {isUnlimitedPlan(currentPlan?.validations_per_month || 0) ? '∞' : remainingValidations}
                  </div>
                  <div className="text-sm text-gray-500">
                    {isUnlimitedPlan(currentPlan?.validations_per_month || 0) ? 'Unlimited' : 'remaining'}
                  </div>
                </div>
              </div>

              {/* Usage Progress */}
              {!isUnlimitedPlan(currentPlan?.validations_per_month || 0) && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Idea Validations This Month</span>
                    <span className="text-sm text-gray-500">
                      {usedValidations} / {currentPlan?.validations_per_month}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${getUsageBarColor()}`}
                      style={{ width: `${Math.min(100, usagePercentage)}%` }}
                    ></div>
                  </div>
                  {usagePercentage >= 80 && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      You're approaching your monthly limit. Consider upgrading your plan.
                    </p>
                  )}
                </div>
              )}

              {/* Trial Warning */}
              {isOnTrial() && trialDaysRemaining <= 3 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Your trial expires in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Choose a plan below to continue using IdeaValidator without interruption.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleManageSubscription}
                  disabled={isManaging}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isManaging ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Opening...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Manage Subscription
                    </>
                  )}
                </button>
                {currentPlan?.name !== 'enterprise' && (
                  <button
                    onClick={handleUpgradePlan}
                    className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Upgrade Plan
                  </button>
                )}
                <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Invoice
                </button>
              </div>

              {/* Detailed Usage (Expandable) */}
              {showUsageDetails && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h5 className="text-sm font-semibold text-gray-900 mb-4">Usage Details</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">API Calls</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {getUsageForType('api_call') || 0}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Exports</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {getUsageForType('export') || 0}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Team Members</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {getUsageForType('team_member') || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {currentSubscription && (
                    <div className="mt-4 text-xs text-gray-500">
                      <p>Billing cycle: {currentSubscription.current_period_start} to {currentSubscription.current_period_end}</p>
                      {currentSubscription.cancel_at_period_end && (
                        <p className="text-red-600 mt-1">⚠️ Subscription will cancel at the end of this period</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}