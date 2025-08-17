-- Add enhanced fields to saas_idea_items table
-- These columns support better pattern analysis and evidence tracking

DO $$
BEGIN
    -- Add posts_in_common column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saas_idea_items' 
        AND column_name = 'posts_in_common'
    ) THEN
        ALTER TABLE public.saas_idea_items ADD COLUMN posts_in_common integer DEFAULT 0;
        COMMENT ON COLUMN public.saas_idea_items.posts_in_common IS 'Number of posts that support this idea pattern';
    END IF;

    -- Add pattern_evidence column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saas_idea_items' 
        AND column_name = 'pattern_evidence'
    ) THEN
        ALTER TABLE public.saas_idea_items ADD COLUMN pattern_evidence text;
        COMMENT ON COLUMN public.saas_idea_items.pattern_evidence IS 'Description of the common pattern across posts that supports this idea';
    END IF;

    -- Add similar_to column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saas_idea_items' 
        AND column_name = 'similar_to'
    ) THEN
        ALTER TABLE public.saas_idea_items ADD COLUMN similar_to text;
        COMMENT ON COLUMN public.saas_idea_items.similar_to IS 'List of existing similar products or solutions in the market';
    END IF;

    -- Add gaps_filled column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saas_idea_items' 
        AND column_name = 'gaps_filled'
    ) THEN
        ALTER TABLE public.saas_idea_items ADD COLUMN gaps_filled text;
        COMMENT ON COLUMN public.saas_idea_items.gaps_filled IS 'List of gaps that the new idea could fill in existing solutions';
    END IF;

    -- Add does_not_exist column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saas_idea_items' 
        AND column_name = 'does_not_exist'
    ) THEN
        ALTER TABLE public.saas_idea_items ADD COLUMN does_not_exist text;
        COMMENT ON COLUMN public.saas_idea_items.does_not_exist IS 'Description of how this idea does not currently exist in the market';
    END IF;
END $$;