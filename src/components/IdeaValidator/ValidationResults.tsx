"use client";

import {
  IconBrain,
  IconChartBar,
  IconCheck,
  IconMessage,
  IconTag,
  IconTrendingUp,
  IconBulb,
} from "@tabler/icons-react";

interface ValidationResult {
  score: number;
  rationale: string;
  market_evidence: string[];
  competition_level: string;
  recommendations: string[];
  similar_complaints: number;
  keyword_matches: string[];
}

interface ValidationResultsProps {
  validationResult: ValidationResult;
}

export function ValidationResults({ validationResult }: ValidationResultsProps) {
  const getScoreColorClass = (score: number) => {
    if (score >= 80) return "bg-green-600";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getCompetitionColorClass = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low":
        return "bg-green-600";
      case "medium":
        return "bg-yellow-500";
      case "high":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-t-2xl border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white">
              <IconChartBar size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Validation Results
              </h2>
              <p className="text-white text-opacity-80 text-sm">
                AI analysis of your SaaS idea against market data
              </p>
            </div>
          </div>
          {validationResult.score && (
            <div className={`${getScoreColorClass(validationResult.score)} text-white px-5 py-3 rounded-lg text-xl font-bold`}>
              {validationResult.score}/100
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Score Rationale */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center text-white">
              <IconBrain size={16} />
            </div>
            <h4 className="text-lg font-semibold text-gray-900">
              Market Analysis
            </h4>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full ${getScoreColorClass(validationResult.score)}`}
              style={{ width: `${validationResult.score}%` }}
            ></div>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {validationResult.rationale}
          </p>
        </div>

        {/* Market Evidence */}
        {validationResult.market_evidence &&
          validationResult.market_evidence.length > 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <IconCheck size={16} className="text-green-600" />
                <h4 className="text-lg font-semibold text-gray-900">
                  Market Evidence Found
                </h4>
              </div>
              <ul className="space-y-2">
                {validationResult.market_evidence.map((evidence, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-1">▶</span>
                    <span className="text-gray-700">{evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {validationResult.competition_level && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 bg-yellow-500 rounded-md flex items-center justify-center text-gray-900">
                  <IconTrendingUp size={20} />
                </div>
                <div className="text-xs text-gray-600 uppercase font-bold tracking-wide">
                  Competition Level
                </div>
                <div className={`${getCompetitionColorClass(validationResult.competition_level)} text-white px-3 py-1 rounded-md text-sm font-medium`}>
                  {validationResult.competition_level}
                </div>
              </div>
            </div>
          )}

          {typeof validationResult.similar_complaints === "number" && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 bg-green-600 rounded-md flex items-center justify-center text-white">
                  <IconMessage size={20} />
                </div>
                <div className="text-xs text-gray-600 uppercase font-bold tracking-wide">
                  Similar Complaints
                </div>
                <div className="bg-green-600 text-white px-3 py-1 rounded-md text-sm font-medium">
                  {validationResult.similar_complaints} posts
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Keyword Matches */}
        {validationResult.keyword_matches &&
          validationResult.keyword_matches.length > 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <IconTag size={16} className="text-green-600" />
                <h4 className="text-lg font-semibold text-gray-900">
                  Matching Keywords Found
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {validationResult.keyword_matches.map((keyword, index) => (
                  <span
                    key={index}
                    className="bg-green-600 text-white px-3 py-1 rounded-md text-sm font-medium"
                  >
                    #{keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

        {/* Recommendations */}
        {validationResult.recommendations &&
          validationResult.recommendations.length > 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <IconBulb size={16} className="text-yellow-500" />
                <h4 className="text-lg font-semibold text-gray-900">
                  AI Recommendations
                </h4>
              </div>
              <ul className="space-y-2">
                {validationResult.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-yellow-500 font-bold mt-1">💡</span>
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </div>
  );
}