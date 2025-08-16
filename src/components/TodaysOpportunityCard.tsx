"use client";

import { useState, useEffect } from 'react'
import { getTodaysValidatedOpportunity, DailyIdeaData } from '@/lib/dailyIdea'
import ScoreBreakdown from './ScoreBreakdown'

interface TodaysOpportunityCardProps {
  onGetStarted: (planId?: string) => void
}

export default function TodaysOpportunityCard({ onGetStarted }: TodaysOpportunityCardProps) {
  const [todaysIdea, setTodaysIdea] = useState<DailyIdeaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)

  useEffect(() => {
    const fetchTodaysIdea = async () => {
      try {
        setLoading(true)
        setError(null)
        const idea = await getTodaysValidatedOpportunity()
        setTodaysIdea(idea)
      } catch (err) {
        console.error('Error fetching today\'s idea:', err)
        setError('Failed to load today\'s opportunity')
      } finally {
        setLoading(false)
      }
    }

    fetchTodaysIdea()
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-gradient-to-br from-green-100 to-green-200 text-green-800 border border-green-300";
    if (score >= 60) return "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300";
    if (score >= 40) return "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-300";
    return "bg-gradient-to-br from-red-100 to-red-200 text-red-800 border border-red-300";
  };

  const formatRevenue = (revenue: number) => {
    if (revenue >= 1000000) return `$${(revenue / 1000000).toFixed(1)}M`
    if (revenue >= 1000) return `$${(revenue / 1000).toFixed(0)}K`
    return `$${revenue}`
  }

  const getMarketDemandLabel = (complaints: number) => {
    if (complaints >= 40) return "High"
    if (complaints >= 20) return "Medium"
    return "Low"
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-pulse">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-32 h-6 bg-white/20 rounded-full"></div>
            <div className="w-20 h-4 bg-white/20 rounded"></div>
          </div>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="w-3/4 h-6 bg-white/20 rounded mb-2"></div>
              <div className="w-1/2 h-4 bg-white/20 rounded"></div>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-xl"></div>
          </div>
        </div>
        <div className="p-6">
          <div className="w-full h-4 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="w-full h-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (error || !todaysIdea) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="p-6 text-center">
          <div className="text-gray-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to load today's opportunity</h3>
          <p className="text-gray-600">Please try again later</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header with Badge */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full">
            <div className={`w-2 h-2 ${todaysIdea.isNew ? 'bg-orange-400 animate-pulse' : 'bg-green-400'} rounded-full mr-2`}></div>
            <span className="text-sm font-medium text-white">
              {todaysIdea.isNew ? "Fresh Today" : "Today's Pick"}
            </span>
          </div>
          <div className="text-xs text-white/70">{new Date().toLocaleDateString()}</div>
        </div>
        
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h3 className="text-xl font-bold text-white mb-2 leading-tight">
              {todaysIdea.name}
            </h3>
            <div className="flex items-center space-x-4 text-white/80 text-sm">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
                </svg>
                {todaysIdea.userComplaints} user complaints
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {todaysIdea.isNew ? "Just discovered" : "Trending this week"}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowScoreBreakdown(true)}
            className={`inline-flex items-center justify-center w-16 h-16 rounded-xl text-lg font-bold flex-shrink-0 hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer ${getScoreColor(todaysIdea.score)}`}
            title="Click to see score breakdown"
          >
            {todaysIdea.score}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <p className="text-gray-700 leading-relaxed mb-6">
          {todaysIdea.one_liner}
        </p>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 text-center border border-green-200">
            <div className="text-2xl font-bold text-green-900">{formatRevenue(todaysIdea.yearOneRevenue)}</div>
            <div className="text-sm text-green-700">Year 1 Revenue</div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 text-center border border-blue-200">
            <div className="text-2xl font-bold text-blue-900">{todaysIdea.buildTime}w</div>
            <div className="text-sm text-blue-700">Time to Build</div>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 text-center border border-purple-200">
            <div className="text-2xl font-bold text-purple-900">{todaysIdea.founderFit}</div>
            <div className="text-sm text-purple-700">Founder Fit</div>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 text-center border border-orange-200">
            <div className="text-2xl font-bold text-orange-900">{getMarketDemandLabel(todaysIdea.userComplaints)}</div>
            <div className="text-sm text-orange-700">Market Demand</div>
          </div>
        </div>

        {/* Why Now Section */}
        {todaysIdea.why_now && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200 mb-6">
            <h4 className="text-sm font-semibold text-amber-900 mb-2 flex items-center">
              <svg className="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why This Opportunity is Hot
            </h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              {todaysIdea.why_now}
            </p>
          </div>
        )}

        {/* Call to Action */}
        <button
          onClick={() => onGetStarted('pro')}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          Get Full Analysis & Implementation Plan
        </button>

        {/* Trust Indicators */}
        <div className="flex items-center justify-center space-x-6 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center">
            <svg className="w-3 h-3 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Validated
          </div>
          <div className="flex items-center">
            <svg className="w-3 h-3 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Real Demand
          </div>
          <div className="flex items-center">
            <svg className="w-3 h-3 text-purple-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Updated Daily
          </div>
        </div>
      </div>

      {/* Score Breakdown Modal */}
      {showScoreBreakdown && todaysIdea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-sm font-bold mr-3 ${getScoreColor(todaysIdea.score)}`}>
                  {todaysIdea.score}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{todaysIdea.name}</h3>
                  <p className="text-sm text-gray-600">Score breakdown and calculation details</p>
                </div>
              </div>
              <button
                onClick={() => setShowScoreBreakdown(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <ScoreBreakdown idea={todaysIdea} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}