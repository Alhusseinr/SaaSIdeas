"use client";

import { useState, useEffect } from 'react'
import { 
  Card, 
  Text, 
  Button, 
  Group, 
  Stack, 
  Grid, 
  Box,
  Skeleton,
  Center,
  ThemeIcon,
  Alert
} from '@mantine/core'
import { 
  IconBolt, 
  IconAlertCircle, 
  IconMessage, 
  IconShare,
  IconEye,
  IconMail,
  IconClock
} from '@tabler/icons-react'
import { SaasIdeaItem } from '@/lib/supabase'
import { getTodaysValidatedOpportunity } from '@/lib/dailyIdea'

interface ProblemOfTheDayProps {
  onViewDetails: (idea: SaasIdeaItem) => void
}

export default function ProblemOfTheDay({ onViewDetails }: ProblemOfTheDayProps) {
  const [todaysProblem, setTodaysProblem] = useState<SaasIdeaItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTodaysProblem = async () => {
      try {
        setIsLoading(true)
        const idea = await getTodaysValidatedOpportunity()
        setTodaysProblem(idea)
      } catch (error) {
        console.error('Error fetching today\'s problem:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchTodaysProblem()
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 80) return { color: 'green', variant: 'light' };
    if (score >= 60) return { color: 'yellow', variant: 'light' };
    if (score >= 40) return { color: 'orange', variant: 'light' };
    return { color: 'red', variant: 'light' };
  };

  if (isLoading) {
    return (
      <Card 
        radius="xl" 
        p="xl" 
        withBorder
        style={{ 
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
          borderColor: '#404040'
        }}
      >
        <Group mb="md">
          <Skeleton height={32} width={32} radius="md" />
          <Skeleton height={24} width={200} radius="sm" />
        </Group>
        <Stack gap="sm">
          <Skeleton height={16} radius="sm" />
          <Skeleton height={16} width="75%" radius="sm" />
          <Skeleton height={40} width={128} radius="sm" />
        </Stack>
      </Card>
    )
  }

  if (!todaysProblem) {
    return (
      <Card 
        radius="xl" 
        p="xl" 
        withBorder
        style={{ 
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
          borderColor: '#404040'
        }}
      >
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size="xl" style={{ backgroundColor: '#404040', color: '#CCCCCC' }}>
              <IconAlertCircle size={32} />
            </ThemeIcon>
            <Text size="lg" fw={500} ta="center" c="#F5F5F5">No Problem Featured Today</Text>
            <Text c="#CCCCCC" ta="center">Check back tomorrow for a new validated opportunity!</Text>
          </Stack>
        </Center>
      </Card>
    )
  }

  return (
    <Card 
      radius="xl" 
      p="xl" 
      withBorder
      style={{ 
        background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
        borderColor: '#404040'
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group>
          <ThemeIcon 
            size="lg" 
            radius="md" 
            style={{ 
              background: 'linear-gradient(135deg, #C5A46D 0%, rgba(197, 164, 109, 0.8) 100%)',
              color: '#0D0D0D'
            }}
          >
            <IconBolt size={20} />
          </ThemeIcon>
          <div>
            <Text size="lg" fw={700} c="#C5A46D">Problem of the Day</Text>
            <Text size="sm" c="#CCCCCC">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </div>
        </Group>
        <ThemeIcon
          size="xl"
          radius="md"
          {...getScoreColor(todaysProblem.score)}
          style={{ fontSize: '14px', fontWeight: 700 }}
        >
          {todaysProblem.score}
        </ThemeIcon>
      </Group>

      {/* Problem Details */}
      <Box mb="xl">
        <Text size="xl" fw={700} mb="xs" lh={1.2} c="#F5F5F5">
          {todaysProblem.name}
        </Text>
        <Text c="#E5E5E5" lh={1.6} mb="md">
          {todaysProblem.one_liner}
        </Text>
        
        {/* Quick Stats */}
        <Grid mb="md">
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
              <Text ta="center" size="lg" fw={700} c="#006B3C">
                {todaysProblem.representative_post_ids?.length || 0}
              </Text>
              <Text ta="center" size="xs" c="#E5E5E5">User Complaints</Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#2A2A2A', borderColor: '#C5A46D' }}>
              <Text ta="center" size="lg" fw={700} c="#C5A46D">
                {Math.round((todaysProblem.development_timeline_months || 6) * 4.33)}w
              </Text>
              <Text ta="center" size="xs" c="#E5E5E5">Time to Build</Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
              <Text ta="center" size="lg" fw={700} c="#006B3C">
                {todaysProblem.revenue_projection ? 
                  `$${(todaysProblem.revenue_projection.monthly_recurring_revenue.month_12 / 1000).toFixed(0)}K` : 
                  '$50K'}
              </Text>
              <Text ta="center" size="xs" c="#E5E5E5">Year 1 ARR</Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#2A2A2A', borderColor: '#C5A46D' }}>
              <Text ta="center" size="lg" fw={700} c="#C5A46D">
                {todaysProblem.founder_market_fit_score || 75}
              </Text>
              <Text ta="center" size="xs" c="#E5E5E5">Founder Fit</Text>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Why Now */}
        {todaysProblem.why_now && (
          <Alert 
            style={{ 
              backgroundColor: '#2A2A2A',
              borderColor: '#C5A46D',
              color: '#F5F5F5'
            }}
            variant="light" 
            radius="md" 
            mb="md"
            icon={<IconClock size={16} color="#C5A46D" />}
            title="Why Now?"
          >
            <Text size="sm" lh={1.6} c="#E5E5E5">
              {todaysProblem.why_now}
            </Text>
          </Alert>
        )}
      </Box>

      {/* Actions */}
      <Group mb="md" grow>
        <Button
          onClick={() => onViewDetails(todaysProblem)}
          size="md"
          radius="md"
          leftSection={<IconEye size={20} />}
          style={{
            background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
            color: '#F5F5F5',
            border: 'none',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          Analyze This Opportunity
        </Button>
        
        <Button
          size="md"
          radius="md"
          leftSection={<IconShare size={20} />}
          style={{
            background: 'linear-gradient(135deg, #0A1F44 0%, rgba(10, 31, 68, 0.8) 100%)',
            color: '#F5F5F5',
            border: 'none'
          }}
        >
          Share
        </Button>
      </Group>

      {/* Email Signup Hint */}
      <Card withBorder radius="md" p="sm" style={{ backgroundColor: 'rgba(197, 164, 109, 0.1)', borderColor: '#C5A46D', backdropFilter: 'blur(10px)' }}>
        <Group gap="sm">
          <IconMail size={16} color="#C5A46D" />
          <Text size="sm">
            <Text component="span" fw={500} c="#F5F5F5">Want daily problems in your inbox?</Text>{' '}
            <Text component="span" c="#C5A46D" style={{ cursor: 'pointer' }}>
              Get email alerts →
            </Text>
          </Text>
        </Group>
      </Card>
    </Card>
  )
}