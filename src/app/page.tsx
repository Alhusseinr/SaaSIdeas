'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Center, Loader, Box } from '@mantine/core'
import { useAuth } from '@/hooks/useAuth'
import { usePricingActions } from '@/contexts/PricingContext'
import LoginForm from '@/components/LoginForm'
import LandingPage from '@/components/LandingPage'
import PaymentGate from '@/components/PaymentGate'

function AppContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showLogin, setShowLogin] = useState(false)
  const [loginMode, setLoginMode] = useState<'signin' | 'signup'>('signup')
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  const { hasActiveSubscription, getCurrentPlan, isLoading: pricingLoading } = usePricingActions()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || loading || pricingLoading) {
    return (
      <Box style={{ minHeight: '100vh', backgroundColor: 'var(--mantine-color-gray-0)' }}>
        <Center h="100vh">
          <Loader size="xl" color="blue" />
        </Center>
      </Box>
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
        console.log('onGetStarted called with planId:', planId)
        setSelectedPlan(planId || 'professional') // Default to professional plan
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

  // User is fully authenticated and has subscription - redirect to dashboard
  router.replace('/dashboard/overview')
  return null
}

export default function Home() {
  return <AppContent />
}
