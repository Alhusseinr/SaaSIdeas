-- Create ideas_jobs table for tracking SaaS idea generation jobs
-- This table tracks orchestrated idea generation jobs with progress and results

CREATE TABLE IF NOT EXISTS public.ideas_jobs (
    id text PRIMARY KEY,
    status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    progress jsonb,
    result jsonb,
    error text,
    parameters jsonb
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ideas_jobs_status ON public.ideas_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ideas_jobs_created_at ON public.ideas_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_ideas_jobs_status_created ON public.ideas_jobs(status, created_at);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE public.ideas_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own jobs
CREATE POLICY "Users can view ideas jobs" ON public.ideas_jobs
    FOR SELECT USING (true);

-- Allow service role to manage all jobs
CREATE POLICY "Service role can manage ideas jobs" ON public.ideas_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Add helpful comments
COMMENT ON TABLE public.ideas_jobs IS 'Tracks orchestrated SaaS idea generation jobs with progress and results';
COMMENT ON COLUMN public.ideas_jobs.id IS 'Unique job identifier (ideas_timestamp_random)';
COMMENT ON COLUMN public.ideas_jobs.status IS 'Current job status: pending, running, completed, failed';
COMMENT ON COLUMN public.ideas_jobs.progress IS 'Job progress information including current chunk, summaries processed, etc.';
COMMENT ON COLUMN public.ideas_jobs.result IS 'Final job results including statistics, sample ideas, and reliability stats';
COMMENT ON COLUMN public.ideas_jobs.parameters IS 'Job parameters like platform, days, limit, chunk_size, etc.';