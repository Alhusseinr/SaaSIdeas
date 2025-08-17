-- Add missing notes column to saas_idea_runs table
-- This column is required by the ideas-orchestrator function

-- Check if the column exists, and add it if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saas_idea_runs' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.saas_idea_runs ADD COLUMN notes text;
        COMMENT ON COLUMN public.saas_idea_runs.notes IS 'Optional notes about the idea generation run';
    END IF;
END $$;