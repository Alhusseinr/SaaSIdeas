'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { PricingProvider, usePricingActions } from '@/contexts/PricingContext'
import LoginForm from '@/components/LoginForm'
import Dashboard from '@/components/Dashboard'
import LandingPage from '@/components/LandingPage'
import PaymentGate from '@/components/PaymentGate'

function AppContent() {
  const { user, loading } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [loginMode, setLoginMode] = useState<'signin' | 'signup'>('signup')
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>(undefined)
  const { hasActiveSubscription, getCurrentPlan, isLoading: pricingLoading } = usePricingActions()

  if (loading || pricingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    if (showLogin) {
      return <LoginForm 
        onSuccess={() => window.location.reload()} 
        selectedPlan={selectedPlan}
        initialMode={loginMode}
      />
    }
    return <LandingPage 
      onGetStarted={(planId) => {
        setSelectedPlan(planId)
        setLoginMode('signup')
        setShowLogin(true)
      }}
      onSignIn={() => {
        setLoginMode('signin')
        setShowLogin(true)
      }}
    />
  }

  // User is logged in but needs to complete payment
  if (!hasActiveSubscription()) {
    const pendingPlan = localStorage.getItem('pendingPlan') || selectedPlan || 'pro'
    const planInfo = {
      starter: { id: 'starter', name: 'Starter', price: 49, features: ['25 idea validations per month', 'AI-powered market analysis', 'Reddit data integration', 'Email support', 'Implementation prompts'] },
      pro: { id: 'pro', name: 'Pro', price: 99, features: ['100 idea validations per month', 'Advanced AI analysis with GPT-4', 'Reddit + Twitter integration', 'Priority support & live chat', 'Custom implementation plans'] },
      enterprise: { id: 'enterprise', name: 'Enterprise', price: 199, features: ['Unlimited idea validations', 'Multi-platform data integration', 'White-label options', 'Dedicated account manager', 'Custom AI training'] }
    }
    
    const plan = planInfo[pendingPlan as keyof typeof planInfo] || planInfo.pro
    
    return <PaymentGate 
      selectedPlan={plan}
      onPaymentComplete={() => {
        // In real implementation, this would be handled by Stripe webhook
        // For demo, we'll just reload to trigger subscription creation
        localStorage.removeItem('pendingPlan')
        window.location.reload()
      }}
    />
  }

  return <Dashboard />
}

export default function Home() {
  return (
    <PricingProvider>
      <AppContent />
    </PricingProvider>
  )
}
