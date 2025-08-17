"use client";

import { useState } from 'react'

interface SearchAndFiltersProps {
  onSearchChange: (query: string) => void
  onFiltersChange: (filters: FilterState) => void
  totalResults: number
}

export interface FilterState {
  searchQuery: string
  scoreRange: [number, number]
  buildTimeRange: [number, number] // in weeks
  industry: string
  productType: string
  difficulty: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

const defaultFilters: FilterState = {
  searchQuery: '',
  scoreRange: [0, 100],
  buildTimeRange: [1, 104], // 1 week to 2 years
  industry: 'all',
  productType: 'all',
  difficulty: 'all',
  sortBy: 'score',
  sortOrder: 'desc'
}

export default function SearchAndFilters({ onSearchChange, onFiltersChange, totalResults }: SearchAndFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [isExpanded, setIsExpanded] = useState(false)

  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFiltersChange(newFilters)
    
    if (key === 'searchQuery') {
      onSearchChange(value)
    }
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
    onFiltersChange(defaultFilters)
    onSearchChange('')
  }

  const hasActiveFilters = () => {
    return (
      filters.searchQuery !== '' ||
      filters.scoreRange[0] !== 0 || filters.scoreRange[1] !== 100 ||
      filters.buildTimeRange[0] !== 1 || filters.buildTimeRange[1] !== 104 ||
      filters.industry !== 'all' ||
      filters.productType !== 'all' ||
      filters.difficulty !== 'all'
    )
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="px-6 pt-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search opportunities by name, description, or technology..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
            />
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium transition-colors ${
              hasActiveFilters() 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters() && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-100 bg-blue-600 rounded-full">
                !
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="m-6 p-6 rounded-lg bg-gray-50 border border-gray-200 shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Score Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Score Range: {filters.scoreRange[0]} - {filters.scoreRange[1]}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.scoreRange[0]}
                  onChange={(e) => updateFilter('scoreRange', [parseInt(e.target.value), filters.scoreRange[1]])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.scoreRange[1]}
                  onChange={(e) => updateFilter('scoreRange', [filters.scoreRange[0], parseInt(e.target.value)])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Build Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Build Time: {filters.buildTimeRange[0]}w - {filters.buildTimeRange[1]}w
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="1"
                  max="104"
                  value={filters.buildTimeRange[0]}
                  onChange={(e) => updateFilter('buildTimeRange', [parseInt(e.target.value), filters.buildTimeRange[1]])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="range"
                  min="1"
                  max="104"
                  value={filters.buildTimeRange[1]}
                  onChange={(e) => updateFilter('buildTimeRange', [filters.buildTimeRange[0], parseInt(e.target.value)])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
              <select
                value={filters.industry}
                onChange={(e) => updateFilter('industry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Industries</option>
                <option value="fintech">Fintech</option>
                <option value="healthcare">Healthcare</option>
                <option value="productivity">Productivity</option>
                <option value="ecommerce">E-commerce</option>
                <option value="marketing">Marketing</option>
                <option value="education">Education</option>
                <option value="communication">Communication</option>
                <option value="automation">Automation</option>
                <option value="analytics">Analytics</option>
                <option value="security">Security</option>
              </select>
            </div>

            {/* Product Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
              <select
                value={filters.productType}
                onChange={(e) => updateFilter('productType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="saas">SaaS Platform</option>
                <option value="webapp">Web Application</option>
                <option value="mobileapp">Mobile App</option>
                <option value="api">API/Service</option>
                <option value="chrome">Browser Extension</option>
                <option value="desktop">Desktop Software</option>
                <option value="ai">AI Tool</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
              <select
                value={filters.difficulty}
                onChange={(e) => updateFilter('difficulty', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner (1-3 months)</option>
                <option value="intermediate">Intermediate (3-8 months)</option>
                <option value="advanced">Advanced (8+ months)</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="score">Overall Score</option>
                <option value="development_timeline_months">Build Time</option>
                <option value="founder_market_fit_score">Founder Fit</option>
                <option value="technical_feasibility_score">Tech Feasibility</option>
                <option value="created_at">Recently Added</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => updateFilter('sortOrder', e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <button
              onClick={resetFilters}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Filters
            </button>
            
            <div className="text-sm text-gray-600">
              {hasActiveFilters() && `${totalResults} of total opportunities match your filters`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}