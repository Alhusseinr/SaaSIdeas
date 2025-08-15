"use client";

import { SaasIdeaItem } from '@/lib/supabase'

interface EnhancedAnalysisProps {
  idea: SaasIdeaItem
  expandedSections: {[key: string]: boolean}
  toggleSection: (section: string) => void
}

export default function EnhancedAnalysis({ idea, expandedSections, toggleSection }: EnhancedAnalysisProps) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-700 bg-green-100 border-green-200";
    if (score >= 60) return "text-blue-700 bg-blue-100 border-blue-200";
    if (score >= 40) return "text-yellow-700 bg-yellow-100 border-yellow-200";
    return "text-red-700 bg-red-100 border-red-200";
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 30) return "text-green-700 bg-green-100 border-green-200";
    if (difficulty <= 60) return "text-yellow-700 bg-yellow-100 border-yellow-200";
    return "text-red-700 bg-red-100 border-red-200";
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Analysis Overview */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
          <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Enhanced Analysis
        </h4>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {idea.founder_market_fit_score && (
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold ${getScoreColor(idea.founder_market_fit_score)}`}>
                {idea.founder_market_fit_score}
              </div>
              <div className="text-xs text-gray-600 mt-1">Founder Fit</div>
            </div>
          )}
          
          {idea.technical_feasibility_score && (
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold ${getScoreColor(idea.technical_feasibility_score)}`}>
                {idea.technical_feasibility_score}
              </div>
              <div className="text-xs text-gray-600 mt-1">Tech Feasibility</div>
            </div>
          )}
          
          {idea.go_to_market_difficulty && (
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold ${getDifficultyColor(idea.go_to_market_difficulty)}`}>
                {idea.go_to_market_difficulty}
              </div>
              <div className="text-xs text-gray-600 mt-1">GTM Difficulty</div>
            </div>
          )}
          
          {idea.development_timeline_months && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold text-gray-700 bg-gray-100 border border-gray-200">
                {Math.round(idea.development_timeline_months * 4.33)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Weeks to Build</div>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Projection */}
      {idea.revenue_projection && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('revenue')}
            className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span className="font-medium text-gray-900">Revenue Projections</span>
              <span className="ml-2 text-sm text-green-600 font-medium">
                {formatCurrency(idea.revenue_projection.monthly_recurring_revenue.month_12)} ARR
              </span>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.revenue ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.revenue && (
            <div className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                  <div className="text-sm text-green-700 font-medium">6 Months</div>
                  <div className="text-lg font-bold text-green-900">
                    {formatCurrency(idea.revenue_projection.monthly_recurring_revenue.month_6)}
                  </div>
                  <div className="text-xs text-green-600">MRR</div>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-sm text-blue-700 font-medium">12 Months</div>
                  <div className="text-lg font-bold text-blue-900">
                    {formatCurrency(idea.revenue_projection.monthly_recurring_revenue.month_12)}
                  </div>
                  <div className="text-xs text-blue-600">MRR</div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
                  <div className="text-sm text-purple-700 font-medium">24 Months</div>
                  <div className="text-lg font-bold text-purple-900">
                    {formatCurrency(idea.revenue_projection.monthly_recurring_revenue.month_24)}
                  </div>
                  <div className="text-xs text-purple-600">MRR</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">ARPU:</span>
                  <span className="ml-1 font-medium">{formatCurrency(idea.revenue_projection.average_revenue_per_user)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Churn:</span>
                  <span className="ml-1 font-medium">{idea.revenue_projection.churn_rate}%</span>
                </div>
                <div>
                  <span className="text-gray-500">CAC:</span>
                  <span className="ml-1 font-medium">{formatCurrency(idea.revenue_projection.customer_acquisition_cost)}</span>
                </div>
                <div>
                  <span className="text-gray-500">LTV:</span>
                  <span className="ml-1 font-medium">{formatCurrency(idea.revenue_projection.lifetime_value)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Competitive Landscape */}
      {idea.competitive_landscape && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('competitive')}
            className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium text-gray-900">Competitive Analysis</span>
              <span className="ml-2 text-sm text-blue-600 font-medium">
                Gap Score: {idea.competitive_landscape.market_gap_score}
              </span>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.competitive ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.competitive && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <h6 className="text-sm font-medium text-gray-900 mb-2">Direct Competitors</h6>
                <div className="flex flex-wrap gap-2">
                  {idea.competitive_landscape.direct_competitors.map((competitor, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {competitor}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h6 className="text-sm font-medium text-gray-900 mb-2">Differentiation Opportunities</h6>
                <ul className="space-y-1">
                  {idea.competitive_landscape.differentiation_opportunities.map((opportunity, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start">
                      <span className="text-green-500 mr-2 mt-1 text-xs">✓</span>
                      {opportunity}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <h6 className="text-sm font-medium text-blue-900 mb-1">Competitive Advantage</h6>
                <p className="text-sm text-blue-800">{idea.competitive_landscape.competitive_advantage}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Required Skills & Investment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Required Skills */}
        {idea.required_skills && idea.required_skills.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection('skills')}
              className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 text-indigo-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="font-medium text-gray-900">Required Skills ({idea.required_skills.length})</span>
              </div>
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.skills ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSections.skills && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {idea.required_skills.map((skill, index) => (
                    <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Investment Required */}
        {idea.investment_required && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="font-medium text-gray-900">Investment Required</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(idea.investment_required)}
              </span>
            </div>
            {idea.market_size_estimate && (
              <div className="mt-2 text-sm text-gray-600">
                Market Size: <span className="font-medium">{formatCurrency(idea.market_size_estimate)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}