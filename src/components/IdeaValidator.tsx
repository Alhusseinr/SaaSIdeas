'use client'

import { useState } from 'react'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'
import { usePricingActions } from '@/contexts/PricingContext'

interface ValidationResult {
  score: number
  rationale: string
  market_evidence: string[]
  competition_level: string
  recommendations: string[]
  similar_complaints: number
  keyword_matches: string[]
}

export default function IdeaValidator() {
  const { canValidateIdea, recordUsage, getRemainingValidations, getCurrentPlan } = usePricingActions()
  const [ideaForm, setIdeaForm] = useState({
    name: '',
    description: '',
    target_user: '',
    core_features: '',
    pricing_model: ''
  })
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setIdeaForm(prev => ({ ...prev, [field]: value }))
  }

  const validateIdea = async () => {
    if (!ideaForm.name.trim() || !ideaForm.description.trim()) {
      setError('Please provide at least an idea name and description')
      return
    }

    // Check if user can validate ideas (has remaining quota)
    if (!canValidateIdea) {
      setError('You have reached your monthly validation limit. Please upgrade your plan to continue.')
      return
    }

    setIsValidating(true)
    setError('')
    setValidationResult(null)

    try {
      // Call the validation edge function
      const result = await invokeEdgeFunction('validate-idea', {
        idea: ideaForm
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Record the usage
      await recordUsage('idea_validation', 1, {
        idea_name: ideaForm.name,
        target_user: ideaForm.target_user,
        validation_score: result.validation?.score
      })

      setValidationResult(result.validation)
    } catch (err: any) {
      setError(err.message || 'Failed to validate idea')
    } finally {
      setIsValidating(false)
    }
  }

  const clearForm = () => {
    setIdeaForm({
      name: '',
      description: '',
      target_user: '',
      core_features: '',
      pricing_model: ''
    })
    setValidationResult(null)
    setError('')
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getCompetitionColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Idea Validator</h2>
              <p className="text-sm text-gray-600 mt-1">Test your SaaS idea against real market data and user complaints</p>
            </div>
          </div>
          {(ideaForm.name || ideaForm.description || validationResult) && (
            <button
              onClick={clearForm}
              className="bg-white/80 hover:bg-white text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 transition-all duration-200 shadow-sm"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Clear Form</span>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${validationResult ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
        {/* Enhanced Input Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="idea-name" className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                  <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Idea Name *
                </label>
                <input
                  id="idea-name"
                  type="text"
                  value={ideaForm.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Project Management for Remote Teams"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-colors shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="idea-description" className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                  <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Description & Value Proposition *
                </label>
                <textarea
                  id="idea-description"
                  value={ideaForm.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe what your SaaS does and what problem it solves..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-colors shadow-sm resize-none"
                />
              </div>

              <div>
                <label htmlFor="target-user" className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                  <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Target User
                </label>
                <input
                  id="target-user"
                  type="text"
                  value={ideaForm.target_user}
                  onChange={(e) => handleInputChange('target_user', e.target.value)}
                  placeholder="e.g., Small business owners, Freelancers, Marketing teams"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-colors shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="core-features" className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                  <svg className="w-4 h-4 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Core Features
                </label>
                <textarea
                  id="core-features"
                  value={ideaForm.core_features}
                  onChange={(e) => handleInputChange('core_features', e.target.value)}
                  placeholder="List the main features (one per line or comma-separated)"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-colors shadow-sm resize-none"
                />
              </div>

              <div>
                <label htmlFor="pricing-model" className="flex items-center text-sm font-semibold text-gray-900 mb-2">
                  <svg className="w-4 h-4 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Pricing Model
                </label>
                <input
                  id="pricing-model"
                  type="text"
                  value={ideaForm.pricing_model}
                  onChange={(e) => handleInputChange('pricing_model', e.target.value)}
                  placeholder="e.g., $29/month per user, Freemium, One-time purchase"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-colors shadow-sm"
                />
              </div>
            </div>

            {/* Usage Indicator */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Validation Credits</span>
                </div>
                <div className="text-sm">
                  {getRemainingValidations() === -1 ? (
                    <span className="text-green-600 font-semibold">Unlimited</span>
                  ) : (
                    <span className={`font-semibold ${getRemainingValidations() <= 5 ? 'text-red-600' : 'text-blue-600'}`}>
                      {getRemainingValidations()} remaining
                    </span>
                  )}
                </div>
              </div>
              {getCurrentPlan() && (
                <p className="text-xs text-gray-500 mt-1">
                  {getCurrentPlan()?.display_name} plan
                  {getRemainingValidations() <= 5 && getRemainingValidations() > 0 && (
                    <span className="text-amber-600 ml-1">• Running low on credits</span>
                  )}
                </p>
              )}
            </div>

            <button
              onClick={validateIdea}
              disabled={isValidating || !ideaForm.name.trim() || !ideaForm.description.trim() || !canValidateIdea}
              className={`w-full px-6 py-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center shadow-lg ${
                !canValidateIdea 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white transform hover:scale-105 disabled:transform-none'
              }`}
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Analyzing Against Market Data...
                </>
              ) : !canValidateIdea ? (
                <>
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Upgrade Plan to Continue
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Validate My Idea
                </>
              )}
            </button>
          </div>
        </div>

        {/* Enhanced Results Section */}
        {(validationResult || error || isValidating) && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-6 animate-in fade-in duration-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
                    <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 mb-1">Validation Error</h3>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {isValidating && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-8 text-center">
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Analyzing Your Idea</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Our AI is searching through millions of social media posts, complaints, and market signals to validate your SaaS concept...
                </p>
                <div className="flex items-center justify-center space-x-2 mt-4 text-xs text-gray-500">
                  <span>Processing market data</span>
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            {validationResult && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Enhanced Score Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Market Validation Score</h3>
                      </div>
                      <div className={`inline-flex items-center px-4 py-2 rounded-xl text-2xl font-bold shadow-sm ${getScoreColor(validationResult.score)}`}>
                        {validationResult.score}/100
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
                      <div 
                        className={`h-4 rounded-full transition-all duration-1000 ease-out ${
                          validationResult.score >= 80 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                          validationResult.score >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                          validationResult.score >= 40 ? 'bg-gradient-to-r from-orange-400 to-orange-600' : 'bg-gradient-to-r from-red-400 to-red-600'
                        }`}
                        style={{ width: `${validationResult.score}%` }}
                      ></div>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{validationResult.rationale}</p>
                  </div>
                </div>

                {/* Market Evidence */}
                {validationResult.market_evidence && validationResult.market_evidence.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
                      <h4 className="font-bold text-green-900 flex items-center">
                        <svg className="w-5 h-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Market Evidence Found
                      </h4>
                    </div>
                    <div className="p-6">
                      <ul className="space-y-3">
                        {validationResult.market_evidence.map((evidence, index) => (
                          <li key={index} className="text-green-800 flex items-start leading-relaxed">
                            <span className="text-green-500 mr-3 mt-1 text-lg">▶</span>
                            <span>{evidence}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Enhanced Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {validationResult.competition_level && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Competition Level</p>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCompetitionColor(validationResult.competition_level)}`}>
                        {validationResult.competition_level}
                      </span>
                    </div>
                  )}

                  {typeof validationResult.similar_complaints === 'number' && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Similar Complaints</p>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {validationResult.similar_complaints} posts
                      </span>
                    </div>
                  )}
                </div>

                {/* Enhanced Keyword Matches */}
                {validationResult.keyword_matches && validationResult.keyword_matches.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                      <h4 className="font-bold text-blue-900 flex items-center">
                        <svg className="w-5 h-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Matching Keywords Found
                      </h4>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-wrap gap-3">
                        {validationResult.keyword_matches.map((keyword, index) => (
                          <span key={index} className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Recommendations */}
                {validationResult.recommendations && validationResult.recommendations.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
                      <h4 className="font-bold text-purple-900 flex items-center">
                        <svg className="w-5 h-5 mr-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Recommendations
                      </h4>
                    </div>
                    <div className="p-6">
                      <ul className="space-y-4">
                        {validationResult.recommendations.map((rec, index) => (
                          <li key={index} className="text-purple-800 flex items-start leading-relaxed">
                            <span className="text-purple-500 mr-3 mt-1 text-lg">💡</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!validationResult && !error && !isValidating && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Ready to Validate Your Idea?</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Fill out the form on the left and click "Validate My Idea" to get comprehensive market insights powered by AI analysis of real user complaints and market data.
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-500">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Real market data
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  AI-powered analysis
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Instant results
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}