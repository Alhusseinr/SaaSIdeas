'use client'

import { useAuth } from '@/hooks/useAuth'
import LoginForm from '@/components/LoginForm'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm onSuccess={() => window.location.reload()} />
  }

  return <Dashboard />
}
