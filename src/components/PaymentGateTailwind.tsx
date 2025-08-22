'use client'

import { useState } from 'react'
import { 
  IconBolt, 
  IconCreditCard, 
  IconLogout,
  IconCheck
} from '@tabler/icons-react'
import { useAuth } from '@/hooks/useAuth'

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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [processing, setProcessing] = useState(false)
  const { signOut } = useAuth()

  const handlePayment = async () => {
    setProcessing(true)
    
    // Store the pending plan for after payment
    localStorage.setItem('pendingPlan', selectedPlan.id)
    
    // Simulate payment processing
    setTimeout(() => {
      onPaymentComplete()
      setProcessing(false)
    }, 2000)
  }

  const yearlyDiscount = 0.2
  const yearlyPrice = Math.round(selectedPlan.price * 12 * (1 - yearlyDiscount))
  const monthlyYearlyPrice = Math.round(yearlyPrice / 12)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <IconBolt size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Complete Your Subscription
          </h1>
          <p className="text-gray-600">
            You're one step away from accessing validated SaaS opportunities
          </p>
        </div>

        {/* Plan Details Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedPlan.name} Plan
            </h2>
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
              Selected
            </span>
          </div>

          {/* Billing Toggle */}
          <div className="mb-6">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="ml-1 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Price */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold text-gray-900">
                ${billingCycle === 'monthly' ? selectedPlan.price : monthlyYearlyPrice}
              </span>
              <span className="text-gray-600">per month</span>
            </div>
            {billingCycle === 'yearly' && (
              <div className="mt-1">
                <span className="text-sm text-gray-500 line-through">
                  ${selectedPlan.price * 12}/year
                </span>
                <span className="ml-2 text-sm text-green-600 font-medium">
                  ${yearlyPrice}/year (save ${Math.round(selectedPlan.price * 12 * yearlyDiscount)})
                </span>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="space-y-3 mb-6">
            {selectedPlan.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <IconCheck size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={processing}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <IconCreditCard size={16} className="mr-2" />
                Subscribe Now
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">
            30-day money-back guarantee • Cancel anytime
          </p>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <IconLogout size={16} className="mr-1" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}