"use client";

import { useState } from 'react'

interface ScoreMethodologyProps {
  scoreName: string
  score: number
  methodology: {
    description: string
    factors: Array<{
      name: string
      weight: number
      value: number
      explanation: string
    }>
    calculation: string
  }
}

export default function ScoreMethodology({ scoreName, score, methodology }: ScoreMethodologyProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-700 bg-green-100 border-green-200";
    if (score >= 60) return "text-blue-700 bg-blue-100 border-blue-200";
    if (score >= 40) return "text-yellow-700 bg-yellow-100 border-yellow-200";
    return "text-red-700 bg-red-100 border-red-200";
  }

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-sm font-bold ${getScoreColor(score)}`}>
          {score}
        </div>
        <div>
          <div className="text-xs text-gray-600">{scoreName}</div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center"
          >
            How is this calculated?
            <svg className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 w-80 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-gray-900 mb-1">{scoreName} Methodology</h4>
              <p className="text-sm text-gray-600">{methodology.description}</p>
            </div>
            
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-800">Factors:</h5>
              {methodology.factors.map((factor, index) => (
                <div key={index} className="bg-gray-50 rounded p-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-gray-700">{factor.name}</span>
                    <span className="text-sm text-gray-900">{factor.value}/100</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">{factor.explanation}</div>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${factor.value}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">Weight: {factor.weight}%</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-blue-50 rounded p-2 border border-blue-200">
              <h5 className="text-sm font-medium text-blue-900 mb-1">Calculation:</h5>
              <p className="text-xs text-blue-800 font-mono">{methodology.calculation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}