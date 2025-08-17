-- Create summary_jobs table for tracking summarization jobs
-- This table tracks orchestrated summarization jobs with progress and results

CREATE TABLE IF NOT EXISTS public.summary_jobs (
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
CREATE INDEX IF NOT EXISTS idx_summary_jobs_status ON public.summary_jobs(status);
CREATE INDEX IF NOT EXISTS idx_summary_jobs_created_at ON public.summary_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_summary_jobs_status_created ON public.summary_jobs(status, created_at);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE public.summary_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own jobs
CREATE POLICY "Users can view summary jobs" ON public.summary_jobs
    FOR SELECT USING (true);

-- Allow service role to manage all jobs
CREATE POLICY "Service role can manage summary jobs" ON public.summary_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Add helpful comments
COMMENT ON TABLE public.summary_jobs IS 'Tracks orchestrated summarization jobs with progress and results';
COMMENT ON COLUMN public.summary_jobs.id IS 'Unique job identifier (summary_timestamp_random)';
COMMENT ON COLUMN public.summary_jobs.status IS 'Current job status: pending, running, completed, failed';
COMMENT ON COLUMN public.summary_jobs.progress IS 'Job progress information including current step, posts processed, etc.';
COMMENT ON COLUMN public.summary_jobs.result IS 'Final job results including statistics and sample details';
COMMENT ON COLUMN public.summary_jobs.parameters IS 'Job parameters like batch_size, sentiment_threshold, etc.';