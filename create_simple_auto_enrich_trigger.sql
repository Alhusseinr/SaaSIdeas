-- Simple auto-enrichment trigger (without pg_net dependency)
-- This creates enrichment jobs but doesn't automatically call the function
-- You'll need to poll for pending jobs or use the scheduler approach

-- Step 1: Create a simple function to create enrichment jobs for new posts
CREATE OR REPLACE FUNCTION trigger_auto_enrichment_simple()
RETURNS TRIGGER AS $$
DECLARE
  recent_job_count INTEGER;
  job_id TEXT;
BEGIN
  -- Only trigger if this is a new post that needs enrichment
  IF TG_OP = 'INSERT' AND (NEW.sentiment IS NULL OR NEW.keywords IS NULL OR NEW.embedding IS NULL OR NEW.enriched_at IS NULL) THEN
    
    -- Check if there's already a recent enrichment job running (within last 5 minutes)
    -- to avoid creating too many jobs for bulk inserts
    SELECT COUNT(*) INTO recent_job_count
    FROM enrich_jobs 
    WHERE created_at > NOW() - INTERVAL '5 minutes'
      AND status IN ('pending', 'running');
    
    -- Only create new job if no recent job exists
    IF recent_job_count = 0 THEN
      -- Generate job ID
      job_id := 'enrich_auto_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 8);
      
      -- Create enrichment job (but don't call the function directly)
      INSERT INTO enrich_jobs (
        id,
        status,
        created_at,
        parameters
      ) VALUES (
        job_id,
        'pending',
        NOW(),
        jsonb_build_object(
          'triggered_by', 'auto_trigger_simple',
          'trigger_type', 'new_post_insert',
          'post_id', NEW.id,
          'auto_created', true,
          'needs_manual_trigger', true
        )
      );
      
      RAISE NOTICE 'Auto-enrichment job created for new post %. Job ID: %. Call enrichment function manually or use scheduler.', NEW.id, job_id;
    ELSE
      RAISE NOTICE 'Skipping auto-enrichment trigger - recent job already exists (% active jobs)', recent_job_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger on the posts table
DROP TRIGGER IF EXISTS auto_enrich_simple_trigger ON posts;

CREATE TRIGGER auto_enrich_simple_trigger
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_enrichment_simple();

-- Step 3: Create a view to easily see pending auto-created jobs
CREATE OR REPLACE VIEW pending_auto_enrichment_jobs AS
SELECT 
  id,
  created_at,
  parameters,
  'Call trigger-enrichment function to process this job' as action_needed
FROM enrich_jobs 
WHERE status = 'pending' 
  AND parameters->>'auto_created' = 'true'
  AND parameters->>'needs_manual_trigger' = 'true'
ORDER BY created_at DESC;

COMMENT ON FUNCTION trigger_auto_enrichment_simple() IS 'Creates enrichment jobs for new posts (requires manual triggering)';
COMMENT ON TRIGGER auto_enrich_simple_trigger ON posts IS 'Auto-creates enrichment jobs when new posts are inserted';
COMMENT ON VIEW pending_auto_enrichment_jobs IS 'Shows pending auto-created enrichment jobs that need manual triggering';