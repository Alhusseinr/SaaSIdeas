-- Fixed Optimal Cron Schedule for Daily Fresh Ideas Pipeline
-- Run these commands in your Supabase SQL editor to set up the new scheduling

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old individual job schedules if they exist (ignore errors if they don't exist)
DO $$
BEGIN
    PERFORM cron.unschedule('daily-reddit-ingest');
EXCEPTION
    WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
    PERFORM cron.unschedule('hourly-enrich');
EXCEPTION
    WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
    PERFORM cron.unschedule('daily-negative-summary');
EXCEPTION
    WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
    PERFORM cron.unschedule('weekly-idea-generation');
EXCEPTION
    WHEN OTHERS THEN NULL;
END
$$;

-- Create a job logs table to track execution (optional but recommended)
CREATE TABLE IF NOT EXISTS job_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_logs_job_name ON job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_logs_created_at ON job_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_job_logs_status ON job_logs(status);

-- NEW OPTIMIZED SCHEDULE:
-- Single daily refresh that runs the complete pipeline

-- IMPORTANT: You need to set these configuration values first!
-- Replace 'your-project' and 'your-service-role-key' with your actual values:

-- Step 1: Set your configuration (REQUIRED - replace with actual values)
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';

-- Uncomment and modify the lines above with your actual values before proceeding!

-- 1. Main Daily Refresh Pipeline (6:00 AM UTC daily)
-- This replaces all individual jobs with one comprehensive pipeline
SELECT cron.schedule(
    'daily-complete-refresh',
    '0 6 * * *',
    $$
    INSERT INTO job_logs (job_name, status) VALUES ('daily-complete-refresh', 'started');
    
    SELECT 
        net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/daily-refresh',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key') || '"}',
            body := '{}'::jsonb
        ) as request_id;
    $$
);

-- 2. Optional: Quick trend update at noon (lighter operation)
-- Updates trending data without full pipeline
SELECT cron.schedule(
    'midday-trend-update',
    '0 12 * * *',
    $$
    INSERT INTO job_logs (job_name, status) VALUES ('midday-trend-update', 'started');
    
    SELECT 
        net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/ideas-from-summaries',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key') || '"}',
            body := '{"days": 3, "limit": 50}'::jsonb
        ) as request_id;
    $$
);

-- Optional: Clean up old data monthly
SELECT cron.schedule(
    'monthly-cleanup',
    '0 2 1 * *',  -- 2:00 AM on the 1st of each month
    $$
    INSERT INTO job_logs (job_name, status) VALUES ('monthly-cleanup', 'started');
    
    -- Archive posts older than 60 days
    UPDATE posts 
    SET archived = true 
    WHERE created_at < NOW() - INTERVAL '60 days' 
    AND (archived IS NULL OR archived = false);
    
    -- Delete job logs older than 30 days
    DELETE FROM job_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    $$
);

-- View active cron jobs to verify setup
SELECT 
    jobid, 
    jobname, 
    schedule, 
    active,
    command
FROM cron.job 
ORDER BY jobid;

-- SETUP INSTRUCTIONS:
-- 1. Replace the configuration values above with your actual Supabase URL and service role key
-- 2. Run this entire script in your Supabase SQL editor
-- 3. Deploy the daily-refresh edge function: `supabase functions deploy daily-refresh`
-- 4. Verify jobs are created by checking the query result above

-- EXPLANATION OF NEW SCHEDULE:

-- Old Schedule Problems:
-- ❌ 4 separate jobs running at different times
-- ❌ Potential conflicts between jobs  
-- ❌ Complex dependency management
-- ❌ Hard to ensure data freshness for "today's opportunity"

-- New Optimized Schedule:
-- ✅ Single daily pipeline at 6:00 AM UTC (ensures fresh data for all timezones)
-- ✅ Complete data refresh: Reddit → Summarize → Generate Ideas
-- ✅ Optional midday update for trending data
-- ✅ Perfect for "daily opportunity" rotation system
-- ✅ Reduced complexity and conflicts

-- TIMING RATIONALE:
-- 6:00 AM UTC = Perfect for global coverage:
-- - 11:00 PM PST (West Coast ends day)
-- - 2:00 AM EST (East Coast sleeping) 
-- - 7:00 AM CET (Europe starts day)
-- - 3:00 PM JST (Asia afternoon)

-- This ensures fresh ideas are ready when most users wake up!