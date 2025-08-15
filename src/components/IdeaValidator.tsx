'use client'

import { useState } from 'react'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'

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
    <div className="bg-white shadow-sm rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Idea Validator</h2>
            <p className="text-sm text-gray-600 mt-1">Test your SaaS idea against real market data and complaints</p>
          </div>
          {(ideaForm.name || ideaForm.description || validationResult) && (
            <button
              onClick={clearForm}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${validationResult ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-2xl mx-auto'}`}>
          {/* Input Form */}
          <div className="space-y-4">
            <div>
              <label htmlFor="idea-name" className="block text-sm font-medium text-gray-700 mb-1">
                Idea Name *
              </label>
              <input
                id="idea-name"
                type="text"
                value={ideaForm.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Project Management for Remote Teams"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
              />
            </div>

            <div>
              <label htmlFor="idea-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description & Value Proposition *
              </label>
              <textarea
                id="idea-description"
                value={ideaForm.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what your SaaS does and what problem it solves..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
              />
            </div>

            <div>
              <label htmlFor="target-user" className="block text-sm font-medium text-gray-700 mb-1">
                Target User
              </label>
              <input
                id="target-user"
                type="text"
                value={ideaForm.target_user}
                onChange={(e) => handleInputChange('target_user', e.target.value)}
                placeholder="e.g., Small business owners, Freelancers, Marketing teams"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
              />
            </div>

            <div>
              <label htmlFor="core-features" className="block text-sm font-medium text-gray-700 mb-1">
                Core Features
              </label>
              <textarea
                id="core-features"
                value={ideaForm.core_features}
                onChange={(e) => handleInputChange('core_features', e.target.value)}
                placeholder="List the main features (one per line or comma-separated)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
              />
            </div>

            <div>
              <label htmlFor="pricing-model" className="block text-sm font-medium text-gray-700 mb-1">
                Pricing Model
              </label>
              <input
                id="pricing-model"
                type="text"
                value={ideaForm.pricing_model}
                onChange={(e) => handleInputChange('pricing_model', e.target.value)}
                placeholder="e.g., $29/month per user, Freemium, One-time purchase"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
              />
            </div>

            <button
              onClick={validateIdea}
              disabled={isValidating || !ideaForm.name.trim() || !ideaForm.description.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Validating Against Market Data...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Validate Idea
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {(validationResult || error || isValidating) && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 animate-in fade-in duration-200">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {isValidating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center animate-pulse">
                  <div className="flex items-center justify-center mb-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                  <h3 className="text-lg font-medium text-blue-900 mb-2">Analyzing Your Idea</h3>
                  <p className="text-sm text-blue-700">Searching through market data and complaints to validate your SaaS idea...</p>
                </div>
              )}

              {validationResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Score Card */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Market Validation Score</h3>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-bold ${getScoreColor(validationResult.score)}`}>
                          {validationResult.score}/100
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                      <div 
                        className={`h-3 rounded-full transition-all duration-1000 ease-out ${
                          validationResult.score >= 80 ? 'bg-green-500' :
                          validationResult.score >= 60 ? 'bg-yellow-500' :
                          validationResult.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${validationResult.score}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{validationResult.rationale}</p>
                  </div>

                  {/* Market Evidence */}
                  {validationResult.market_evidence && validationResult.market_evidence.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Market Evidence Found
                      </h4>
                      <ul className="space-y-2">
                        {validationResult.market_evidence.map((evidence, index) => (
                          <li key={index} className="text-sm text-green-800 flex items-start leading-relaxed">
                            <span className="text-green-500 mr-2 mt-1 text-xs">▶</span>
                            {evidence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {validationResult.competition_level && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Competition Level</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 ${getCompetitionColor(validationResult.competition_level)}`}>
                              {validationResult.competition_level}
                            </span>
                          </div>
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {typeof validationResult.similar_complaints === 'number' && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Similar Complaints</p>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mt-1">
                              {validationResult.similar_complaints} posts
                            </span>
                          </div>
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Keyword Matches */}
                  {validationResult.keyword_matches && validationResult.keyword_matches.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Matching Keywords Found
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {validationResult.keyword_matches.map((keyword, index) => (
                          <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {validationResult.recommendations && validationResult.recommendations.length > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Recommendations
                      </h4>
                      <ul className="space-y-3">
                        {validationResult.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-purple-800 flex items-start leading-relaxed">
                            <span className="text-purple-500 mr-2 mt-1 text-xs">💡</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!validationResult && !error && !isValidating && (
            <div className="lg:col-span-1 text-center py-12 text-gray-500">
              <div className="max-w-sm mx-auto">
                <svg className="mx-auto h-16 w-16 text-gray-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Validate?</h3>
                <p className="text-sm text-gray-600 leading-relaxed">Enter your SaaS idea details and click "Validate Idea" to get comprehensive market insights powered by real user complaints and data.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}