-- Enable pg_net extension for HTTP requests from database functions
-- This is required for the full automatic database trigger functionality

-- Step 1: Enable the pg_net extension
-- Note: This may require superuser privileges or may not be available in all Supabase plans
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Verify the extension is installed
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Step 3: Test that the net schema exists
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'net';

-- Step 4: Show available functions in the net schema
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'net'
ORDER BY routine_name;

-- If successful, you should see output showing:
-- 1. The pg_net extension is installed
-- 2. The 'net' schema exists  
-- 3. Functions like 'http_post', 'http_get' are available

-- Step 5: Set up your Supabase configuration (replace with your actual values)
-- These settings are required for the database trigger to call your functions
/*
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project-id.supabase.co';
ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key-here';
*/

-- Step 6: Test the HTTP functionality (optional)
/*
SELECT net.http_post(
  url := 'https://httpbin.org/post',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"test": "database trigger works"}'::jsonb
);
*/

-- If pg_net is successfully enabled, you can then run the full auto-enrichment trigger:
-- \i create_auto_enrich_trigger.sql