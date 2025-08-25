'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  IconUser,
  IconLogout,
  IconDashboard,
  IconBulb,
  IconTable,
  IconSettings,
  IconBrain,
  IconTrendingUp,
  IconAlertCircle,
  IconChartBar,
  IconUsers,
  IconTarget,
  IconMenu2
} from '@tabler/icons-react'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<SaasIdeaItem[]>([])
  const [filteredItems, setFilteredItems] = useState<SaasIdeaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedItem, setSelectedItem] = useState<SaasIdeaItem | null>(null)
  const [navbarOpened, setNavbarOpened] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    scoreRange: [0, 100],
    buildTimeRange: [1, 104],
    industry: 'all',
    productType: 'all',
    difficulty: 'all',
    sortBy: 'score',
    sortOrder: 'desc'
  })

  // Initialize tab from URL on mount
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType
    if (tabFromUrl && ['overview', 'validator', 'ideas', 'jobs', 'functions', 'subscription'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])

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
      const errorMessage = 'Failed to fetch market intelligence data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getTopScoreIdeas = () => filteredItems.filter(item => item.score >= 80)
  const getMediumScoreIdeas = () => filteredItems.filter(item => item.score >= 60 && item.score < 80)
  const getTotalOpportunities = () => filteredItems.length

  const applyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    let filtered = [...items]

    // Search query filter
    if (newFilters.searchQuery.trim()) {
      const query = newFilters.searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.one_liner?.toLowerCase().includes(query) ||
        item.core_features?.some(feature => feature.toLowerCase().includes(query)) ||
        item.required_skills?.some(skill => skill.toLowerCase().includes(query))
      )
    }

    // Score range filter
    filtered = filtered.filter(item => 
      item.score >= newFilters.scoreRange[0] && item.score <= newFilters.scoreRange[1]
    )

    // Build time filter (convert months to weeks)
    filtered = filtered.filter(item => {
      const buildTimeWeeks = Math.round((item.development_timeline_months || 6) * 4.33)
      return buildTimeWeeks >= newFilters.buildTimeRange[0] && buildTimeWeeks <= newFilters.buildTimeRange[1]
    })

    // Industry filter with enhanced matching
    if (newFilters.industry !== 'all') {
      filtered = filtered.filter(item => {
        const content = `${item.name} ${item.one_liner} ${item.core_features?.join(' ')}`.toLowerCase()
        switch (newFilters.industry) {
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

    // Product type filter
    if (newFilters.productType !== 'all') {
      filtered = filtered.filter(item => {
        const content = `${item.name} ${item.one_liner} ${item.core_features?.join(' ')}`.toLowerCase()
        switch (newFilters.productType) {
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
    if (newFilters.difficulty !== 'all') {
      filtered = filtered.filter(item => {
        const buildTimeMonths = item.development_timeline_months || 6
        switch (newFilters.difficulty) {
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
      
      switch (newFilters.sortBy) {
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
        default:
          aValue = a.score
          bValue = b.score
      }

      return newFilters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })

    setFilteredItems(filtered)
  }

  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab)
    // Update URL with new tab
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set('tab', newTab)
    router.push(`?${newSearchParams.toString()}`)
  }

  const navigationItems = [
    { icon: IconDashboard, label: 'Strategic Overview', value: 'overview' },
    { icon: IconBrain, label: 'Opportunity Validator', value: 'validator' },
    { icon: IconTable, label: 'Market Intelligence', value: 'ideas' },
    { icon: IconSettings, label: 'System Operations', value: 'jobs' },
    { icon: IconTrendingUp, label: 'Edge Functions', value: 'functions' },
    { icon: IconUsers, label: 'Subscription Management', value: 'subscription' }
  ]

  const renderOverviewMetrics = () => {
    const totalOps = getTotalOpportunities()
    const highValue = getTopScoreIdeas().length
    const mediumValue = getMediumScoreIdeas().length
    const successRate = totalOps > 0 ? Math.round((highValue / totalOps) * 100) : 0

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-600 to-blue-600 rounded-2xl flex items-center justify-center">
              <IconTarget size={28} className="text-white" />
            </div>
            <div className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wide">
              Total Opportunities
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {totalOps.toLocaleString()}
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center relative">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="url(#gradient)"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(successRate / 100) * 175.929} 175.929`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-gray-900">
                {successRate}%
              </span>
            </div>
            <div className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wide">
              High-Value Rate
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {highValue.toLocaleString()}
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
              <IconChartBar size={28} className="text-white" />
            </div>
            <div className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wide">
              Medium-Value Ops
            </div>
            <div className="text-3xl font-bold text-orange-600">
              {mediumValue.toLocaleString()}
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl flex items-center justify-center">
              <IconBulb size={28} className="text-white" />
            </div>
            <div className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wide">
              Avg Validation Score
            </div>
            <div className="text-3xl font-bold text-gray-600">
              {totalOps > 0 ? Math.round(filteredItems.reduce((sum, item) => sum + item.score, 0) / totalOps) : 0}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="max-w-sm mx-auto py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="text-gray-600">Loading market intelligence data...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="max-w-sm mx-auto py-20">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <IconAlertCircle size={20} className="text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Error</h3>
            </div>
            <p className="text-red-700 mb-4">{error}</p>
            <button 
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              onClick={fetchItems}
            >
              Retry Load
            </button>
          </div>
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Strategic Market Overview</h2>
              <p className="text-lg text-gray-600 mb-8">
                Comprehensive analysis of validated SaaS opportunities and market intelligence metrics.
              </p>
              {renderOverviewMetrics()}
            </div>
            
            <div className="grid grid-cols-1 gap-8">
              <ProblemOfTheDay onViewDetails={(idea) => {
                setSelectedItem(idea);
                handleTabChange('ideas');
              }} />
              <TrendingProblems onViewDetails={(idea) => {
                setSelectedItem(idea);
                handleTabChange('ideas');
              }} />
            </div>
          </div>
        )
      
      case 'validator':
        return <IdeaValidator />
      
      case 'ideas':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Market Intelligence Database</h2>
              <p className="text-lg text-gray-600 mb-6">
                Explore validated SaaS opportunities with advanced filtering and analysis capabilities.
              </p>
            </div>
            <SearchAndFilters 
              onFiltersChange={applyFilters}
              onSearchChange={(query) => applyFilters({ ...filters, searchQuery: query })}
              totalResults={filteredItems.length}
            />
            <DataTable 
              items={filteredItems} 
              onItemSelect={setSelectedItem}
              selectedItem={selectedItem}
            />
          </div>
        )
      
      case 'jobs':
        return <ScheduledJobs />
      
      case 'functions':
        return <EdgeFunctions />
      
      case 'subscription':
        return <SubscriptionPage />
      
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                onClick={() => setNavbarOpened(!navbarOpened)}
              >
                <IconMenu2 size={20} />
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                SaaS Intelligence Platform
              </h1>
            </div>

            <div className="relative">
              <button
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => {
                  const dropdown = document.getElementById('user-menu')
                  if (dropdown) {
                    dropdown.classList.toggle('hidden')
                  }
                }}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                  <IconUser size={16} className="text-white" />
                </div>
              </button>
              
              <div id="user-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                  {user?.email || 'Strategic Analyst'}
                </div>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  onClick={signOut}
                >
                  <IconLogout size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <nav className={`${navbarOpened ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out shadow-sm lg:shadow-none`}>
          <div className="p-6 pt-4">
            <h2 className="text-xs text-gray-500 uppercase font-bold mb-6 tracking-wide">
              Navigation
            </h2>
            <div className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.value}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === item.value 
                      ? 'bg-gradient-to-r from-green-50 to-blue-50 text-green-700 shadow-sm border-l-4 border-green-500 transform scale-[1.02]' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:transform hover:scale-[1.01]'
                  }`}
                  onClick={() => handleTabChange(item.value as TabType)}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Overlay for mobile */}
        {navbarOpened && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setNavbarOpened(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 bg-gray-50 lg:ml-0 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  )
}