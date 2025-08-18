'use client'

import { useState, useEffect } from 'react'
import { Container, Stack, Title, Text } from '@mantine/core'
import { supabase } from '@/lib/supabase'
import { SaasIdeaItem } from '@/lib/supabase'
import SearchAndFilters, { FilterState } from '@/components/SearchAndFilters'
import DataTable from '@/components/DataTable'

export default function MarketIntelligencePage() {
  const [items, setItems] = useState<SaasIdeaItem[]>([])
  const [filteredItems, setFilteredItems] = useState<SaasIdeaItem[]>([])
  const [selectedItem, setSelectedItem] = useState<SaasIdeaItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    applyFilters(filters)
  }, [items, filters])

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
    } catch (error) {
      setError('Failed to fetch opportunities')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = (newFilters: FilterState) => {
    let filtered = items

    // Search filter
    if (newFilters.searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(newFilters.searchQuery.toLowerCase()) ||
        item.one_liner?.toLowerCase().includes(newFilters.searchQuery.toLowerCase()) ||
        item.core_features?.some(feature => 
          feature.toLowerCase().includes(newFilters.searchQuery.toLowerCase())
        )
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

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (newFilters.sortBy) {
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

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Title order={2} c="#F5F5F5">Market Intelligence Database</Title>
        <Text c="#CCCCCC">
          Explore validated SaaS opportunities with advanced filtering and analysis capabilities.
        </Text>
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
      </Stack>
    </Container>
  )
}