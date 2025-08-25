# 🚨 EMERGENCY DATABASE OVERLOAD - IMMEDIATE ACTIONS

## Current Situation
- 300k+ posts in database
- Supabase I/O limits exceeded
- Database tables timing out
- Dashboard inaccessible

## IMMEDIATE ACTIONS (Do These Now)

### 1. Stop All Ingestion Services
```bash
# Stop Railway services immediately
# Go to Railway dashboard and pause these services:
- railway-ingest (Reddit ingestion)
- railway-enrichment (if auto-running)
- Any scheduled jobs
```

### 2. Emergency Database Cleanup
```sql
-- Run these in Supabase SQL Editor if you can access it
-- Delete oldest posts (keep last 30 days)
DELETE FROM posts 
WHERE created_at < (CURRENT_DATE - INTERVAL '30 days');

-- If that doesn't work, try smaller batches
DELETE FROM posts 
WHERE created_at < (CURRENT_DATE - INTERVAL '60 days')
LIMIT 10000;
```

### 3. Pause Schedulers
```bash
# Disable these Supabase edge functions temporarily:
- auto-enrich-scheduler
- daily-refresh
```

## ROOT CAUSES

### 1. No Data Retention Policy
- Posts accumulating indefinitely
- No automatic cleanup
- 300k rows is way beyond Supabase free tier limits

### 2. No Database Limits
- Ingestion running without caps
- No monitoring of database size
- No circuit breakers for DB overload

### 3. Inefficient Queries
- Large table scans
- No proper indexing for 300k rows
- Enrichment queries on massive dataset

## PERMANENT SOLUTIONS

### 1. Implement Data Retention
```sql
-- Keep only last 30 days of data
CREATE OR REPLACE FUNCTION cleanup_old_posts()
RETURNS void AS $$
BEGIN
  DELETE FROM posts 
  WHERE created_at < (CURRENT_DATE - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup
SELECT cron.schedule('cleanup-old-posts', '0 2 * * *', 'SELECT cleanup_old_posts();');
```

### 2. Add Database Monitoring
```sql
-- Monitor table size
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE tablename = 'posts';

-- Check current row count
SELECT COUNT(*) FROM posts;
```

### 3. Implement Archiving
- Move old posts to separate archive table
- Keep only active data in main table
- Use partitioning for better performance