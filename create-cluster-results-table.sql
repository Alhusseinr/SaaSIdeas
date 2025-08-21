-- Create table for passing cluster data between microservices
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS cluster_results (
    id SERIAL PRIMARY KEY,
    job_id TEXT NOT NULL,
    clusters JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast job_id lookups
CREATE INDEX IF NOT EXISTS idx_cluster_results_job_id ON cluster_results(job_id);

-- Create index for cleanup by created_at
CREATE INDEX IF NOT EXISTS idx_cluster_results_created_at ON cluster_results(created_at);

-- Add cleanup policy to automatically delete old cluster results after 24 hours
-- This prevents the table from growing too large
CREATE OR REPLACE FUNCTION cleanup_old_cluster_results()
RETURNS void AS $$
BEGIN
    DELETE FROM cluster_results 
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (optional)
-- You can enable this with pg_cron extension if available
SELECT cron.schedule('cleanup-cluster-results', '0 2 * * *', 'SELECT cleanup_old_cluster_results();');