"use client";

import { useState, useEffect } from 'react'

interface LandingPageProblemProps {
  onGetStarted: (planId?: string) => void
}

export default function LandingPageProblem({ onGetStarted }: LandingPageProblemProps) {
  const [todaysProblem, setTodaysProblem] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Mock data - same as ProblemOfTheDay but simplified for landing page
  const mockProblem = {
    name: "Smart Email Scheduler for Busy Professionals",
    score: 87,
    one_liner: "An AI-powered tool that automatically schedules emails to be sent at optimal times based on recipient behavior patterns and time zones.",
    userComplaints: 47,
    yearOneRevenue: 75000,
    buildTime: 35, // 8 months × 4.33 ≈ 35 weeks
    founderFit: 82,
    why_now: "With remote work becoming permanent, professionals are struggling with email timing across global teams. Traditional email scheduling is manual and ineffective."
  }

  useEffect(() => {
    // Simulate API call delay
    const timer = setTimeout(() => {
      setTodaysProblem(mockProblem)
      setIsLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-gradient-to-br from-green-100 to-green-200 text-green-800 border border-green-300";
    if (score >= 60) return "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300";
    if (score >= 40) return "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-300";
    return "bg-gradient-to-br from-red-100 to-red-200 text-red-800 border border-red-300";
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="w-16 h-6 bg-gray-300 rounded mx-auto mb-4 animate-pulse"></div>
            <div className="w-64 h-8 bg-gray-300 rounded mx-auto animate-pulse"></div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 animate-pulse">
            <div className="space-y-4">
              <div className="h-6 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200 mb-4">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Today's Validated Opportunity
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real problems from real users, analyzed by AI and ready to build
          </p>
        </div>

        {/* Problem Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 sm:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
              <div className="flex-1 mb-4 sm:mb-0">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">
                  {todaysProblem.name}
                </h3>
                <div className="flex items-center space-x-4 text-white/80 text-sm">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
                    </svg>
                    {todaysProblem.userComplaints} Reddit complaints
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Trending this week
                  </div>
                </div>
              </div>
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl text-lg font-bold shadow-lg ${getScoreColor(todaysProblem.score)} flex-shrink-0`}>
                {todaysProblem.score}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              {todaysProblem.one_liner}
            </p>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 text-center border border-green-200">
                <div className="text-2xl font-bold text-green-900">
                  ${(todaysProblem.yearOneRevenue / 1000).toFixed(0)}K
                </div>
                <div className="text-xs text-green-700">Year 1 Revenue</div>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 text-center border border-blue-200">
                <div className="text-2xl font-bold text-blue-900">
                  {todaysProblem.buildTime}w
                </div>
                <div className="text-xs text-blue-700">Time to Build</div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 text-center border border-purple-200">
                <div className="text-2xl font-bold text-purple-900">
                  {todaysProblem.founderFit}
                </div>
                <div className="text-xs text-purple-700">Founder Fit</div>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 text-center border border-orange-200">
                <div className="text-2xl font-bold text-orange-900">
                  {todaysProblem.userComplaints}
                </div>
                <div className="text-xs text-orange-700">User Complaints</div>
              </div>
            </div>

            {/* Why Now */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200 mb-6">
              <h4 className="text-sm font-medium text-amber-900 mb-2 flex items-center">
                <svg className="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Why This Opportunity is Hot Right Now
              </h4>
              <p className="text-sm text-amber-800 leading-relaxed">
                {todaysProblem.why_now}
              </p>
            </div>

            {/* Call to Action */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => onGetStarted('pro')}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Get Full Analysis & Implementation Plan
              </button>
              <button className="px-6 py-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Share This Opportunity
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-600">
                <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    AI-Validated Opportunity
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Real User Demand
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-purple-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Updated Daily
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <p className="font-medium text-gray-900">Want daily opportunities?</p>
                  <p className="text-blue-600 hover:text-blue-700 cursor-pointer">Join 1,200+ entrepreneurs →</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-8">
          <p className="text-gray-600 mb-4">
            This is just one of <span className="font-semibold text-gray-900">200+ validated opportunities</span> in our database
          </p>
          <button
            onClick={() => onGetStarted()}
            className="inline-flex items-center px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Browse All Opportunities
          </button>
        </div>
      </div>
    </section>
  )
}