'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { SaasIdeaItem } from '@/lib/supabase'
import { IconTrendingUp, IconTarget, IconRocket, IconBrain } from '@tabler/icons-react'

// Simple Tailwind versions of components for now
function ProblemOfTheDayTailwind({ onViewDetails }: { onViewDetails: (idea: SaasIdeaItem) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Problem of the Day</h3>
      <div className="text-center text-gray-500">
        <p>Loading today's opportunity...</p>
      </div>
    </div>
  )
}

function TrendingProblemsTailwind({ onViewDetails }: { onViewDetails: (idea: SaasIdeaItem) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Trending Problems</h3>
      <div className="text-center text-gray-500">
        <p>Loading trending opportunities...</p>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<SaasIdeaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('saas_idea_items')
        .select('*')
        .order('score', { ascending: false })

      if (error) {
        console.error('Error fetching items:', error)
      } else {
        setItems(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalOpportunities = items.length
  const highValueOpportunities = items.filter(item => item.score >= 80).length
  const averageScore = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0
  const recentOpportunities = items.filter(item => {
    const itemDate = new Date(item.created_at)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return itemDate >= sevenDaysAgo
  }).length

  const metrics = [
    {
      title: 'Total Opportunities',
      value: totalOpportunities.toLocaleString(),
      icon: IconTarget,
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'increase'
    },
    {
      title: 'High-Value Opportunities',
      value: highValueOpportunities.toLocaleString(),
      icon: IconRocket,
      color: 'bg-green-500',
      change: '+8%',
      changeType: 'increase'
    },
    {
      title: 'Average Opportunity Score',
      value: `${averageScore}/100`,
      icon: IconBrain,
      color: 'bg-purple-500',
      change: '+5%',
      changeType: 'increase'
    },
    {
      title: 'New This Week',
      value: recentOpportunities.toLocaleString(),
      icon: IconTrendingUp,
      color: 'bg-yellow-500',
      change: '+23%',
      changeType: 'increase'
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Strategic Overview</h1>
          <p className="text-gray-400">Monitor your SaaS opportunity intelligence and market insights</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Strategic Overview</h1>
        <p className="text-gray-400">Monitor your SaaS opportunity intelligence and market insights</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className={`w-12 h-12 ${metric.color} rounded-xl flex items-center justify-center`}>
                <metric.icon size={24} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ProblemOfTheDayTailwind onViewDetails={(idea) => console.log('View details:', idea)} />
        <TrendingProblemsTailwind onViewDetails={(idea) => console.log('View details:', idea)} />
      </div>
    </div>
  )
}