-- Add enrichment tracking columns to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS complexity_score text CHECK (complexity_score IN ('simple', 'medium', 'complex')),
ADD COLUMN IF NOT EXISTS priority_score numeric,
ADD COLUMN IF NOT EXISTS enrich_status text CHECK (enrich_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending';

-- Create indexes for performance on the new columns
CREATE INDEX IF NOT EXISTS idx_posts_complexity_score ON public.posts(complexity_score);
CREATE INDEX IF NOT EXISTS idx_posts_priority_score ON public.posts(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_enrich_status ON public.posts(enrich_status);
CREATE INDEX IF NOT EXISTS idx_posts_enrich_status_created ON public.posts(enrich_status, created_at DESC);

-- Update existing posts to have enrich_status based on current state
UPDATE public.posts 
SET enrich_status = CASE 
  WHEN enriched_at IS NOT NULL THEN 'completed'
  ELSE 'pending'
END
WHERE enrich_status IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.posts.complexity_score IS 'Content complexity analysis: simple/medium/complex based on length and technical content';
COMMENT ON COLUMN public.posts.priority_score IS 'Priority score for enrichment processing (higher = more important)';
COMMENT ON COLUMN public.posts.enrich_status IS 'Current enrichment processing status';

-- Optional: Create a view for enrichment analytics
CREATE OR REPLACE VIEW enrichment_analytics AS
SELECT 
  complexity_score,
  enrich_status,
  COUNT(*) as post_count,
  AVG(priority_score) as avg_priority,
  AVG(CASE WHEN sentiment IS NOT NULL THEN 1 ELSE 0 END) as enrichment_rate,
  AVG(CASE WHEN is_complaint THEN 1 ELSE 0 END) as complaint_rate
FROM public.posts 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY complexity_score, enrich_status
ORDER BY complexity_score, enrich_status;