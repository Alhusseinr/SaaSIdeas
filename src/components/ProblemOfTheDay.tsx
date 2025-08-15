"use client";

import { useState, useEffect } from 'react'
import { SaasIdeaItem } from '@/lib/supabase'
import { getTodaysValidatedOpportunity } from '@/lib/dailyIdea'

interface ProblemOfTheDayProps {
  onViewDetails: (idea: SaasIdeaItem) => void
}

export default function ProblemOfTheDay({ onViewDetails }: ProblemOfTheDayProps) {
  const [todaysProblem, setTodaysProblem] = useState<SaasIdeaItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTodaysProblem = async () => {
      try {
        setIsLoading(true)
        const idea = await getTodaysValidatedOpportunity()
        setTodaysProblem(idea)
      } catch (error) {
        console.error('Error fetching today\'s problem:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchTodaysProblem()
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-gradient-to-br from-green-100 to-green-200 text-green-800 border border-green-300";
    if (score >= 60) return "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300";
    if (score >= 40) return "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-300";
    return "bg-gradient-to-br from-red-100 to-red-200 text-red-800 border border-red-300";
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 animate-pulse">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gray-300 rounded-lg mr-3"></div>
          <div className="h-6 bg-gray-300 rounded w-48"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-10 bg-gray-300 rounded w-32"></div>
        </div>
      </div>
    )
  }

  if (!todaysProblem) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Problem Featured Today</h3>
          <p className="text-gray-600">Check back tomorrow for a new validated opportunity!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Problem of the Day</h3>
            <p className="text-sm text-gray-600">{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
        </div>
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-sm font-bold shadow-sm ${getScoreColor(todaysProblem.score)}`}>
          {todaysProblem.score}
        </div>
      </div>

      {/* Problem Details */}
      <div className="mb-6">
        <h4 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
          {todaysProblem.name}
        </h4>
        <p className="text-gray-700 leading-relaxed mb-4">
          {todaysProblem.one_liner}
        </p>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
            <div className="text-lg font-bold text-blue-900">
              {todaysProblem.representative_post_ids?.length || 0}
            </div>
            <div className="text-xs text-blue-700">User Complaints</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-purple-200 text-center">
            <div className="text-lg font-bold text-purple-900">
              {Math.round((todaysProblem.development_timeline_months || 6) * 4.33)}w
            </div>
            <div className="text-xs text-purple-700">Time to Build</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-200 text-center">
            <div className="text-lg font-bold text-green-900">
              {todaysProblem.revenue_projection ? 
                `$${(todaysProblem.revenue_projection.monthly_recurring_revenue.month_12 / 1000).toFixed(0)}K` : 
                '$50K'}
            </div>
            <div className="text-xs text-green-700">Year 1 ARR</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
            <div className="text-lg font-bold text-orange-900">
              {todaysProblem.founder_market_fit_score || 75}
            </div>
            <div className="text-xs text-orange-700">Founder Fit</div>
          </div>
        </div>

        {/* Why Now */}
        {todaysProblem.why_now && (
          <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
            <h5 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
              <svg className="w-4 h-4 text-amber-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why Now?
            </h5>
            <p className="text-sm text-gray-700 leading-relaxed">
              {todaysProblem.why_now}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => onViewDetails(todaysProblem)}
          className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Analyze This Opportunity
        </button>
        
        <button className="inline-flex items-center justify-center px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Share
        </button>
      </div>

      {/* Email Signup Hint */}
      <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
        <div className="flex items-center text-sm">
          <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-gray-700">
            <span className="font-medium">Want daily problems in your inbox?</span> 
            <span className="text-blue-600 hover:text-blue-700 cursor-pointer ml-1">Get email alerts →</span>
          </span>
        </div>
      </div>
    </div>
  )
}