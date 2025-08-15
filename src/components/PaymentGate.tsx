'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/types/pricing'

interface PaymentGateProps {
  selectedPlan: {
    id: string
    name: string
    price: number
    features: string[]
  }
  onPaymentComplete: () => void
}

export default function PaymentGate({ selectedPlan, onPaymentComplete }: PaymentGateProps) {
  const { user, signOut } = useAuth()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      // This will redirect to landing page
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handlePayment = async () => {
    setIsProcessing(true)
    
    try {
      // TODO: Replace with actual Stripe integration
      // For now, simulate payment processing
      console.log('Processing payment for:', {
        plan: selectedPlan.name,
        billing: billingCycle,
        amount: billingCycle === 'yearly' ? selectedPlan.price * 10 : selectedPlan.price
      })
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // In real implementation:
      // 1. Create Stripe checkout session
      // 2. Redirect to Stripe
      // 3. Handle success webhook
      // 4. Create active subscription in database
      
      onPaymentComplete()
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const getPrice = () => {
    return billingCycle === 'yearly' ? selectedPlan.price * 10 : selectedPlan.price
  }

  const getSavings = () => {
    const yearlyTotal = selectedPlan.price * 10 // 2 months free
    const monthlyTotal = selectedPlan.price * 12
    return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">IdeaValidator</h1>
                <p className="text-sm text-gray-600 hidden sm:block">Complete Your Subscription</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Welcome, <span className="font-medium text-gray-900">{user?.email?.split('@')[0]}</span></span>
              </div>
              
              <button
                onClick={handleSignOut}
                className="bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 transition-all duration-200"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Sign Out</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full">
          {/* Payment Card */}
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-6 text-center border-b border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Subscription</h2>
              <p className="text-gray-600">You're one step away from discovering your next SaaS opportunity</p>
            </div>

            {/* Plan Summary */}
            <div className="px-6 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{selectedPlan.name} Plan</h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                  Selected
                </span>
              </div>
              
              {/* Billing Toggle */}
              <div className="bg-gray-50 rounded-lg p-1 flex mb-6">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all relative ${
                    billingCycle === 'yearly'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  Yearly
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full">
                    -{getSavings()}%
                  </span>
                </button>
              </div>

              {/* Price Display */}
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatPrice(getPrice())}
                  </span>
                  <span className="text-gray-600 ml-2">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-green-600 text-sm mt-1 font-medium">
                    Save {getSavings()}% with yearly billing
                  </p>
                )}
              </div>

              {/* Features */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">What you'll get:</h4>
                {selectedPlan.features.slice(0, 5).map((feature, index) => (
                  <div key={index} className="flex items-start text-sm">
                    <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Form */}
            <div className="px-6 py-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Stripe Integration Required:</strong> To enable payments, you'll need to set up Stripe. 
                      This demo shows the payment flow without processing real payments.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Processing Payment...
                  </div>
                ) : (
                  `Subscribe for ${formatPrice(getPrice())}/${billingCycle === 'yearly' ? 'year' : 'month'}`
                )}
              </button>

              <div className="mt-4 text-center text-xs text-gray-500">
                <p>Secure payment powered by Stripe</p>
              </div>

              {/* Alternative Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-600 mb-4">Not ready to subscribe?</p>
                <div className="flex justify-center">
                  <a
                    href="/"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors underline"
                  >
                    Return to Home
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Your account will remain active. You can complete your subscription anytime.
                </p>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-6 text-center">
            <div className="flex justify-center space-x-6 text-xs text-gray-500">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                SSL Secured
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No Setup Fees
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Instant Access
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}