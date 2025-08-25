"use client";

import { useState } from 'react';
import { IconSearch, IconFilter, IconRefresh, IconAdjustments, IconChevronDown, IconChevronUp } from '@tabler/icons-react';

export interface FilterState {
  searchQuery: string;
  scoreRange: [number, number];
  buildTimeRange: [number, number];
  industry: string;
  productType: string;
  difficulty: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface SearchAndFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  onSearchChange: (query: string) => void;
  totalResults: number;
}

const industryOptions = [
  { value: 'all', label: 'All Industries' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'education', label: 'Education' },
  { value: 'communication', label: 'Communication' },
  { value: 'automation', label: 'Automation' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'security', label: 'Security' },
];

const productTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'saas', label: 'SaaS Platform' },
  { value: 'webapp', label: 'Web Application' },
  { value: 'mobileapp', label: 'Mobile App' },
  { value: 'api', label: 'API Service' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'tool', label: 'Development Tool' },
  { value: 'plugin', label: 'Plugin/Extension' },
  { value: 'dashboard', label: 'Analytics Dashboard' },
];

const difficultyOptions = [
  { value: 'all', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner (1-3 months)' },
  { value: 'intermediate', label: 'Intermediate (3-6 months)' },
  { value: 'advanced', label: 'Advanced (6-12 months)' },
  { value: 'expert', label: 'Expert (12+ months)' },
];

const sortByOptions = [
  { value: 'score', label: 'Opportunity Score' },
  { value: 'development_timeline_months', label: 'Build Time' },
  { value: 'founder_market_fit_score', label: 'Founder-Market Fit' },
  { value: 'technical_feasibility_score', label: 'Technical Feasibility' },
];

export default function SearchAndFilters({
  onFiltersChange,
  onSearchChange,
  totalResults,
}: SearchAndFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    scoreRange: [0, 100],
    buildTimeRange: [1, 104],
    industry: 'all',
    productType: 'all',
    difficulty: 'all',
    sortBy: 'score',
    sortOrder: 'desc'
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    updateFilters({ searchQuery: query });
    onSearchChange(query);
  };

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      searchQuery: '',
      scoreRange: [0, 100],
      buildTimeRange: [1, 104],
      industry: 'all',
      productType: 'all',
      difficulty: 'all',
      sortBy: 'score',
      sortOrder: 'desc'
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
    onSearchChange('');
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.scoreRange[0] > 0 || filters.scoreRange[1] < 100) count++;
    if (filters.buildTimeRange[0] > 1 || filters.buildTimeRange[1] < 104) count++;
    if (filters.industry !== 'all') count++;
    if (filters.productType !== 'all') count++;
    if (filters.difficulty !== 'all') count++;
    return count;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-md flex items-center justify-center">
            <IconSearch size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Search & Filters</h3>
            <p className="text-sm text-gray-500">
              {totalResults} opportunities found
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getActiveFilterCount() > 0 && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
              {getActiveFilterCount()} active
            </span>
          )}
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <IconRefresh size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <IconSearch size={20} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, description, or features..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilters({ sortBy: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          {sortByOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        
        <select
          value={filters.sortOrder}
          onChange={(e) => updateFilters({ sortOrder: e.target.value as 'asc' | 'desc' })}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
        >
          <option value="desc">High to Low</option>
          <option value="asc">Low to High</option>
        </select>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors mb-4"
      >
        <IconAdjustments size={16} />
        Advanced Filters
        {showAdvanced ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
      </button>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Industry Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
              <select
                value={filters.industry}
                onChange={(e) => updateFilters({ industry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {industryOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {/* Product Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
              <select
                value={filters.productType}
                onChange={(e) => updateFilters({ productType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {productTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <select
                value={filters.difficulty}
                onChange={(e) => updateFilters({ difficulty: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {difficultyOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Range Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Score Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opportunity Score: {filters.scoreRange[0]} - {filters.scoreRange[1]}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={filters.scoreRange[0]}
                  onChange={(e) => updateFilters({ 
                    scoreRange: [parseInt(e.target.value), filters.scoreRange[1]] 
                  })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={filters.scoreRange[1]}
                  onChange={(e) => updateFilters({ 
                    scoreRange: [filters.scoreRange[0], parseInt(e.target.value)] 
                  })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            {/* Build Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Build Time: {Math.round(filters.buildTimeRange[0]/4.33)} - {Math.round(filters.buildTimeRange[1]/4.33)} months
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={104}
                  value={filters.buildTimeRange[0]}
                  onChange={(e) => updateFilters({ 
                    buildTimeRange: [parseInt(e.target.value), filters.buildTimeRange[1]] 
                  })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <input
                  type="range"
                  min={1}
                  max={104}
                  value={filters.buildTimeRange[1]}
                  onChange={(e) => updateFilters({ 
                    buildTimeRange: [filters.buildTimeRange[0], parseInt(e.target.value)] 
                  })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}