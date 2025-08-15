'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LoginForm from '@/components/LoginForm'
import Dashboard from '@/components/Dashboard'
import LandingPage from '@/components/LandingPage'

export default function Home() {
  const { user, loading } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    if (showLogin) {
      return <LoginForm onSuccess={() => window.location.reload()} />
    }
    return <LandingPage onGetStarted={() => setShowLogin(true)} />
  }

  return <Dashboard />
}
