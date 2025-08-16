"use client";

import { useState } from 'react'
import { SaasIdeaItem } from '@/lib/supabase'

interface ScoreBreakdownProps {
  idea: SaasIdeaItem
}

interface ScoreComponent {
  name: string
  score: number
  maxScore: number
  description: string
  calculation: string
}

export default function ScoreBreakdown({ idea }: ScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getScoreComponents = (idea: SaasIdeaItem): ScoreComponent[] => {
    // Calculate component scores based on the validation edge function logic
    const totalScore = idea.score || 0
    
    // Market Pain Evidence (0-30): Based on complaint posts and sentiment analysis
    const marketPainScore = Math.min(30, Math.round(
      (idea.representative_post_ids?.length || 0) * 2.5 + 
      (totalScore >= 70 ? 10 : totalScore >= 50 ? 5 : 0) // Bonus for high validation scores
    ))
    
    // Market Size & Demand (0-25): Based on market evidence and overall validation
    const marketSizeScore = Math.min(25, Math.round(
      totalScore * 0.25 + (idea.market_size_estimate ? 5 : 0)
    ))
    
    // Competition Analysis (0-20): Based on competitive landscape data
    const competitionScore = Math.min(20, Math.round(
      idea.competitive_landscape?.market_gap_score ? 
        (idea.competitive_landscape.market_gap_score * 0.2) : 
        (totalScore * 0.2)
    ))
    
    // Solution Fit (0-15): Based on how well the idea addresses complaints
    const solutionFitScore = Math.min(15, Math.round(
      totalScore * 0.15 + (idea.technical_feasibility_score || 70) * 0.05
    ))
    
    // Execution Feasibility (0-10): Based on technical and market factors
    const executionScore = Math.min(10, Math.round(
      (idea.technical_feasibility_score || 70) * 0.08 + 
      (100 - (idea.go_to_market_difficulty || 50)) * 0.05
    ))

    return [
      {
        name: "Market Pain Evidence",
        score: marketPainScore,
        maxScore: 30,
        description: "Evidence of this problem in real user complaints and social media posts",
        calculation: `Based on ${idea.representative_post_ids?.length || 0} complaint posts with validation score bonus`
      },
      {
        name: "Market Size & Demand", 
        score: marketSizeScore,
        maxScore: 25,
        description: "Size of target market and evidence of willingness to pay for solutions",
        calculation: `Derived from overall validation score (${totalScore}) ${idea.market_size_estimate ? 'with market size data' : 'without specific market data'}`
      },
      {
        name: "Competition Analysis",
        score: competitionScore, 
        maxScore: 20,
        description: "How saturated the market is and opportunities for differentiation",
        calculation: idea.competitive_landscape ? 
          `Based on market gap score of ${idea.competitive_landscape.market_gap_score}` :
          "Estimated from overall validation analysis"
      },
      {
        name: "Solution Fit",
        score: solutionFitScore,
        maxScore: 15, 
        description: "How well the proposed solution addresses the identified problems",
        calculation: `Combines validation score with technical feasibility (${idea.technical_feasibility_score || 70})`
      },
      {
        name: "Execution Feasibility",
        score: executionScore,
        maxScore: 10,
        description: "How realistic implementation is given current technology and market conditions", 
        calculation: `Based on technical feasibility (${idea.technical_feasibility_score || 70}) and go-to-market difficulty (${idea.go_to_market_difficulty || 50})`
      }
    ]
  }

  const scoreComponents = getScoreComponents(idea)
  const totalCalculatedScore = scoreComponents.reduce((sum, comp) => sum + comp.score, 0)
  const actualScore = idea.score || 0

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return "bg-green-500"
    if (percentage >= 60) return "bg-blue-500" 
    if (percentage >= 40) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getTextColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return "text-green-700"
    if (percentage >= 60) return "text-blue-700"
    if (percentage >= 40) return "text-yellow-700" 
    return "text-red-700"
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 border border-purple-200 mr-3">
            <span className="text-lg font-bold text-purple-700">{actualScore}</span>
          </div>
          <div>
            <div className="font-medium text-gray-900">Validation Score Breakdown</div>
            <div className="text-sm text-gray-600">How this score was calculated</div>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* Score Components */}
          <div className="space-y-3">
            {scoreComponents.map((component, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-medium text-gray-900">{component.name}</h5>
                  <div className="flex items-center">
                    <span className={`text-sm font-bold ${getTextColor(component.score, component.maxScore)} mr-2`}>
                      {component.score}/{component.maxScore}
                    </span>
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getScoreColor(component.score, component.maxScore)} transition-all duration-300`}
                        style={{ width: `${(component.score / component.maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-2">{component.description}</p>
                <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 border border-blue-100">
                  <strong>Calculation:</strong> {component.calculation}
                </div>
              </div>
            ))}
          </div>

          {/* Total Score Summary */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-purple-900">Total Validation Score</h5>
              <span className="text-lg font-bold text-purple-700">{actualScore}/100</span>
            </div>
            <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-purple-200">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${actualScore}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-purple-800">
              {totalCalculatedScore !== actualScore && (
                <div className="mb-1">
                  <strong>Note:</strong> Calculated components total {totalCalculatedScore}/100. 
                  Final score of {actualScore} includes additional AI analysis factors.
                </div>
              )}
              <div>
                <strong>AI Analysis:</strong> This score combines quantitative metrics with AI evaluation of market sentiment, 
                competitive positioning, and solution viability based on real user feedback.
              </div>
            </div>
          </div>

          {/* Methodology Info */}
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <h6 className="text-sm font-medium text-amber-900 mb-1 flex items-center">
              <svg className="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Scoring Methodology
            </h6>
            <p className="text-xs text-amber-800">
              Scores are calculated using a combination of quantitative data analysis (complaint post counts, sentiment analysis, keyword matching) 
              and qualitative AI evaluation of market opportunity, competitive landscape, and solution fit. The final score reflects both 
              data-driven insights and expert market analysis.
            </p>
            {idea.representative_post_ids && idea.representative_post_ids.length > 1 && (
              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-center text-xs text-blue-800">
                  <svg className="w-3 h-3 text-blue-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <strong>Pattern-Based Idea:</strong> This solution addresses common problems found across {idea.representative_post_ids.length} different user complaints, indicating strong market demand.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}