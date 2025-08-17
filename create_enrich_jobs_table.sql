-- Create enrich_jobs table for tracking enrichment job progress
CREATE TABLE IF NOT EXISTS public.enrich_jobs (
  id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  progress jsonb,
  result jsonb,
  error text,
  parameters jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrich_jobs_status ON public.enrich_jobs(status);
CREATE INDEX IF NOT EXISTS idx_enrich_jobs_created_at ON public.enrich_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrich_jobs_status_created ON public.enrich_jobs(status, created_at DESC);

-- Add RLS (Row Level Security) if needed
ALTER TABLE public.enrich_jobs ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for service role (since this is used by Edge Functions)
CREATE POLICY "Allow all operations for authenticated users" ON public.enrich_jobs
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON public.enrich_jobs TO postgres;
GRANT ALL ON public.enrich_jobs TO service_role;

-- Optional: Add a trigger to automatically update timestamps
CREATE OR REPLACE FUNCTION update_enrich_job_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set started_at when status changes to 'running'
  IF OLD.status != 'running' AND NEW.status = 'running' AND NEW.started_at IS NULL THEN
    NEW.started_at = now();
  END IF;
  
  -- Auto-set completed_at when status changes to 'completed' or 'failed'
  IF OLD.status NOT IN ('completed', 'failed') AND NEW.status IN ('completed', 'failed') AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_enrich_job_timestamps
  BEFORE UPDATE ON public.enrich_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_enrich_job_timestamps();