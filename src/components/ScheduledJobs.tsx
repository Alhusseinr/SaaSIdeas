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
        
        // Transform the results
        return (directData || []).map((job: any) => ({
          id: job.jobid?.toString() || job.jobname,
          name: job.jobname || `Job ${job.jobid}`,
          description: job.command || 'Database scheduled job',
          schedule: job.schedule || 'Unknown',
          sql_command: job.command,
          type: 'pg_cron' as const,
          status: (job.active ? 'active' : 'inactive') as 'active' | 'inactive',
          last_run: undefined,
          next_run: undefined
        }))
      }
      
      // Transform RPC data if successful
      return (data || []).map((job: any) => ({
        id: job.jobid?.toString() || job.jobname,
        name: job.jobname || `Job ${job.jobid}`,
        description: job.command || 'Database scheduled job',
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
    if (!job.function_name) {
      setError('Cannot trigger this job type manually')
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

        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-medium text-gray-900">{job.name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(job.type)}`}>
                      {job.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{job.description}</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div><strong>Schedule:</strong> {job.schedule}</div>
                    <div><strong>Last Run:</strong> {formatDateTime(job.last_run)}</div>
                    <div><strong>Next Run:</strong> {formatDateTime(job.next_run)}</div>
                    {job.function_name && (
                      <div><strong>Function:</strong> {job.function_name}</div>
                    )}
                    {job.sql_command && (
                      <div><strong>SQL:</strong> <code className="bg-gray-100 px-1 rounded">{job.sql_command}</code></div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  {job.function_name && (
                    <button
                      onClick={() => triggerJobManually(job)}
                      disabled={triggeringJobs.has(job.id)}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                    >
                      {triggeringJobs.has(job.id) ? 'Running...' : 'Trigger Now'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {jobs.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-500">No scheduled jobs found.</div>
            <div className="text-sm text-gray-400 mt-2 space-y-1">
              <p>To set up scheduled jobs, you can:</p>
              <ul className="text-left max-w-md mx-auto space-y-1">
                <li>• Enable pg_cron extension in Supabase dashboard</li>
                <li>• Create Edge Functions with cron triggers</li>
                <li>• Set up external schedulers (GitHub Actions, etc.)</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}