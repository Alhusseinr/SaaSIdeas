-- Debug script to check enrich_jobs table status

-- Check if table exists
SELECT 
  table_name,
  table_type,
  table_schema
FROM information_schema.tables 
WHERE table_name = 'enrich_jobs';

-- Check table permissions
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'enrich_jobs';

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'enrich_jobs';

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'enrich_jobs';

-- Check for any existing records
SELECT 
  id,
  status,
  created_at
FROM public.enrich_jobs 
ORDER BY created_at DESC 
LIMIT 5;

-- Test insert (to verify permissions)
INSERT INTO public.enrich_jobs (
  id,
  status,
  created_at,
  parameters
) VALUES (
  'test_job_' || extract(epoch from now()),
  'pending',
  now(),
  '{}'::jsonb
);

-- Clean up test record
DELETE FROM public.enrich_jobs WHERE id LIKE 'test_job_%';