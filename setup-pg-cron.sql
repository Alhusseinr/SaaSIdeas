-- Setup script for pg_cron functionality
-- Run this in your Supabase SQL Editor after enabling the pg_cron extension

-- First, enable the pg_cron extension (do this in Dashboard → Extensions instead)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create RPC function to get cron jobs
CREATE OR REPLACE FUNCTION get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean,
  jobname text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    j.jobid,
    j.schedule,
    j.command,
    j.nodename,
    j.nodeport,
    j.database,
    j.username,
    j.active,
    j.jobname
  FROM cron.job j
  ORDER BY j.jobid;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_cron_jobs() TO authenticated;

-- Example: Create a simple test job (optional)
-- SELECT cron.schedule(
--   'test-job',
--   '0 */6 * * *',  -- Every 6 hours
--   'SELECT now();'
-- );

-- To view all jobs:
-- SELECT * FROM get_cron_jobs();

-- To unschedule a job:
-- SELECT cron.unschedule('job-name');