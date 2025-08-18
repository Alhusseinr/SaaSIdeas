'use client'

import { useState, useEffect } from 'react'
import { Container, Stack, Title, Text, Grid } from '@mantine/core'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { SaasIdeaItem } from '@/lib/supabase'
import ProblemOfTheDay from '@/components/ProblemOfTheDay'
import TrendingProblems from '@/components/TrendingProblems'

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

  const renderOverviewMetrics = () => {
    const totalOpportunities = items.length
    const highValueOpportunities = items.filter(item => item.score >= 80).length
    const averageScore = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0

    return (
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <div style={{ 
            padding: '20px', 
            borderRadius: '12px', 
            backgroundColor: '#1A1A1A', 
            border: '1px solid #404040',
            textAlign: 'center'
          }}>
            <Text size="xl" fw={700} c="#C5A46D">{totalOpportunities}</Text>
            <Text size="sm" c="#CCCCCC">Total Opportunities</Text>
          </div>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <div style={{ 
            padding: '20px', 
            borderRadius: '12px', 
            backgroundColor: '#1A1A1A', 
            border: '1px solid #404040',
            textAlign: 'center'
          }}>
            <Text size="xl" fw={700} c="#006B3C">{highValueOpportunities}</Text>
            <Text size="sm" c="#CCCCCC">High-Value Ideas</Text>
          </div>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <div style={{ 
            padding: '20px', 
            borderRadius: '12px', 
            backgroundColor: '#1A1A1A', 
            border: '1px solid #404040',
            textAlign: 'center'
          }}>
            <Text size="xl" fw={700} c="#F5F5F5">{averageScore}</Text>
            <Text size="sm" c="#CCCCCC">Average Score</Text>
          </div>
        </Grid.Col>
      </Grid>
    )
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} c="#F5F5F5" mb="xs">Strategic Overview</Title>
          <Text c="#CCCCCC" size="lg">
            Intelligence Dashboard for Market Opportunity Analysis
          </Text>
          {renderOverviewMetrics()}
        </div>
        
        <Grid>
          <Grid.Col span={{ base: 12 }}>
            <ProblemOfTheDay />
          </Grid.Col>
          <Grid.Col span={{ base: 12 }}>
            <TrendingProblems />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  )
}