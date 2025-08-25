-- EMERGENCY SQL CLEANUP - Run these directly in Supabase SQL Editor
-- Your database is too overloaded for API calls, need direct SQL

-- 1. CHECK CURRENT SIZE (if this times out, skip to step 2)
SELECT COUNT(*) as total_posts FROM posts;

-- 2. EMERGENCY DELETE - Delete in small batches
-- Run this multiple times until it returns 0 rows affected

-- Delete oldest 10,000 posts at a time
DELETE FROM posts 
WHERE id IN (
  SELECT id FROM posts 
  ORDER BY created_at ASC 
  LIMIT 10000
);

-- If above times out, try even smaller batches:
DELETE FROM posts 
WHERE id IN (
  SELECT id FROM posts 
  ORDER BY created_at ASC 
  LIMIT 5000
);

-- If still timing out, try this atomic approach:
DELETE FROM posts WHERE created_at < '2025-01-01';

-- 3. Check progress (run between deletes)
SELECT COUNT(*) as remaining_posts FROM posts;

-- 4. Once under 50k posts, create automatic cleanup
CREATE OR REPLACE FUNCTION cleanup_old_posts()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM posts 
  WHERE created_at < (CURRENT_DATE - INTERVAL '30 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Create daily cleanup schedule (once database is healthy)
SELECT cron.schedule(
  'daily-cleanup',
  '0 2 * * *', -- 2 AM daily
  'SELECT cleanup_old_posts();'
);

-- 6. Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);

-- 7. Monitor table size
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables 
WHERE tablename = 'posts';