-- Create ingest_jobs table for tracking async ingest operations
CREATE TABLE IF NOT EXISTS ingest_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    progress JSONB,
    result JSONB,
    error TEXT,
    parameters JSONB NOT NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_status ON ingest_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_created_at ON ingest_jobs(created_at);

-- Add RLS policy (optional - adjust based on your security needs)
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all records
CREATE POLICY "Service role can access all ingest jobs" ON ingest_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Clean up old completed jobs (optional - you can run this periodically)
-- DELETE FROM ingest_jobs WHERE status IN ('completed', 'failed') AND created_at < NOW() - INTERVAL '7 days';