-- Simple Cron Schedule for Daily Fresh Ideas Pipeline
-- Works without setting custom database parameters

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

-- HARDCODED VALUES APPROACH (Replace with your actual values)
-- 1. Main Daily Refresh Pipeline (6:00 AM UTC daily)
SELECT cron.schedule(
    'daily-complete-refresh',
    '0 6 * * *',
    $$
    INSERT INTO job_logs (job_name, status) VALUES ('daily-complete-refresh', 'started');
    
    SELECT 
        net.http_post(
            url := 'https://fjydrbrxguoptnysdzmk.supabase.co/functions/v1/daily-refresh',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqeWRyYnJ4Z3VvcHRueXNkem1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjYzNjA3NSwiZXhwIjoyMDUyMjEyMDc1fQ.6lh4a5p8dkr2nQC2Jl1B7Hhv_M0WEOyHp5x8a9q4XYs"}',
            body := '{}'::jsonb
        ) as request_id;
    $$
);

-- 2. Optional: Quick trend update at noon (lighter operation)
SELECT cron.schedule(
    'midday-trend-update',
    '0 12 * * *',
    $$
    INSERT INTO job_logs (job_name, status) VALUES ('midday-trend-update', 'started');
    
    SELECT 
        net.http_post(
            url := 'https://fjydrbrxguoptnysdzmk.supabase.co/functions/v1/ideas-from-summaries',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqeWRyYnJ4Z3VvcHRueXNkem1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjYzNjA3NSwiZXhwIjoyMDUyMjEyMDc1fQ.6lh4a5p8dkr2nQC2Jl1B7Hhv_M0WEOyHp5x8a9q4XYs"}',
            body := '{"days": 3, "limit": 50}'::jsonb
        ) as request_id;
    $$
);

-- 3. Optional: Clean up old data monthly
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
    LEFT(command, 100) || '...' as command_preview
FROM cron.job 
ORDER BY jobid;

-- Success message
SELECT 'Cron jobs scheduled successfully! Your daily refresh pipeline is now active.' as setup_status;