"use client";

import { useState, useEffect } from 'react'
import { SaasIdeaItem } from '@/lib/supabase'
import { getTrendingIdeas, DailyIdeaData } from '@/lib/dailyIdea'

interface TrendingProblemsProps {
  onViewDetails: (idea: SaasIdeaItem) => void
}

export default function TrendingProblems({ onViewDetails }: TrendingProblemsProps) {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d')
  const [trendingProblems, setTrendingProblems] = useState<DailyIdeaData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrendingProblems = async () => {
      try {
        setLoading(true)
        const problems = await getTrendingIdeas(3) // Get top 3 trending
        setTrendingProblems(problems)
      } catch (error) {
        console.error('Error fetching trending problems:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchTrendingProblems()
  }, [timeframe])

  // Use real data if available, otherwise show loading or empty state
  const displayProblems = trendingProblems.length > 0 ? trendingProblems : []

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-gradient-to-br from-green-100 to-green-200 text-green-800 border border-green-300";
    if (score >= 60) return "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300";
    if (score >= 40) return "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-300";
    return "bg-gradient-to-br from-red-100 to-red-200 text-red-800 border border-red-300";
  };

  const getTrendColor = (growthRate: number) => {
    if (growthRate >= 100) return "text-green-600";
    if (growthRate >= 50) return "text-blue-600";
    if (growthRate >= 0) return "text-gray-600";
    return "text-red-600";
  };

  const getTrendIcon = (growthRate: number) => {
    if (growthRate >= 50) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    }
    if (growthRate >= 0) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <div className="flex items-center mb-4 sm:mb-0">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Trending Problems</h3>
              <p className="text-sm text-gray-600">Problems gaining momentum right now</p>
            </div>
          </div>
          
          {/* Timeframe Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setTimeframe(period)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  timeframe === period
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {period === '24h' ? '24 Hours' : period === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trending List */}
      <div className="divide-y divide-gray-100">
        {loading ? (
          // Loading skeleton
          [...Array(3)].map((_, index) => (
            <div key={index} className="px-6 py-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded mb-3"></div>
                  <div className="flex gap-4 mb-3">
                    <div className="w-16 h-3 bg-gray-200 rounded"></div>
                    <div className="w-12 h-3 bg-gray-200 rounded"></div>
                    <div className="w-20 h-3 bg-gray-200 rounded"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-16 h-5 bg-gray-200 rounded"></div>
                      ))}
                    </div>
                    <div className="w-20 h-6 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : displayProblems.length > 0 ? (
          displayProblems.map((trending, index) => (
            <div key={trending.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Rank */}
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-orange-100 to-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-orange-700">#{index + 1}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-base font-semibold text-gray-900 truncate pr-4">
                      {trending.name}
                    </h4>
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold flex-shrink-0 ${getScoreColor(trending.score)}`}>
                      {trending.score}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 line-clamp-2 mb-3 leading-relaxed">
                    {trending.one_liner}
                  </p>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <div className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
                      </svg>
                      {trending.userComplaints} mentions
                    </div>
                    <div className={`flex items-center ${getTrendColor(Math.floor(trending.trendScore))}`}>
                      {getTrendIcon(Math.floor(trending.trendScore))}
                      <span className="ml-1 font-medium">+{Math.floor(trending.trendScore)}%</span>
                    </div>
                    <div>
                      {trending.isNew && <span className="text-green-600 font-medium">New!</span>}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {trending.required_skills?.slice(0, 3).map((skill, skillIndex) => (
                        <span key={skillIndex} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                          {skill}
                        </span>
                      ))}
                      {trending.required_skills && trending.required_skills.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{trending.required_skills.length - 3} more
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => onViewDetails(trending)}
                      className="inline-flex items-center px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium rounded-md transition-colors"
                    >
                      View Details
                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          // Empty state
          <div className="px-6 py-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trending problems found</h3>
            <p className="text-gray-600">New trends will appear here as they emerge from our analysis.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-red-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Trends updated every 2 hours based on Reddit activity
          </div>
          <button className="text-orange-600 hover:text-orange-700 font-medium transition-colors">
            View All Trends →
          </button>
        </div>
      </div>
    </div>
  )
}