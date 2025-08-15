'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LoginFormProps {
  onSuccess: () => void
  selectedPlan?: string
  initialMode?: 'signin' | 'signup'
}

export default function LoginForm({ onSuccess, selectedPlan, initialMode = 'signin' }: LoginFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          return
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters long')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              selected_plan: selectedPlan || 'pro', // Default to Pro plan
            }
          }
        })

        if (error) {
          setError(error.message)
        } else {
          // Store selected plan in localStorage for post-verification setup
          if (selectedPlan) {
            localStorage.setItem('pendingPlan', selectedPlan)
          }
          setMessage('Account created successfully! Please check your email to verify your account. After verification, you\'ll complete payment to access your dashboard.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setError(error.message)
        } else {
          onSuccess()
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError('')
    setMessage('')
  }

  const getPlanInfo = (planId: string) => {
    const plans = {
      starter: { name: 'Starter', price: '$49', features: ['25 validations/month', 'AI analysis', 'Email support'] },
      pro: { name: 'Pro', price: '$99', features: ['100 validations/month', 'Advanced AI', 'Priority support'] },
      enterprise: { name: 'Enterprise', price: '$199', features: ['Unlimited validations', 'Custom AI', 'Dedicated manager'] }
    }
    return plans[planId as keyof typeof plans] || plans.pro
  }

  const planInfo = selectedPlan ? getPlanInfo(selectedPlan) : null

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
                <p className="text-sm text-gray-600 hidden sm:block">AI-Powered SaaS Discovery Platform</p>
              </div>
            </div>
            
            <button
              onClick={() => window.location.href = '/'}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full space-y-8">
          {/* Auth Card */}
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-8 text-center border-b border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {mode === 'signin' ? 'Welcome back!' : 'Create your account'}
              </h2>
              <p className="text-gray-600 mb-4">
                {mode === 'signin' 
                  ? 'Sign in to access your SaaS Ideas Dashboard' 
                  : 'Join thousands of entrepreneurs discovering SaaS opportunities'
                }
              </p>
              
              {/* Selected Plan Display */}
              {planInfo && mode === 'signup' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-blue-900">Selected Plan: {planInfo.name}</h3>
                    <span className="text-lg font-bold text-blue-600">{planInfo.price}/month</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {planInfo.features.map((feature, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {feature}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-blue-700 mt-2">Complete signup to proceed to secure payment</p>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="px-6 py-8">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-5">
                  {mode === 'signup' && (
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        autoComplete="name"
                        required
                        placeholder="Enter your full name"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all duration-200"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Enter your email"
                      className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all duration-200"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      required
                      placeholder="Enter your password"
                      className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all duration-200"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {mode === 'signup' && (
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        placeholder="Confirm your password"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all duration-200"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-700">{message}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:transform-none font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                      </div>
                    ) : (
                      mode === 'signin' ? 'Sign In' : 'Create Account'
                    )}
                  </button>
                </div>

                {mode === 'signup' && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      By creating an account, you agree to our Terms of Service and Privacy Policy
                    </p>
                  </div>
                )}
              </form>
            </div>

            {/* Switch Mode */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
                  {' '}
                  <button
                    onClick={switchMode}
                    className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
                
                <div className="mt-4">
                  <button
                    onClick={() => window.location.href = '/'}
                    className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
                  >
                    ← Back to Home
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="text-center">
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span>AI-Powered</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span>Secure</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span>Fast</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}