-- Setup pg_cron job to run similarity calculation every hour
-- This ensures similarity scores are kept fresh without blocking enrichment

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing similarity calculation jobs
SELECT cron.unschedule('calculate-post-similarity');

-- Schedule similarity calculation to run every hour
-- This runs at 15 minutes past each hour to avoid conflicts with other jobs
SELECT cron.schedule(
    'calculate-post-similarity',
    '15 * * * *', -- Every hour at 15 minutes past
    $$
    SELECT 
        net.http_post(
            url:='https://[your-supabase-project].supabase.co/functions/v1/calculate-similarity',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer [your-service-role-key]"}',
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- Check the scheduled job
SELECT * FROM cron.job WHERE jobname = 'calculate-post-similarity';