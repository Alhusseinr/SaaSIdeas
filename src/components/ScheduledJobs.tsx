"use client";

import { useState, useEffect } from 'react';
import { supabase, invokeEdgeFunction } from '@/lib/supabase';
import {
  IconClock,
  IconRefresh,
  IconAlertTriangle,
  IconCircleCheck,
  IconSettings,
  IconDatabase,
  IconCloud,
  IconExternalLink,
  IconPlayerPlay,
  IconLoader,
  IconCalendar,
} from '@tabler/icons-react';

interface ScheduledJob {
  jobid: number;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
  jobname?: string;
  last_start_time?: string;
  last_finish_time?: string;
  last_run_status?: string;
}

const jobMetadata: Record<string, { name: string; description: string; type: string; icon: React.ReactNode }> = {
  'daily-complete-refresh': {
    name: 'Daily Complete Pipeline',
    description: 'Full data refresh including Reddit scraping, AI analysis, and database updates',
    type: 'pg_cron',
    icon: <IconDatabase size={20} />
  },
  'midday-trend-update': {
    name: 'Midday Trend Update',
    description: 'Quick trend analysis and score updates for active opportunities',
    type: 'pg_cron', 
    icon: <IconRefresh size={20} />
  },
  'monthly-cleanup': {
    name: 'Monthly Data Cleanup',
    description: 'Archive old data and optimize database performance',
    type: 'pg_cron',
    icon: <IconSettings size={20} />
  }
};

const formatSchedule = (cronExpression: string): string => {
  const scheduleMap: Record<string, string> = {
    '0 6 * * *': 'Daily at 6:00 AM UTC',
    '0 13 * * *': 'Daily at 1:00 PM UTC', 
    '0 2 1 * *': 'Monthly on the 1st at 2:00 AM UTC',
    '*/15 * * * *': 'Every 15 minutes',
    '0 */6 * * *': 'Every 6 hours',
    '0 0 * * 0': 'Weekly on Sunday at midnight UTC'
  };
  
  return scheduleMap[cronExpression] || cronExpression;
};

export default function ScheduledJobs() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Try to get pg_cron jobs via RPC first
      const { data, error: rpcError } = await supabase.rpc('get_cron_jobs');
      
      if (rpcError) {
        console.warn('RPC get_cron_jobs failed:', rpcError.message);
        
        // Try direct query to cron.job table
        try {
          const { data: fallbackData, error: queryError } = await supabase
            .from('cron.job')
            .select('*');
            
          if (queryError) {
            console.warn('Direct cron.job query failed:', queryError.message);
            
            // If both methods fail, show mock data with helpful message
            setJobs([]);
            setError('pg_cron extension is not available or not properly configured. This feature requires pg_cron to be installed and configured on your Supabase database.');
            return;
          }
          
          setJobs(fallbackData || []);
        } catch (directQueryError: any) {
          console.warn('Direct query error:', directQueryError);
          setJobs([]);
          setError('Unable to access cron jobs. This feature requires pg_cron extension to be enabled in your Supabase database.');
        }
      } else {
        setJobs(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
      setError('Database connection failed. Please check your Supabase configuration and ensure you have the necessary permissions.');
    } finally {
      setLoading(false);
    }
  };

  const triggerEdgeFunctionJob = async (jobName: string) => {
    setTriggeringJob(jobName);
    
    try {
      const { data, error } = await invokeEdgeFunction('trigger-scheduled-job', {
        jobName: jobName
      });
      
      if (error) {
        throw new Error(error);
      }
      
      // Refresh jobs to get updated status
      setTimeout(() => {
        fetchJobs();
      }, 1000);
      
    } catch (err: any) {
      console.error('Error triggering job:', err);
      setError(`Failed to trigger ${jobName}: ${err.message}`);
    } finally {
      setTriggeringJob(null);
    }
  };

  const getStatusColor = (active: boolean, lastRunStatus?: string) => {
    if (!active) return 'bg-gray-100 text-gray-800';
    if (lastRunStatus === 'SUCCESS') return 'bg-green-100 text-green-800';
    if (lastRunStatus === 'ERROR' || lastRunStatus === 'FAILED') return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getStatusIcon = (active: boolean, lastRunStatus?: string) => {
    if (!active) return <IconSettings size={16} className="text-gray-500" />;
    if (lastRunStatus === 'SUCCESS') return <IconCircleCheck size={16} className="text-green-600" />;
    if (lastRunStatus === 'ERROR' || lastRunStatus === 'FAILED') return <IconAlertTriangle size={16} className="text-red-600" />;
    return <IconClock size={16} className="text-blue-600" />;
  };

  const getJobMetadata = (jobName: string) => {
    // Extract job identifier from command or use jobname
    const identifier = Object.keys(jobMetadata).find(key => 
      jobName.toLowerCase().includes(key) || 
      jobName.toLowerCase().includes(key.replace('-', '_'))
    );
    
    return identifier ? jobMetadata[identifier] : {
      name: jobName,
      description: 'Custom scheduled job',
      type: 'pg_cron',
      icon: <IconClock size={20} />
    };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center">
          <IconLoader size={32} className="animate-spin text-gray-400 mr-3" />
          <span className="text-gray-600">Loading scheduled jobs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <IconAlertTriangle className="text-amber-500" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">System Operations</h3>
              <p className="text-sm text-gray-500">Setup Required</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <IconSettings size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-amber-900 font-medium">pg_cron Extension Required</h4>
                <p className="text-amber-700 text-sm mt-1 mb-3">{error}</p>
                
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-2">To enable scheduled jobs:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Go to your Supabase Dashboard → Database → Extensions</li>
                    <li>Search for "pg_cron" and enable it</li>
                    <li>Run the setup SQL to create the RPC function</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
                
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={fetchJobs}
                    className="text-sm bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-md font-medium transition-colors"
                  >
                    Try Again
                  </button>
                  <a 
                    href="https://supabase.com/docs/guides/database/extensions/pg_cron"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-amber-800 hover:text-amber-900 px-3 py-2 font-medium underline flex items-center gap-1"
                  >
                    View Setup Guide
                    <IconExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconClock className="text-gray-400" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">System Operations</h3>
                <p className="text-sm text-gray-500">No scheduled jobs found</p>
              </div>
            </div>
            
            <button
              onClick={fetchJobs}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <IconRefresh size={16} />
              Refresh
            </button>
          </div>
        </div>
        
        <div className="p-8 text-center">
          <IconSettings size={48} className="text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Jobs Scheduled</h4>
          <p className="text-gray-600 mb-4">
            pg_cron extension is available but no scheduled jobs have been created yet.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg mx-auto">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">To create scheduled jobs:</p>
              <ol className="text-left list-decimal list-inside space-y-1">
                <li>Use the SQL Editor in Supabase to create cron jobs</li>
                <li>Example: <code className="bg-blue-100 px-1 rounded">SELECT cron.schedule('job-name', '0 6 * * *', 'SELECT 1;');</code></li>
                <li>Refresh this page to see your jobs</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconClock className="text-green-600" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">System Operations</h3>
              <p className="text-sm text-gray-500">{jobs.length} scheduled job{jobs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
          >
            <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {jobs.map((job) => {
            const metadata = getJobMetadata(job.jobname || job.command);
            const isTriggering = triggeringJob === (job.jobname || job.command);
            
            return (
              <div key={job.jobid} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {/* Job Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                      {metadata.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm leading-tight">
                        {metadata.name}
                      </h4>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusColor(job.active, job.last_run_status)}`}>
                        {getStatusIcon(job.active, job.last_run_status)}
                        <span className="ml-1">
                          {job.active ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Job Details */}
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600 leading-relaxed">
                    {metadata.description}
                  </p>
                  
                  <div className="flex items-center gap-1 text-gray-500">
                    <IconCalendar size={14} />
                    <span>{formatSchedule(job.schedule)}</span>
                  </div>

                  {job.last_finish_time && (
                    <div className="text-xs text-gray-500">
                      Last run: {new Date(job.last_finish_time).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  {metadata.type === 'edge_function' && (
                    <button
                      onClick={() => triggerEdgeFunctionJob(job.jobname || job.command)}
                      disabled={isTriggering}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs rounded-md transition-colors"
                    >
                      {isTriggering ? (
                        <IconLoader size={14} className="animate-spin" />
                      ) : (
                        <IconPlayerPlay size={14} />
                      )}
                      {isTriggering ? 'Running...' : 'Run Now'}
                    </button>
                  )}
                  
                  <div className="flex-1"></div>
                  
                  <span className="text-xs text-gray-400">
                    ID: {job.jobid}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <IconCloud size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">About System Operations</h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                These automated jobs handle data collection, analysis, and maintenance tasks. 
                Jobs run automatically based on their schedules, but edge functions can be triggered manually for testing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}