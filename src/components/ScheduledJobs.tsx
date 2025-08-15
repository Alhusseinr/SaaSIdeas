'use client'

import { useState, useEffect } from 'react'
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
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pg_cron': return 'bg-blue-100 text-blue-800'
      case 'edge_function': return 'bg-purple-100 text-purple-800'
      case 'external': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
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
    <div className="bg-white shadow-sm rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scheduled Jobs</h2>
            <p className="text-sm text-gray-600 mt-1">Monitor and manage your automated tasks</p>
          </div>
          <button
            onClick={refreshJobs}
            disabled={loading}
            className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-800 px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              {/* Header Section */}
              <div className="flex items-start space-x-3 mb-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                  {getJobIcon(job.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{job.name}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{job.description}</p>
                </div>
              </div>

              {/* Schedule Section */}
              <div className="text-center mb-3">
                <span className="text-xs text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                  ⏰ {getHumanReadableSchedule(job.schedule)}
                </span>
              </div>

              {/* Info Section */}
              <div className="flex items-center justify-center mb-4 text-xs text-gray-500">
                <span className="truncate">📅 {formatDateTime(job.last_run)}</span>
              </div>

              {/* Action Button */}
              {job.type === 'edge_function' && job.function_name ? (
                <button
                  onClick={() => triggerJobManually(job)}
                  disabled={triggeringJobs.has(job.id) || job.status !== 'active'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center space-x-2"
                  title={job.status !== 'active' ? 'Job is not active' : 'Run job now'}
                >
                  {triggeringJobs.has(job.id) ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-6L8 8" />
                      </svg>
                      <span>Run Now</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full bg-gray-50 text-gray-500 italic px-3 py-2 rounded-lg text-xs flex items-center justify-center space-x-2">
                  <span>Auto-scheduled</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {jobs.length === 0 && !loading && (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Scheduled Jobs</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Set up automated tasks to run your Edge Functions on schedule.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 max-w-2xl mx-auto">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-blue-900 mb-2">Quick Setup Guide</h4>
                  <ol className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start space-x-2">
                      <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                      <span>Go to your Supabase Dashboard → Database → Extensions</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                      <span>Enable the <code className="bg-blue-100 px-1 rounded">pg_cron</code> extension</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                      <span>Run the SQL commands provided in the setup guide</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                      <span>Refresh this page to see your scheduled jobs</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}