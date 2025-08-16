"use client";

import { useState } from 'react'
import { SaasIdeaItem } from '@/lib/supabase'
import ScoreMethodology from './ScoreMethodology'
import SourcePostsModal from './SourcePostsModal'
import ScoreBreakdown from './ScoreBreakdown'

interface EnhancedAnalysisProps {
  idea: SaasIdeaItem
  expandedSections: {[key: string]: boolean}
  toggleSection: (section: string) => void
}

export default function EnhancedAnalysis({ idea, expandedSections, toggleSection }: EnhancedAnalysisProps) {
  const [isSourcePostsModalOpen, setIsSourcePostsModalOpen] = useState(false)
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

  // Score methodology data
  const getScoreMethodology = (scoreName: string, score: number) => {
    switch (scoreName) {
      case 'Founder Fit':
        return {
          description: "Measures how well-suited a typical entrepreneur would be to tackle this opportunity based on required skills and market knowledge.",
          factors: [
            {
              name: "Technical Skills Required",
              weight: 30,
              value: Math.min(100, (idea.required_skills?.length || 3) * 20),
              explanation: "Based on number and complexity of technical skills needed"
            },
            {
              name: "Market Accessibility", 
              weight: 25,
              value: 100 - (idea.go_to_market_difficulty || 50),
              explanation: "How easy it is to reach and acquire customers in this market"
            },
            {
              name: "Domain Knowledge",
              weight: 25,
              value: Math.max(20, 100 - (idea.development_timeline_months || 6) * 10),
              explanation: "How much specialized industry knowledge is required"
            },
            {
              name: "Competition Level",
              weight: 20,
              value: idea.competitive_landscape?.market_gap_score || 60,
              explanation: "How crowded the competitive landscape is"
            }
          ],
          calculation: "(Technical×0.3 + Market×0.25 + Domain×0.25 + Competition×0.2)"
        };
      case 'Tech Feasibility':
        return {
          description: "Evaluates how technically achievable this solution is for a small team with modern development tools.",
          factors: [
            {
              name: "Development Complexity",
              weight: 40,
              value: Math.max(20, 100 - (idea.development_timeline_months || 6) * 12),
              explanation: "Based on estimated development timeline and feature complexity"
            },
            {
              name: "Infrastructure Requirements",
              weight: 30,
              value: idea.core_features?.length ? Math.min(100, 120 - (idea.core_features.length * 15)) : 70,
              explanation: "Complexity of required backend systems and integrations"
            },
            {
              name: "Technology Maturity",
              weight: 20,
              value: 85,
              explanation: "Availability of tools, frameworks, and third-party services"
            },
            {
              name: "Scalability Challenges",
              weight: 10,
              value: Math.min(100, (idea.market_size_estimate || 1000000) / 50000),
              explanation: "Technical challenges that arise as the solution scales"
            }
          ],
          calculation: "(Complexity×0.4 + Infrastructure×0.3 + Maturity×0.2 + Scale×0.1)"
        };
      case 'GTM Difficulty':
        return {
          description: "Assesses how challenging it will be to find, reach, and convert customers for this solution.",
          factors: [
            {
              name: "Customer Acquisition Cost",
              weight: 35,
              value: idea.revenue_projection ? Math.min(100, 150 - (idea.revenue_projection.customer_acquisition_cost / 10)) : 60,
              explanation: "Estimated cost to acquire each paying customer"
            },
            {
              name: "Market Education Needed",
              weight: 25,
              value: Math.max(30, 100 - (idea.development_timeline_months || 6) * 8),
              explanation: "How much you need to educate the market about the problem/solution"
            },
            {
              name: "Sales Cycle Length",
              weight: 25,
              value: idea.revenue_projection ? Math.min(100, 200 - (idea.revenue_projection.average_revenue_per_user / 5)) : 70,
              explanation: "Time from first contact to paying customer"
            },
            {
              name: "Channel Availability",
              weight: 15,
              value: 75,
              explanation: "Number of effective marketing/sales channels available"
            }
          ],
          calculation: "(CAC×0.35 + Education×0.25 + SalesCycle×0.25 + Channels×0.15)"
        };
      default:
        return {
          description: "This score is calculated using proprietary algorithms based on market data and user feedback patterns.",
          factors: [],
          calculation: "Proprietary algorithm"
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Score Breakdown */}
      <ScoreBreakdown idea={idea} />
      
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
            <ScoreMethodology 
              scoreName="Founder Fit"
              score={idea.founder_market_fit_score}
              methodology={getScoreMethodology('Founder Fit', idea.founder_market_fit_score)}
            />
          )}
          
          {idea.technical_feasibility_score && (
            <ScoreMethodology 
              scoreName="Tech Feasibility"
              score={idea.technical_feasibility_score}
              methodology={getScoreMethodology('Tech Feasibility', idea.technical_feasibility_score)}
            />
          )}
          
          {idea.go_to_market_difficulty && (
            <ScoreMethodology 
              scoreName="GTM Difficulty"
              score={idea.go_to_market_difficulty}
              methodology={getScoreMethodology('GTM Difficulty', idea.go_to_market_difficulty)}
            />
          )}
          
          {idea.development_timeline_months && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold text-gray-700 bg-gray-100 border border-gray-200">
                {Math.round(idea.development_timeline_months * 4.33)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Weeks to Build</div>
              <div className="text-xs text-blue-600 cursor-pointer">
                Based on {idea.development_timeline_months}mo timeline
              </div>
            </div>
          )}
        </div>
        
        {/* Source Posts Section */}
        {idea.representative_post_ids && idea.representative_post_ids.length > 0 && (
          <div className="mt-4 flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <span className="font-medium text-gray-900">Source Complaints</span>
                <div className="text-xs text-gray-600">
                  {idea.representative_post_ids.length} real user posts analyzed
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsSourcePostsModalOpen(true)}
              className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Source Posts
            </button>
          </div>
        )}
      </div>

      {/* Market Opportunity Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('market')}
          className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="font-medium text-gray-900">Market Opportunity</span>
            {idea.market_size_estimate && (
              <span className="ml-2 text-sm text-green-600 font-medium">
                {formatCurrency(idea.market_size_estimate)} TAM
              </span>
            )}
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.market ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSections.market && (
          <div className="px-4 pb-4 space-y-4">
            {/* User Demand Indicators */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h5 className="text-sm font-medium text-blue-900 mb-2">Real User Demand</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Complaint Posts:</span>
                  <span className="ml-1 font-medium text-blue-900">
                    {idea.representative_post_ids?.length || 0} users
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Problem Urgency:</span>
                  <span className="ml-1 font-medium text-blue-900">
                    {idea.score >= 80 ? 'High' : idea.score >= 60 ? 'Medium' : 'Low'}
                  </span>
                </div>
              </div>
            </div>

            {/* Market Size Breakdown */}
            {idea.market_size_estimate && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                  <div className="text-sm text-green-700 font-medium">Total Market</div>
                  <div className="text-lg font-bold text-green-900">
                    {formatCurrency(idea.market_size_estimate)}
                  </div>
                  <div className="text-xs text-green-600">TAM Estimate</div>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-sm text-blue-700 font-medium">Addressable</div>
                  <div className="text-lg font-bold text-blue-900">
                    {formatCurrency(Math.round(idea.market_size_estimate * 0.1))}
                  </div>
                  <div className="text-xs text-blue-600">~10% SAM</div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
                  <div className="text-sm text-purple-700 font-medium">Initial Target</div>
                  <div className="text-lg font-bold text-purple-900">
                    {formatCurrency(Math.round(idea.market_size_estimate * 0.01))}
                  </div>
                  <div className="text-xs text-purple-600">~1% SOM</div>
                </div>
              </div>
            )}
            
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <h6 className="text-sm font-medium text-amber-900 mb-1 flex items-center">
                <svg className="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Market Size Methodology
              </h6>
              <p className="text-xs text-amber-800">
                Market estimates are derived from similar SaaS solutions, industry reports, and user complaint volume analysis. 
                These are directional indicators, not precise revenue forecasts.
              </p>
            </div>
          </div>
        )}
      </div>

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

        {/* Investment Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('investment')}
            className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span className="font-medium text-gray-900">Investment Estimate</span>
            </div>
            <div className="flex items-center">
              {idea.investment_required && (
                <span className="text-lg font-bold text-gray-900 mr-2">
                  {formatCurrency(idea.investment_required)}
                </span>
              )}
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.investment ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {expandedSections.investment && (
            <div className="px-4 pb-4 space-y-4">
              {/* Cost Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h6 className="text-sm font-medium text-gray-900">Development Costs</h6>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Development Time:</span>
                      <span className="font-medium">{idea.development_timeline_months || 6} months</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimated Dev Cost:</span>
                      <span className="font-medium">{formatCurrency((idea.development_timeline_months || 6) * 8000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Infrastructure/Tools:</span>
                      <span className="font-medium">{formatCurrency(500 * (idea.development_timeline_months || 6))}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h6 className="text-sm font-medium text-gray-900">Launch Costs</h6>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Marketing/Launch:</span>
                      <span className="font-medium">{formatCurrency(5000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Legal/Business:</span>
                      <span className="font-medium">{formatCurrency(2000)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Working Capital:</span>
                      <span className="font-medium">{formatCurrency(3000)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <h6 className="text-sm font-medium text-amber-900 mb-1 flex items-center">
                  <svg className="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Investment Calculation Method
                </h6>
                <p className="text-xs text-amber-800">
                  Estimates based on: Development timeline × $8K/month (freelancer/contractor rate) + infrastructure costs + standard launch expenses. 
                  Costs can vary significantly based on team composition and scope changes.
                </p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <h6 className="text-sm font-medium text-green-900 mb-1">Bootstrap-Friendly Approach</h6>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>• Start with MVP and validate core assumptions first</li>
                  <li>• Use no-code/low-code tools to reduce development costs</li>
                  <li>• Begin with manual processes before automating</li>
                  <li>• Focus on one core feature initially</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Source Posts Modal */}
      <SourcePostsModal
        ideaId={String(idea.id)}
        isOpen={isSourcePostsModalOpen}
        onClose={() => setIsSourcePostsModalOpen(false)}
        representativePostIds={idea.representative_post_ids?.map(String) || undefined}
      />
    </div>
  );
}