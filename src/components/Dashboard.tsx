'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Card,
  Stack,
  Badge,
  Tabs,
  Box,
  AppShell,
  Avatar,
  Menu,
  ActionIcon,
  Loader,
  Alert,
  Grid,
  Paper,
  RingProgress,
  SimpleGrid,
  ThemeIcon
} from '@mantine/core'
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
  IconTarget
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
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
        notifications.show({
          title: 'Error',
          message: 'Failed to fetch market opportunities',
          color: 'red'
        })
      } else {
        setItems(data || [])
        setFilteredItems(data || [])
        notifications.show({
          title: 'Success',
          message: `Loaded ${data?.length || 0} market opportunities`,
          color: 'green'
        })
      }
    } catch (err) {
      const errorMessage = 'Failed to fetch market intelligence data'
      setError(errorMessage)
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red'
      })
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
      <Card 
        p="xl" 
        radius="xl" 
        withBorder 
        style={{ 
          backgroundColor: 'linear-gradient(135deg, rgb(26, 26, 26) 0%, rgb(42, 42, 42) 100%)', 
          borderColor: 'rgba(138, 141, 145, 0.3)', 
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)', 
          backdropFilter: 'blur(10px)' 
        }}
      >
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size={60} radius="xl" style={{ backgroundColor: '#4A9B8E', color: '#F5F5F5' }}>
              <IconTarget size={30} />
            </ThemeIcon>
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="#8A8D91" tt="uppercase" fw={700} mb="xs">
                Total Opportunities
              </Text>
              <Text fw={700} size="xl" c="#ffffffff">
                {totalOps.toLocaleString()}
              </Text>
            </div>
          </Stack>

          <Stack align="center" gap="sm">
            <RingProgress
              size={60}
              thickness={4}
              sections={[{ value: successRate, color: '#5DADE2' }]}
              label={
                <Text ta="center" size="sm" fw={500} c="#ffffffff">
                  {successRate}%
                </Text>
              }
            />
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="#8A8D91" tt="uppercase" fw={700} mb="xs">
                High-Value Rate
              </Text>
              <Text fw={700} size="xl" c="#5DADE2">
                {highValue.toLocaleString()}
              </Text>
            </div>
          </Stack>

          <Stack align="center" gap="sm">
            <ThemeIcon size={60} radius="xl" style={{ backgroundColor: '#D4A574', color: '#0D0D0D' }}>
              <IconChartBar size={30} />
            </ThemeIcon>
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="#8A8D91" tt="uppercase" fw={700} mb="xs">
                Medium-Value Ops
              </Text>
              <Text fw={700} size="xl" c="#D4A574">
                {mediumValue.toLocaleString()}
              </Text>
            </div>
          </Stack>

          <Stack align="center" gap="sm">
            <ThemeIcon size={60} radius="xl" style={{ backgroundColor: '#A8A8A8', color: '#0D0D0D' }}>
              <IconBulb size={30} />
            </ThemeIcon>
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="#8A8D91" tt="uppercase" fw={700} mb="xs">
                Avg Validation Score
              </Text>
              <Text fw={700} size="xl" c="#A8A8A8">
                {totalOps > 0 ? Math.round(filteredItems.reduce((sum, item) => sum + item.score, 0) / totalOps) : 0}
              </Text>
            </div>
          </Stack>
        </SimpleGrid>
      </Card>
    )
  }

  const renderTabContent = () => {
    if (loading) {
      return (
        <Container size="sm" py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#006B3C" />
            <Text c="#F5F5F5">Loading market intelligence data...</Text>
          </Stack>
        </Container>
      )
    }

    if (error) {
      return (
        <Container size="sm" py="xl">
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="Error" 
            style={{ 
              backgroundColor: 'rgba(13, 13, 13, 0.95)',
              borderColor: '#FF6B6B',
              color: '#F5F5F5',
              backdropFilter: 'blur(10px)'
            }}
          >
            {error}
            <Button 
              style={{ 
                backgroundColor: '#FF6B6B',
                color: '#F5F5F5',
                border: 'none'
              }}
              size="sm" 
              mt="md" 
              onClick={fetchItems}
            >
              Retry Load
            </Button>
          </Alert>
        </Container>
      )
    }

    switch (activeTab) {
      case 'overview':
        return (
          <Stack gap="xl">
            <div>
              <Title order={2} mb="md" c="#F5F5F5">Strategic Market Overview</Title>
              <Text c="#CCCCCC" mb="xl">
                Comprehensive analysis of validated SaaS opportunities and market intelligence metrics.
              </Text>
              {renderOverviewMetrics()}
            </div>
            
            <Grid>
              <Grid.Col span={{ base: 12 }}>
                <ProblemOfTheDay onViewDetails={(idea) => {
                  setSelectedItem(idea);
                  setActiveTab('ideas');
                }} />
              </Grid.Col>
              <Grid.Col span={{ base: 12 }}>
                <TrendingProblems onViewDetails={(idea) => {
                  setSelectedItem(idea);
                  setActiveTab('ideas');
                }} />
              </Grid.Col>
            </Grid>
          </Stack>
        )
      
      case 'validator':
        return <IdeaValidator />
      
      case 'ideas':
        return (
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
    <AppShell
      header={{ height: 70 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !navbarOpened },
      }}
      padding="md"
      styles={{
        header: { backgroundColor: '#0D0D0D', borderBottom: '1px solid rgba(138, 141, 145, 0.2)' },
        navbar: { backgroundColor: '#0D0D0D', borderRight: '1px solid rgba(138, 141, 145, 0.2)' },
        main: { 
          background: 'linear-gradient(135deg, #0D0D0D 0%, rgba(10, 31, 68, 0.3) 50%, rgba(138, 141, 145, 0.15) 100%)',
          minHeight: '100vh'
        }
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <ActionIcon
              variant="subtle"
              onClick={() => setNavbarOpened(!navbarOpened)}
              hiddenFrom="sm"
              style={{ color: '#F5F5F5' }}
            >
              <IconDashboard size={18} />
            </ActionIcon>
            <Title order={3} style={{
              background: 'linear-gradient(135deg, #006B3C 0%, #C5A46D 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              SaaS Intelligence Platform
            </Title>
          </Group>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" style={{ color: '#F5F5F5' }}>
                <Avatar size="sm" radius="xl" style={{ background: 'linear-gradient(135deg, #006B3C 0%, #C5A46D 100%)' }}>
                  <IconUser size={18} color="#0D0D0D" />
                </Avatar>
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown style={{ backgroundColor: '#0D0D0D', borderColor: 'rgba(138, 141, 145, 0.2)' }}>
              <Menu.Label style={{ color: '#8A8D91' }}>Account Management</Menu.Label>
              <Menu.Item>
                <Text size="sm" fw={500} c="#F5F5F5">
                  {user?.email || 'Strategic Analyst'}
                </Text>
              </Menu.Item>
              <Menu.Divider style={{ borderColor: 'rgba(138, 141, 145, 0.2)' }} />
              <Menu.Item 
                leftSection={<IconLogout size={14} />}
                onClick={signOut}
                style={{ color: '#FF6B6B' }}
              >
                Sign Out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <Text size="xs" c="#8A8D91" tt="uppercase" fw={700} mb="md">
            Navigation
          </Text>
          {navigationItems.map((item) => (
            <Button
              key={item.value}
              variant={activeTab === item.value ? "light" : "subtle"}
              style={{
                background: activeTab === item.value ? 'linear-gradient(135deg, #0A1F44 0%, rgba(10, 31, 68, 0.8) 100%)' : 'transparent',
                color: activeTab === item.value ? '#F5F5F5' : '#8A8D91',
                border: 'none',
                borderLeft: activeTab === item.value ? '3px solid #C5A46D' : '3px solid transparent'
              }}
              justify="flex-start"
              leftSection={<item.icon size={18} />}
              onClick={() => setActiveTab(item.value as TabType)}
              fullWidth
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl">
          {renderTabContent()}
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}