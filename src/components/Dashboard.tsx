'use client'

import { useState, useEffect } from 'react'
import { supabase, SaasIdeaItem } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DataTable from './DataTable'
import EdgeFunctions from './EdgeFunctions'
import ScheduledJobs from './ScheduledJobs'
import IdeaValidator from './IdeaValidator'
import SubscriptionPage from './SubscriptionPage'
import ProblemOfTheDay from './ProblemOfTheDay'
import TrendingProblems from './TrendingProblems'
import SearchAndFilters, { FilterState } from './SearchAndFilters'

type TabType = 'overview' | 'validator' | 'ideas' | 'jobs' | 'functions' | 'subscription'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [items, setItems] = useState<SaasIdeaItem[]>([])
  const [filteredItems, setFilteredItems] = useState<SaasIdeaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedItem, setSelectedItem] = useState<SaasIdeaItem | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    setError('')
    
    try {
      const { data, error } = await supabase
        .from('saas_idea_items')
        .select('*')
        .order('score', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setItems(data || [])
        setFilteredItems(data || [])
      }
    } catch (err) {
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const getTopScoreIdeas = () => filteredItems.filter(item => item.score >= 80)

  const applyFilters = (filters: FilterState) => {
    let filtered = [...items]

    // Search query filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.one_liner?.toLowerCase().includes(query) ||
        item.core_features?.some(feature => feature.toLowerCase().includes(query)) ||
        item.required_skills?.some(skill => skill.toLowerCase().includes(query))
      )
    }

    // Score range filter
    filtered = filtered.filter(item => 
      item.score >= filters.scoreRange[0] && item.score <= filters.scoreRange[1]
    )

    // Build time filter (convert months to weeks)
    filtered = filtered.filter(item => {
      const buildTimeWeeks = Math.round((item.development_timeline_months || 6) * 4.33)
      return buildTimeWeeks >= filters.buildTimeRange[0] && buildTimeWeeks <= filters.buildTimeRange[1]
    })

    // Industry filter (basic keyword matching)
    if (filters.industry !== 'all') {
      filtered = filtered.filter(item => {
        const content = `${item.name} ${item.one_liner} ${item.core_features?.join(' ')}`.toLowerCase()
        switch (filters.industry) {
          case 'fintech': return /fintech|finance|payment|banking|money|crypto|invest/.test(content)
          case 'healthcare': return /health|medical|doctor|patient|medicine|wellness/.test(content)
          case 'productivity': return /productiv|task|time|manage|organiz|workflow|efficiency/.test(content)
          case 'ecommerce': return /ecommerce|shop|store|retail|sell|buy|marketplace/.test(content)
          case 'marketing': return /market|advertis|campaign|social|brand|customer/.test(content)
          case 'education': return /educat|learn|teach|student|course|school/.test(content)
          case 'communication': return /chat|messag|email|communicat|social|connect/.test(content)
          case 'automation': return /automat|workflow|process|integrat|api/.test(content)
          case 'analytics': return /analytic|data|insight|report|dashboard|metric/.test(content)
          case 'security': return /security|auth|encrypt|protect|privacy|safe/.test(content)
          default: return true
        }
      })
    }

    // Product type filter (basic heuristics)
    if (filters.productType !== 'all') {
      filtered = filtered.filter(item => {
        const content = `${item.name} ${item.one_liner} ${item.core_features?.join(' ')}`.toLowerCase()
        switch (filters.productType) {
          case 'saas': return /platform|service|cloud|subscription|dashboard/.test(content)
          case 'webapp': return /web|app|browser|online|website/.test(content)
          case 'mobileapp': return /mobile|app|ios|android|phone/.test(content)
          case 'api': return /api|service|integration|webhook|endpoint/.test(content)
          case 'chrome': return /extension|browser|chrome|plugin|addon/.test(content)
          case 'desktop': return /desktop|software|application|install/.test(content)
          case 'ai': return /ai|machine learning|nlp|intelligence|predict/.test(content)
          default: return true
        }
      })
    }

    // Difficulty filter
    if (filters.difficulty !== 'all') {
      filtered = filtered.filter(item => {
        const buildTimeMonths = item.development_timeline_months || 6
        switch (filters.difficulty) {
          case 'beginner': return buildTimeMonths <= 3
          case 'intermediate': return buildTimeMonths > 3 && buildTimeMonths <= 8
          case 'advanced': return buildTimeMonths > 8
          default: return true
        }
      })
    }

    // Sort filtered results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (filters.sortBy) {
        case 'score':
          aValue = a.score
          bValue = b.score
          break
        case 'development_timeline_months':
          aValue = a.development_timeline_months || 6
          bValue = b.development_timeline_months || 6
          break
        case 'founder_market_fit_score':
          aValue = a.founder_market_fit_score || 0
          bValue = b.founder_market_fit_score || 0
          break
        case 'technical_feasibility_score':
          aValue = a.technical_feasibility_score || 0
          bValue = b.technical_feasibility_score || 0
          break
        case 'created_at':
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0
          break
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        default:
          aValue = a.score
          bValue = b.score
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredItems(filtered)
  }

  const handleSearchChange = (query: string) => {
    // Search handled in applyFilters
  }
  const getGoodIdeas = () => filteredItems.filter(item => item.score >= 60 && item.score < 80)
  const getRecentIdeas = () => filteredItems.slice(0, 5)

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'validator', name: 'Idea Validator', icon: '🔍' },
    { id: 'ideas', name: 'SaaS Ideas', icon: '💡' },
    { id: 'subscription', name: 'Subscription', icon: '💳' },
    { id: 'jobs', name: 'Data Pipeline', icon: '⚙️' },
    ...(process.env.NEXT_PUBLIC_SHOW_EDGE_FUNCTIONS === 'true' ? [{ id: 'functions', name: 'Edge Functions', icon: '🔧' }] : [])
  ]

  const handleViewDetails = (idea: SaasIdeaItem) => {
    setSelectedItem(idea)
    setActiveTab('ideas')
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Problem of the Day */}
      <ProblemOfTheDay onViewDetails={handleViewDetails} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-blue-700">{items.length}</span>
          </div>
          <h3 className="text-lg font-semibold text-blue-900 mb-1">Total Ideas</h3>
          <p className="text-blue-600 text-sm">Validated opportunities</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-green-700">{getTopScoreIdeas().length}</span>
          </div>
          <h3 className="text-lg font-semibold text-green-900 mb-1">High-Score Ideas</h3>
          <p className="text-green-600 text-sm">Score ≥ 80</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-yellow-700">{getGoodIdeas().length}</span>
          </div>
          <h3 className="text-lg font-semibold text-yellow-900 mb-1">Good Prospects</h3>
          <p className="text-yellow-600 text-sm">Score 60-79</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-purple-700">
              {items.length > 0 ? Math.round(items.reduce((acc, item) => acc + item.score, 0) / items.length) : 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-purple-900 mb-1">Avg Score</h3>
          <p className="text-purple-600 text-sm">Overall quality</p>
        </div>
      </div>

      {/* Trending Problems */}
      <TrendingProblems onViewDetails={handleViewDetails} />

      {/* Recent Ideas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent High-Value Ideas</h2>
            <button
              onClick={() => setActiveTab('ideas')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All →
            </button>
          </div>
        </div>
        <div className="p-6">
          {getRecentIdeas().length > 0 ? (
            <div className="space-y-4">
              {getRecentIdeas().map((idea) => (
                <div key={idea.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{idea.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{idea.one_liner}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      idea.score >= 80 ? 'bg-green-100 text-green-800' :
                      idea.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {idea.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No ideas yet</h3>
              <p className="text-gray-600">Start by running the data pipeline or validating new ideas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview()
      case 'validator':
        return <IdeaValidator />
      case 'ideas':
        return (
          <div className="bg-white shadow-sm rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  SaaS Ideas ({items.length})
                </h2>
                <button
                  onClick={fetchItems}
                  disabled={loading}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <svg
                    className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <SearchAndFilters 
              onSearchChange={handleSearchChange}
              onFiltersChange={applyFilters}
              totalResults={filteredItems.length}
            />
            <DataTable items={filteredItems} />
          </div>
        )
      case 'subscription':
        return <SubscriptionPage />
      case 'jobs':
        return <ScheduledJobs />
      case 'functions':
        return <EdgeFunctions />
      default:
        return renderOverview()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  IdeaValidator
                </h1>
                <p className="text-sm text-gray-600 hidden sm:block">AI-Powered SaaS Discovery Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Welcome, <span className="font-medium text-gray-900">{user?.email?.split('@')[0]}</span></span>
              </div>
              <button
                onClick={signOut}
                className="bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 transition-all duration-200"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Sign Out</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && activeTab === 'ideas' ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading SaaS ideas...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-lg font-medium text-red-900">Error Loading Data</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          renderTabContent()
        )}
      </main>
    </div>
  )
}