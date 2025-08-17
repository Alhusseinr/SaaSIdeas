-- Auto-enrichment trigger for new posts
-- This will automatically trigger enrichment when new posts are inserted

-- Step 1: Create a function to call the enrichment orchestrator
CREATE OR REPLACE FUNCTION trigger_auto_enrichment()
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
      
      -- Create enrichment job
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
          'triggered_by', 'auto_trigger',
          'trigger_type', 'new_post_insert',
          'post_id', NEW.id,
          'auto_created', true
        )
      );
      
      -- Call the enrichment function asynchronously using pg_net
      -- Note: This requires the pg_net extension to be enabled
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/enrich-orchestrator',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := jsonb_build_object(
          'auto_triggered', true,
          'trigger_source', 'database_trigger',
          'job_id', job_id
        )
      );
      
      RAISE NOTICE 'Auto-enrichment triggered for new post %. Job ID: %', NEW.id, job_id;
    ELSE
      RAISE NOTICE 'Skipping auto-enrichment trigger - recent job already exists (% active jobs)', recent_job_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger on the posts table
DROP TRIGGER IF EXISTS auto_enrich_trigger ON posts;

CREATE TRIGGER auto_enrich_trigger
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_enrichment();

-- Step 3: Create settings for the trigger (you'll need to set these values)
-- These should be set to your actual Supabase URL and service role key
-- Example (replace with your actual values):
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';

-- Step 4: Enable the pg_net extension (if not already enabled)
-- This allows making HTTP requests from database functions
-- CREATE EXTENSION IF NOT EXISTS pg_net;

COMMENT ON FUNCTION trigger_auto_enrichment() IS 'Automatically triggers enrichment for new posts that need processing';
COMMENT ON TRIGGER auto_enrich_trigger ON posts IS 'Auto-trigger enrichment when new posts are inserted';