"use client";

import { useState } from 'react'
import { 
  TextInput, 
  Button, 
  Group, 
  Stack, 
  Grid, 
  Select,
  RangeSlider,
  Box,
  Card,
  Text,
  Badge,
  ActionIcon,
  Collapse
} from '@mantine/core'
import { 
  IconSearch, 
  IconFilter, 
  IconRefresh, 
  IconAdjustments
} from '@tabler/icons-react'

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
    <Box>
      {/* Search Bar */}
      <Box>
        <Group>
          <TextInput
            flex={1}
            placeholder="Search opportunities by name, description, or technology..."
            leftSection={<IconSearch size={18} />}
            value={filters.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
            radius="md"
            size="md"
            styles={{
              input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' }
            }}
          />
          
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant={hasActiveFilters() ? "light" : "default"}
            color={hasActiveFilters() ? "emerald" : "gray"}
            leftSection={<IconFilter size={18} />}
            rightSection={
              hasActiveFilters() && (
                <Badge size="xs" color="emerald" variant="filled" style={{ marginLeft: 4 }}>
                  !
                </Badge>
              )
            }
            radius="md"
            size="md"
          >
            Filters
          </Button>
        </Group>
      </Box>

      {/* Advanced Filters */}
      <Collapse in={isExpanded}>
        <Box mt="md">
          <Card withBorder radius="lg" p="xl" bg="#1A1A1A" style={{ borderColor: '#404040' }}>
            <Grid mb="md">
              {/* Score Range */}
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <Stack gap="sm">
                  <Text size="sm" fw={500} c="#F5F5F5">
                    Score Range: {filters.scoreRange[0]} - {filters.scoreRange[1]}
                  </Text>
                  <RangeSlider
                    min={0}
                    max={100}
                    value={filters.scoreRange}
                    onChange={(value) => updateFilter('scoreRange', value)}
                    color="emerald"
                    size="md"
                  />
                </Stack>
              </Grid.Col>

              {/* Build Time Range */}
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <Stack gap="sm">
                  <Text size="sm" fw={500} c="#F5F5F5">
                    Build Time: {filters.buildTimeRange[0]}w - {filters.buildTimeRange[1]}w
                  </Text>
                  <RangeSlider
                    min={1}
                    max={104}
                    value={filters.buildTimeRange}
                    onChange={(value) => updateFilter('buildTimeRange', value)}
                    color="emerald"
                    size="md"
                  />
                </Stack>
              </Grid.Col>

              {/* Industry */}
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <Select
                  label="Industry"
                  value={filters.industry}
                  onChange={(value) => updateFilter('industry', value)}
                  data={[
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
                    { value: 'security', label: 'Security' }
                  ]}
                  radius="md"
                  styles={{
                    label: { color: '#F5F5F5' },
                    input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                    dropdown: { backgroundColor: '#2A2A2A', borderColor: '#404040' },
                    option: { color: '#F5F5F5' }
                  }}
                />
              </Grid.Col>

              {/* Product Type */}
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <Select
                  label="Product Type"
                  value={filters.productType}
                  onChange={(value) => updateFilter('productType', value)}
                  data={[
                    { value: 'all', label: 'All Types' },
                    { value: 'saas', label: 'SaaS Platform' },
                    { value: 'webapp', label: 'Web Application' },
                    { value: 'mobileapp', label: 'Mobile App' },
                    { value: 'api', label: 'API/Service' },
                    { value: 'chrome', label: 'Browser Extension' },
                    { value: 'desktop', label: 'Desktop Software' },
                    { value: 'ai', label: 'AI Tool' }
                  ]}
                  radius="md"
                  styles={{
                    label: { color: '#F5F5F5' },
                    input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                    dropdown: { backgroundColor: '#2A2A2A', borderColor: '#404040' },
                    option: { color: '#F5F5F5' }
                  }}
                />
              </Grid.Col>
            </Grid>

            <Grid mb="md">
              {/* Difficulty */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  label="Difficulty Level"
                  value={filters.difficulty}
                  onChange={(value) => updateFilter('difficulty', value)}
                  data={[
                    { value: 'all', label: 'All Levels' },
                    { value: 'beginner', label: 'Beginner (1-3 months)' },
                    { value: 'intermediate', label: 'Intermediate (3-8 months)' },
                    { value: 'advanced', label: 'Advanced (8+ months)' }
                  ]}
                  radius="md"
                  styles={{
                    label: { color: '#F5F5F5' },
                    input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                    dropdown: { backgroundColor: '#2A2A2A', borderColor: '#404040' },
                    option: { color: '#F5F5F5' }
                  }}
                />
              </Grid.Col>

              {/* Sort By */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  label="Sort By"
                  value={filters.sortBy}
                  onChange={(value) => updateFilter('sortBy', value)}
                  data={[
                    { value: 'score', label: 'Overall Score' },
                    { value: 'development_timeline_months', label: 'Build Time' },
                    { value: 'founder_market_fit_score', label: 'Founder Fit' },
                    { value: 'technical_feasibility_score', label: 'Tech Feasibility' },
                    { value: 'created_at', label: 'Recently Added' },
                    { value: 'name', label: 'Name (A-Z)' }
                  ]}
                  radius="md"
                  styles={{
                    label: { color: '#F5F5F5' },
                    input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                    dropdown: { backgroundColor: '#2A2A2A', borderColor: '#404040' },
                    option: { color: '#F5F5F5' }
                  }}
                />
              </Grid.Col>

              {/* Sort Order */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  label="Sort Order"
                  value={filters.sortOrder}
                  onChange={(value) => updateFilter('sortOrder', value as 'asc' | 'desc')}
                  data={[
                    { value: 'desc', label: 'High to Low' },
                    { value: 'asc', label: 'Low to High' }
                  ]}
                  radius="md"
                  styles={{
                    label: { color: '#F5F5F5' },
                    input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                    dropdown: { backgroundColor: '#2A2A2A', borderColor: '#404040' },
                    option: { color: '#F5F5F5' }
                  }}
                />
              </Grid.Col>
            </Grid>

            {/* Actions */}
            <Group justify="space-between" align="center">
              <Button
                onClick={resetFilters}
                variant="default"
                leftSection={<IconRefresh size={16} />}
                radius="md"
                size="sm"
              >
                Reset Filters
              </Button>
              
              {hasActiveFilters() && (
                <Text size="sm" c="#CCCCCC">
                  {totalResults} of total opportunities match your filters
                </Text>
              )}
            </Group>
          </Card>
        </Box>
      </Collapse>
    </Box>
  )
}