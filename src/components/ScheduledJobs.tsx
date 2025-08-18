'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  Stack,
  Group,
  Badge,
  Grid,
  Center,
  ThemeIcon,
  Alert,
  List,
  Loader,
  Box,
  Code
} from '@mantine/core'
import {
  IconClock,
  IconRefresh,
  IconPlayerPlay,
  IconAlertCircle,
  IconInfoCircle,
  IconCalendar,
  IconSettings,
  IconDatabase
} from '@tabler/icons-react'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'

interface ScheduledJob {
  id: string
  name: string
  description: string
  schedule: string
  function_name?: string
  sql_command?: string
  last_run?: string
  next_run?: string
  status: 'active' | 'inactive' | 'error'
  type: 'pg_cron' | 'edge_function' | 'external'
}

// Helper functions for user-friendly job information
const getUserFriendlyJobName = (jobname: string): string => {
  const jobMappings: Record<string, string> = {
    'daily-complete-refresh': '🔄 Daily Complete Pipeline',
    'midday-trend-update': '📈 Midday Trend Update',
    'monthly-cleanup': '🧹 Monthly Data Cleanup',
    // Legacy job names (deprecated)
    'daily-reddit-ingest': '🔄 Daily Reddit Ingestion (Legacy)',
    'hourly-enrich': '✨ Hourly Data Enrichment (Legacy)',
    'daily-negative-summary': '📊 Daily Negative Summary (Legacy)',
    'weekly-idea-generation': '💡 Weekly Idea Generation (Legacy)'
  }
  return jobMappings[jobname] || jobname
}

const getUserFriendlyJobDescription = (jobname: string): string => {
  const descriptionMappings: Record<string, string> = {
    'daily-complete-refresh': 'Runs complete pipeline: Reddit ingestion → Summarization → SaaS idea generation. Ensures fresh daily opportunities.',
    'midday-trend-update': 'Light trend update at noon to refresh trending ideas without full pipeline processing.',
    'monthly-cleanup': 'Archives old data and cleans up logs to maintain optimal database performance.',
    // Legacy descriptions
    'daily-reddit-ingest': 'Legacy: Fetches Reddit posts (replaced by daily-complete-refresh)',
    'hourly-enrich': 'Legacy: Enriches post data (replaced by daily-complete-refresh)',
    'daily-negative-summary': 'Legacy: Summarizes negative posts (replaced by daily-complete-refresh)',
    'weekly-idea-generation': 'Legacy: Generates ideas weekly (replaced by daily-complete-refresh)'
  }
  return descriptionMappings[jobname] || 'Automated database task'
}

const getHumanReadableSchedule = (cronSchedule: string): string => {
  const scheduleMap: Record<string, string> = {
    '0 6 * * *': 'Daily at 6:00 AM UTC',
    '0 12 * * *': 'Daily at 12:00 PM UTC',
    '0 2 1 * *': 'Monthly on 1st at 2:00 AM',
    // Legacy schedules
    '0 * * * *': 'Every hour (Legacy)',
    '0 20 * * *': 'Daily at 8:00 PM (Legacy)',
    '0 10 * * 0': 'Sundays at 10:00 AM (Legacy)'
  }
  return scheduleMap[cronSchedule] || cronSchedule
}

const getJobIcon = (jobname: string): string => {
  const iconMappings: Record<string, string> = {
    'daily-complete-refresh': '🔄',
    'midday-trend-update': '📈',
    'monthly-cleanup': '🧹',
    // Legacy icons
    'daily-reddit-ingest': '🔄',
    'hourly-enrich': '✨',
    'daily-negative-summary': '📊',
    'weekly-idea-generation': '💡'
  }
  return iconMappings[jobname] || '⚙️'
}

export default function ScheduledJobs() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(false)
  const [triggeringJobs, setTriggeringJobs] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const fetchPgCronJobs = async () => {
    try {
      // Use RPC to query cron jobs since direct table access might not work
      const { data, error } = await supabase.rpc('get_cron_jobs_info')
      
      if (error) {
        console.warn('Custom RPC not found, trying direct query:', error.message)
        
        // Fallback to direct SQL query
        const { data: directData, error: directError } = await supabase
          .rpc('exec_sql', { 
            query: 'SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobid' 
          })
        
        if (directError) {
          console.warn('Direct SQL query failed:', directError.message)
          return []
        }
        
        // Transform the results with user-friendly names and descriptions
        return (directData || []).map((job: any) => ({
          id: job.jobid?.toString() || job.jobname,
          name: getUserFriendlyJobName(job.jobname) || `Job ${job.jobid}`,
          description: getUserFriendlyJobDescription(job.jobname) || 'Database scheduled job',
          schedule: job.schedule || 'Unknown',
          sql_command: job.command,
          type: 'pg_cron' as const,
          status: (job.active ? 'active' : 'inactive') as 'active' | 'inactive',
          last_run: undefined,
          next_run: undefined
        }))
      }
      
      // Transform RPC data if successful with user-friendly names
      return (data || []).map((job: any) => ({
        id: job.jobid?.toString() || job.jobname,
        name: getUserFriendlyJobName(job.jobname) || `Job ${job.jobid}`,
        description: getUserFriendlyJobDescription(job.jobname) || 'Database scheduled job',
        schedule: job.schedule || 'Unknown',
        sql_command: job.command,
        type: 'pg_cron' as const,
        status: (job.active ? 'active' : 'inactive') as 'active' | 'inactive',
        last_run: job.last_run,
        next_run: undefined
      }))
    } catch (err) {
      console.warn('Could not fetch pg_cron jobs:', err)
      return []
    }
  }

  const fetchJobLogs = async () => {
    try {
      // Try to get job execution logs from a custom table
      const { data, error } = await supabase
        .from('job_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.warn('No job_logs table found:', error.message)
        return []
      }
      
      return data || []
    } catch (err) {
      console.warn('Could not fetch job logs:', err)
      return []
    }
  }

  const refreshJobs = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Fetch from multiple sources
      const [pgCronJobs, jobLogs] = await Promise.all([
        fetchPgCronJobs(),
        fetchJobLogs()
      ])
      
      let allJobs: ScheduledJob[] = [...pgCronJobs]
      
      // If no pg_cron jobs found, show message about setup
      if (allJobs.length === 0) {
        console.log('No scheduled jobs found. You may need to set up pg_cron or create job tracking tables.')
      }
      
      setJobs(allJobs)
    } catch (err: any) {
      setError('Failed to fetch scheduled jobs: ' + err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const triggerJobManually = async (job: ScheduledJob) => {
    // Only allow triggering of edge function jobs
    if (job.type !== 'edge_function' || !job.function_name) {
      setError('This job cannot be triggered manually')
      return
    }

    setTriggeringJobs(prev => new Set(prev).add(job.id))
    setError('')

    try {
      const result = await invokeEdgeFunction(job.function_name)
      console.log(`Manual trigger result for ${job.name}:`, result)
      
      // Update last run time
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { ...j, last_run: new Date().toISOString() }
          : j
      ))
    } catch (err: any) {
      setError(`Failed to trigger ${job.name}: ${err.message}`)
    } finally {
      setTriggeringJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(job.id)
        return newSet
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#006B3C'
      case 'inactive': return '#666666'
      case 'error': return '#FF6B6B'
      default: return '#666666'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pg_cron': return '#006B3C'
      case 'edge_function': return '#C5A46D'
      case 'external': return '#FF8C00'
      default: return '#666666'
    }
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  useEffect(() => {
    refreshJobs()
  }, [])

  return (
    <Container size="xl">
      <Stack gap="xl">
        {/* Header */}
        <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
          <Group justify="space-between">
            <Group>
              <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                <IconClock size={20} />
              </ThemeIcon>
              <div>
                <Title order={2} c="#F5F5F5">Scheduled Jobs</Title>
                <Text c="#CCCCCC" size="sm">Monitor and manage your automated tasks</Text>
              </div>
            </Group>
            <Button
              onClick={refreshJobs}
              loading={loading}
              leftSection={<IconRefresh size={16} />}
              style={{
                backgroundColor: '#2A2A2A',
                color: '#E5E5E5',
                borderColor: '#404040'
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Group>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            radius="md"
            style={{
              backgroundColor: '#2A2A2A',
              borderColor: '#FF6B6B',
              color: '#F5F5F5'
            }}
          >
            <Text c="#FF6B6B">{error}</Text>
          </Alert>
        )}

        {/* Jobs Grid */}
        <Grid>
          {jobs.map((job) => (
            <Grid.Col key={job.id} span={{ base: 12, sm: 6, lg: 4, xl: 3 }}>
              <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                {/* Header Section */}
                <Group mb="md">
                  <ThemeIcon 
                    size="lg" 
                    radius="md" 
                    style={{ backgroundColor: '#2A2A2A', color: '#F5F5F5' }}
                  >
                    <Text size="lg">{getJobIcon(job.id)}</Text>
                  </ThemeIcon>
                  <Box flex={1}>
                    <Text fw={600} c="#F5F5F5" size="sm" lineClamp={1}>{job.name}</Text>
                    <Text c="#CCCCCC" size="xs" lineClamp={2} lh={1.4}>{job.description}</Text>
                  </Box>
                </Group>

                {/* Schedule Section */}
                <Center mb="md">
                  <Badge
                    style={{ backgroundColor: '#2A2A2A', color: '#E5E5E5' }}
                    leftSection={<IconCalendar size={12} />}
                    size="sm"
                  >
                    {getHumanReadableSchedule(job.schedule)}
                  </Badge>
                </Center>

                {/* Last Run Info */}
                <Center mb="lg">
                  <Text size="xs" c="#666666">
                    📅 Last run: {formatDateTime(job.last_run)}
                  </Text>
                </Center>

                {/* Action Button */}
                {job.type === 'edge_function' && job.function_name ? (
                  <Button
                    onClick={() => triggerJobManually(job)}
                    disabled={triggeringJobs.has(job.id) || job.status !== 'active'}
                    fullWidth
                    size="sm"
                    radius="md"
                    leftSection={
                      triggeringJobs.has(job.id) ? (
                        <Loader size="xs" color="#F5F5F5" />
                      ) : (
                        <IconPlayerPlay size={14} />
                      )
                    }
                    style={{
                      backgroundColor: job.status !== 'active' ? '#666666' : '#006B3C',
                      color: '#F5F5F5',
                      border: 'none'
                    }}
                  >
                    {triggeringJobs.has(job.id) ? 'Running...' : 'Run Now'}
                  </Button>
                ) : (
                  <Group justify="space-between">
                    <Text size="xs" c="#666666" ta="center" flex={1}>Auto-scheduled</Text>
                    <Badge
                      style={{
                        backgroundColor: getStatusColor(job.status),
                        color: '#F5F5F5'
                      }}
                      size="xs"
                    >
                      {job.status}
                    </Badge>
                  </Group>
                )}
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        {/* Empty State */}
        {jobs.length === 0 && !loading && (
          <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
            <Center p="xl">
              <Stack align="center" gap="xl" maw={600}>
                <ThemeIcon size={80} radius="xl" style={{ backgroundColor: '#2A2A2A', color: '#CCCCCC' }}>
                  <IconClock size={40} />
                </ThemeIcon>
                <div style={{ textAlign: 'center' }}>
                  <Title order={3} c="#F5F5F5" mb="sm">No Scheduled Jobs</Title>
                  <Text c="#CCCCCC" mb="lg">
                    Set up automated tasks to run your Edge Functions on schedule.
                  </Text>
                </div>
                
                <Card withBorder radius="md" p="lg" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
                  <Group align="flex-start" gap="md">
                    <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                      <IconInfoCircle size={20} />
                    </ThemeIcon>
                    <Box flex={1}>
                      <Title order={4} c="#F5F5F5" mb="md">Quick Setup Guide</Title>
                      <List
                        spacing="sm"
                        size="sm"
                        icon={<Badge size="xs" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>•</Badge>}
                      >
                        <List.Item>
                          <Text c="#E5E5E5" size="sm">Go to your Supabase Dashboard → Database → Extensions</Text>
                        </List.Item>
                        <List.Item>
                          <Text c="#E5E5E5" size="sm">
                            Enable the <Code style={{ backgroundColor: '#1A1A1A', color: '#C5A46D' }}>pg_cron</Code> extension
                          </Text>
                        </List.Item>
                        <List.Item>
                          <Text c="#E5E5E5" size="sm">Run the SQL commands provided in the setup guide</Text>
                        </List.Item>
                        <List.Item>
                          <Text c="#E5E5E5" size="sm">Refresh this page to see your scheduled jobs</Text>
                        </List.Item>
                      </List>
                    </Box>
                  </Group>
                </Card>
              </Stack>
            </Center>
          </Card>
        )}
      </Stack>
    </Container>
  )
}