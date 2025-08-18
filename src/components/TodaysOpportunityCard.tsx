"use client";

import { useState, useEffect } from 'react'
import { 
  Card, 
  Text, 
  Badge, 
  Button, 
  Group, 
  Stack, 
  Grid, 
  Box,
  Loader,
  Center,
  Modal,
  Skeleton,
  Alert,
  ActionIcon,
  Tooltip,
  ThemeIcon
} from '@mantine/core'
import { 
  IconMessage, 
  IconTrendingUp, 
  IconClock, 
  IconAlertTriangle,
  IconCheck,
  IconBolt,
  IconX
} from '@tabler/icons-react'
import { getTodaysValidatedOpportunity, DailyIdeaData } from '@/lib/dailyIdea'
import ScoreBreakdown from './ScoreBreakdown'

interface TodaysOpportunityCardProps {
  onGetStarted?: (planId?: string) => void
}

export default function TodaysOpportunityCard({ onGetStarted }: TodaysOpportunityCardProps) {
  const [todaysIdea, setTodaysIdea] = useState<DailyIdeaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)

  useEffect(() => {
    const fetchTodaysIdea = async () => {
      try {
        setLoading(true)
        setError(null)
        const idea = await getTodaysValidatedOpportunity()
        setTodaysIdea(idea)
      } catch (err) {
        console.error('Error fetching today\'s idea:', err)
        setError('Failed to load today\'s opportunity')
      } finally {
        setLoading(false)
      }
    }

    fetchTodaysIdea()
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 80) return { color: 'green', variant: 'light' };
    if (score >= 60) return { color: 'yellow', variant: 'light' };
    if (score >= 40) return { color: 'orange', variant: 'light' };
    return { color: 'red', variant: 'light' };
  };

  const formatRevenue = (revenue: number) => {
    if (revenue >= 1000000) return `$${(revenue / 1000000).toFixed(1)}M`
    if (revenue >= 1000) return `$${(revenue / 1000).toFixed(0)}K`
    return `$${revenue}`
  }

  const getMarketDemandLabel = (complaints: number) => {
    if (complaints >= 40) return "High"
    if (complaints >= 20) return "Medium"
    return "Low"
  }

  if (loading) {
    return (
      <Card shadow="xl" radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
        <Card.Section>
          <Box bg="linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)" p="xl">
            <Group justify="space-between" mb="md">
              <Skeleton height={24} width={128} radius="xl" />
              <Skeleton height={16} width={80} radius="sm" />
            </Group>
            <Group align="flex-start" justify="space-between">
              <Box flex={1} pr="md">
                <Skeleton height={24} width="75%" radius="sm" mb="xs" />
                <Skeleton height={16} width="50%" radius="sm" />
              </Box>
              <Skeleton height={64} width={64} radius="xl" />
            </Group>
          </Box>
        </Card.Section>
        
        <Card.Section p="xl">
          <Skeleton height={16} radius="sm" mb="xl" />
          <Grid mb="xl">
            {[...Array(4)].map((_, i) => (
              <Grid.Col key={i} span={6}>
                <Skeleton height={80} radius="md" />
              </Grid.Col>
            ))}
          </Grid>
          <Skeleton height={48} radius="md" />
        </Card.Section>
      </Card>
    )
  }

  if (error || !todaysIdea) {
    return (
      <Card shadow="xl" radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
        <Center p="xl">
          <Stack align="center" gap="md">
            <ThemeIcon size="xl" style={{ backgroundColor: '#404040', color: '#CCCCCC' }}>
              <IconAlertTriangle size={32} />
            </ThemeIcon>
            <Text size="lg" fw={500} ta="center" c="#F5F5F5">Unable to load today's opportunity</Text>
            <Text c="#CCCCCC" ta="center">Please try again later</Text>
          </Stack>
        </Center>
      </Card>
    )
  }

  return (
    <Card shadow="xl" radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
      {/* Header with Badge */}
      <Card.Section>
        <Box bg="linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)" p="xl">
          <Group justify="space-between" mb="md">
            <Badge 
              style={{ backgroundColor: 'rgba(245, 245, 245, 0.2)' }}
              variant="filled"
              radius="xl"
              leftSection={
                <Box 
                  w={8} 
                  h={8} 
                  style={{ 
                    backgroundColor: todaysIdea.isNew ? "#C5A46D" : "#006B3C",
                    borderRadius: '50%',
                    animation: todaysIdea.isNew ? 'pulse 2s infinite' : 'none'
                  }}
                />
              }
            >
              <Text c="#F5F5F5" size="sm" fw={500}>
                {todaysIdea.isNew ? "Fresh Today" : "Today's Pick"}
              </Text>
            </Badge>
            <Text c="rgba(245, 245, 245, 0.7)" size="xs">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </Group>
          
          <Group align="flex-start" justify="space-between">
            <Box flex={1} pr="md">
              <Text size="xl" fw={700} c="#F5F5F5" mb="xs" lh={1.2}>
                {todaysIdea.name}
              </Text>
              <Group gap="lg">
                <Group gap="xs">
                  <IconMessage size={16} color="rgba(245, 245, 245, 0.8)" />
                  <Text c="rgba(245, 245, 245, 0.8)" size="sm">
                    {todaysIdea.userComplaints} user complaints
                  </Text>
                </Group>
                <Group gap="xs">
                  <IconTrendingUp size={16} color="rgba(245, 245, 245, 0.8)" />
                  <Text c="rgba(245, 245, 245, 0.8)" size="sm">
                    {todaysIdea.isNew ? "Just discovered" : "Trending this week"}
                  </Text>
                </Group>
              </Group>
            </Box>
            <Tooltip label="Click to see score breakdown">
              <ActionIcon
                onClick={() => setShowScoreBreakdown(true)}
                size={64}
                radius="md"
                {...getScoreColor(todaysIdea.score)}
                style={{ 
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  ':hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              >
                {todaysIdea.score}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>
      </Card.Section>

      {/* Content */}
      <Card.Section p="xl">
        <Text c="#E5E5E5" lh={1.6} mb="xl">
          {todaysIdea.one_liner}
        </Text>

        {/* Key Metrics Grid */}
        <Grid mb="xl">
          <Grid.Col span={6}>
            <Card 
              withBorder 
              radius="md" 
              p="md" 
              style={{ 
                background: 'linear-gradient(135deg, #0F4C3A 0%, #006B3C 100%)',
                borderColor: '#006B3C'
              }}
            >
              <Text ta="center" size="xl" fw={700} c="#F5F5F5">
                {formatRevenue(todaysIdea.yearOneRevenue)}
              </Text>
              <Text ta="center" size="sm" c="#E5E5E5">Year 1 Revenue</Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={6}>
            <Card 
              withBorder 
              radius="md" 
              p="md" 
              style={{ 
                background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                borderColor: '#C5A46D'
              }}
            >
              <Text ta="center" size="xl" fw={700} c="#C5A46D">
                {todaysIdea.buildTime}w
              </Text>
              <Text ta="center" size="sm" c="#E5E5E5">Time to Build</Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={6}>
            <Card 
              withBorder 
              radius="md" 
              p="md" 
              style={{ 
                background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                borderColor: '#C5A46D'
              }}
            >
              <Text ta="center" size="xl" fw={700} c="#C5A46D">
                {todaysIdea.founderFit}
              </Text>
              <Text ta="center" size="sm" c="#E5E5E5">Founder Fit</Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={6}>
            <Card 
              withBorder 
              radius="md" 
              p="md" 
              style={{ 
                background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                borderColor: '#C5A46D'
              }}
            >
              <Text ta="center" size="xl" fw={700} c="#C5A46D">
                {getMarketDemandLabel(todaysIdea.userComplaints)}
              </Text>
              <Text ta="center" size="sm" c="#E5E5E5">Market Demand</Text>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Why Now Section */}
        {todaysIdea.why_now && (
          <Alert 
            style={{ 
              backgroundColor: '#2A2A2A',
              borderColor: '#C5A46D',
              color: '#F5F5F5'
            }}
            variant="light" 
            radius="md" 
            mb="xl"
            icon={<IconClock size={16} color="#C5A46D" />}
            title="Why This Opportunity is Hot"
          >
            <Text size="sm" lh={1.6} c="#E5E5E5">
              {todaysIdea.why_now}
            </Text>
          </Alert>
        )}

        {/* Call to Action */}
        <Button
          fullWidth
          size="lg"
          radius="md"
          style={{
            background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
            color: '#F5F5F5',
            border: 'none',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onClick={() => onGetStarted?.('pro')}
        >
          Get Full Analysis & Implementation Plan
        </Button>

        {/* Trust Indicators */}
        <Group justify="center" gap="xl" pt="lg" mt="md" style={{ borderTop: '1px solid #404040' }}>
          <Group gap="xs">
            <IconCheck size={12} color="#006B3C" />
            <Text size="xs" c="#CCCCCC">AI Validated</Text>
          </Group>
          <Group gap="xs">
            <IconBolt size={12} color="#006B3C" />
            <Text size="xs" c="#CCCCCC">Real Demand</Text>
          </Group>
          <Group gap="xs">
            <IconClock size={12} color="#C5A46D" />
            <Text size="xs" c="#CCCCCC">Updated Daily</Text>
          </Group>
        </Group>
      </Card.Section>

      {/* Score Breakdown Modal */}
      <Modal
        opened={showScoreBreakdown}
        onClose={() => setShowScoreBreakdown(false)}
        title={
          <Group>
            <ActionIcon
              size="lg"
              radius="md"
              {...getScoreColor(todaysIdea.score)}
              style={{ fontSize: '14px', fontWeight: 700 }}
            >
              {todaysIdea.score}
            </ActionIcon>
            <div>
              <Text size="lg" fw={600}>{todaysIdea.name}</Text>
              <Text size="sm" c="dimmed">Score breakdown and calculation details</Text>
            </div>
          </Group>
        }
        size="xl"
        radius="md"
        centered
        styles={{
          body: { maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }
        }}
      >
        <ScoreBreakdown idea={todaysIdea} />
      </Modal>
    </Card>
  )
}