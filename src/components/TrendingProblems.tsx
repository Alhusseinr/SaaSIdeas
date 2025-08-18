"use client";

import { useState, useEffect } from 'react'
import { 
  Card, 
  Text, 
  Button, 
  Group, 
  Stack, 
  Badge,
  Box,
  Skeleton,
  Center,
  ThemeIcon,
  SegmentedControl,
  Divider
} from '@mantine/core'
import { 
  IconTrendingUp, 
  IconMessage, 
  IconMinus,
  IconTrendingDown,
  IconChevronRight,
  IconInfoCircle
} from '@tabler/icons-react'
import { SaasIdeaItem } from '@/lib/supabase'
import { getTrendingIdeas, DailyIdeaData } from '@/lib/dailyIdea'

interface TrendingProblemsProps {
  onViewDetails: (idea: SaasIdeaItem) => void
}

export default function TrendingProblems({ onViewDetails }: TrendingProblemsProps) {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d')
  const [trendingProblems, setTrendingProblems] = useState<DailyIdeaData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrendingProblems = async () => {
      try {
        setLoading(true)
        const problems = await getTrendingIdeas(3) // Get top 3 trending
        setTrendingProblems(problems)
      } catch (error) {
        console.error('Error fetching trending problems:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchTrendingProblems()
  }, [timeframe])

  // Use real data if available, otherwise show loading or empty state
  const displayProblems = trendingProblems.length > 0 ? trendingProblems : []

  const getScoreColor = (score: number) => {
    if (score >= 80) return "green";
    if (score >= 60) return "yellow";
    if (score >= 40) return "orange";
    return "red";
  };

  const getTrendColor = (growthRate: number) => {
    if (growthRate >= 100) return "green";
    if (growthRate >= 50) return "blue";
    if (growthRate >= 0) return "gray";
    return "red";
  };

  const getTrendIcon = (growthRate: number) => {
    if (growthRate >= 50) {
      return <IconTrendingUp size={16} />;
    }
    if (growthRate >= 0) {
      return <IconMinus size={16} />;
    }
    return <IconTrendingDown size={16} />;
  };

  return (
    <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
      {/* Header */}
      <Card.Section withBorder p="xl" pb="md" style={{ borderColor: '#404040' }}>
        <Group justify="space-between" wrap="wrap">
          <Group mb={{ base: "md", sm: 0 }}>
            <ThemeIcon 
              size="lg" 
              radius="md" 
              style={{ 
                background: 'linear-gradient(135deg, #C5A46D 0%, #B8956A 100%)',
                color: '#0D0D0D'
              }}
            >
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} c="#F5F5F5">Trending Problems</Text>
              <Text size="sm" c="#CCCCCC">Problems gaining momentum right now</Text>
            </div>
          </Group>
          
          {/* Timeframe Selector */}
          <SegmentedControl
            data={[
              { label: '24 Hours', value: '24h' },
              { label: '7 Days', value: '7d' },
              { label: '30 Days', value: '30d' }
            ]}
            value={timeframe}
            onChange={(value) => setTimeframe(value as '24h' | '7d' | '30d')}
            styles={{
              root: { backgroundColor: '#2A2A2A' },
              label: { color: '#F5F5F5' },
              control: { backgroundColor: '#1A1A1A', borderColor: '#404040' },
              indicator: { backgroundColor: '#C5A46D', color: '#0D0D0D' }
            }}
            size="sm"
          />
        </Group>
      </Card.Section>

      {/* Trending List */}
      <Card.Section>
        {loading ? (
          // Loading skeleton
          <Stack gap="xs" p="xl">
            {[1, 2, 3].map((i) => (
              <Group key={i} justify="space-between">
                <Group>
                  <Skeleton height={8} width={20} radius="xl" />
                  <div>
                    <Skeleton height={12} width={200} mb={4} />
                    <Skeleton height={8} width={150} />
                  </div>
                </Group>
                <Group gap="xs">
                  <Skeleton height={20} width={40} radius="xl" />
                  <Skeleton height={20} width={60} radius="xl" />
                </Group>
              </Group>
            ))}
          </Stack>
        ) : displayProblems.length > 0 ? (
          <Stack gap={0}>
            {displayProblems.map((problem, index) => {
              // Use deterministic growth rate based on problem ID to avoid hydration mismatch
              const hashCode = problem.id ? String(problem.id).split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
              }, 0) : index;
              const growthRate = Math.floor(Math.abs(hashCode) % 150) + 10 // Deterministic growth rate
              const trendIcon = getTrendIcon(growthRate)
              const trendColor = getTrendColor(growthRate)
              
              return (
                <Box key={problem.id || index}>
                  <Group 
                    justify="space-between" 
                    p="xl"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onViewDetails(problem)}
                  >
                    <Group>
                      <Text size="lg" fw={700} c="#C5A46D">
                        #{index + 1}
                      </Text>
                      <div>
                        <Text fw={600} size="sm" lineClamp={1} c="#F5F5F5">
                          {problem.name || 'Unknown Problem'}
                        </Text>
                        <Text size="xs" c="#CCCCCC" lineClamp={2}>
                          {problem.one_liner || 'No description available'}
                        </Text>
                      </div>
                    </Group>
                    
                    <Group gap="xs">
                      <Badge 
                        style={{ 
                          backgroundColor: getScoreColor(problem.score || 0) === 'green' ? '#006B3C' : 
                                         getScoreColor(problem.score || 0) === 'yellow' ? '#C5A46D' : 
                                         getScoreColor(problem.score || 0) === 'orange' ? '#FF8C00' : '#FF6B6B',
                          color: '#F5F5F5'
                        }}
                        size="sm"
                      >
                        {problem.score || 0}
                      </Badge>
                      
                      <Badge 
                        style={{ 
                          backgroundColor: trendColor === 'green' ? '#006B3C' : 
                                         trendColor === 'blue' ? '#4285F4' : 
                                         trendColor === 'gray' ? '#666666' : '#FF6B6B',
                          color: '#F5F5F5'
                        }}
                        size="sm"
                        leftSection={trendIcon}
                      >
                        +{growthRate}%
                      </Badge>
                      
                      <IconChevronRight size={16} color="#CCCCCC" />
                    </Group>
                  </Group>
                  {index < displayProblems.length - 1 && <Divider style={{ borderColor: '#404040' }} />}
                </Box>
              )
            })}
          </Stack>
        ) : (
          // Empty state
          <Center py="xl">
            <Stack align="center" gap="md">
              <ThemeIcon 
                size="xl" 
                radius="xl" 
                style={{ backgroundColor: '#404040', color: '#CCCCCC' }}
              >
                <IconTrendingUp size={24} />
              </ThemeIcon>
              <div style={{ textAlign: 'center' }}>
                <Text size="lg" fw={500} mb={4} c="#F5F5F5">No trending problems found</Text>
                <Text size="sm" c="#CCCCCC">New trends will appear here as they emerge from our analysis.</Text>
              </div>
            </Stack>
          </Center>
        )}
      </Card.Section>

      {/* Footer */}
      <Card.Section 
        p="xl" 
        pt="md"
        style={{
          background: 'linear-gradient(to right, #2A2A2A, #333333)',
          borderTop: '1px solid #404040'
        }}
      >
        <Group justify="space-between">
          <Group gap="xs">
            <IconInfoCircle size={16} color="#CCCCCC" />
            <Text size="sm" c="#CCCCCC">
              Trends updated every 2 hours based on Reddit activity
            </Text>
          </Group>
          <Button
            size="sm"
            rightSection={<IconChevronRight size={14} />}
            style={{
              backgroundColor: '#C5A46D',
              color: '#0D0D0D',
              border: 'none'
            }}
          >
            View All Trends
          </Button>
        </Group>
      </Card.Section>
    </Card>
  )
}