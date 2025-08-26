-- Create PostgreSQL function for efficient similarity calculation using pgvector
-- This leverages database-level vector operations for better performance

-- Create overloaded functions for both 1536 and 3072 dimension vectors
CREATE OR REPLACE FUNCTION find_similar_posts_1536(
    target_embedding vector(1536),
    target_post_id integer,
    similarity_threshold float DEFAULT 0.5,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    id integer,
    similarity float
) 
LANGUAGE sql
AS $$
    SELECT 
        p.id,
        (1 - (target_embedding <=> p.embedding::vector(1536))) as similarity
    FROM posts p
    WHERE p.id != target_post_id
        AND p.embedding IS NOT NULL
        AND p.enrich_status = 'completed'
        AND (1 - (target_embedding <=> p.embedding::vector(1536))) >= similarity_threshold
    ORDER BY target_embedding <=> p.embedding::vector(1536) ASC
    LIMIT max_results;
$$;

-- Function for 3072 dimension vectors
CREATE OR REPLACE FUNCTION find_similar_posts_3072(
    target_embedding vector(3072),
    target_post_id integer,
    similarity_threshold float DEFAULT 0.7,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    id integer,
    similarity float
) 
LANGUAGE sql
AS $$
    SELECT 
        p.id,
        (1 - (target_embedding <=> p.embedding::vector(3072))) as similarity
    FROM posts p
    WHERE p.id != target_post_id
        AND p.embedding IS NOT NULL
        AND p.enrich_status = 'completed'
        AND (1 - (target_embedding <=> p.embedding::vector(3072))) >= similarity_threshold
    ORDER BY target_embedding <=> p.embedding::vector(3072) ASC
    LIMIT max_results;
$$;

-- Add column for tracking when similarity was calculated
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS similarity_calculated_at TIMESTAMP WITH TIME ZONE;

-- Helper function to get posts with valid 1536-dimension embeddings
CREATE OR REPLACE FUNCTION get_posts_needing_similarity(
    batch_limit integer DEFAULT 50
)
RETURNS TABLE (
    id integer,
    embedding vector(1536)
) 
LANGUAGE sql
AS $$
    SELECT 
        p.id,
        p.embedding::vector(1536)
    FROM posts p
    WHERE p.enrich_status = 'completed'
        AND p.embedding IS NOT NULL
        AND p.similarity_scores IS NULL
        AND vector_dims(p.embedding) = 1536
    ORDER BY p.enriched_at DESC
    LIMIT batch_limit;
$$;

-- Add index for faster similarity queries
CREATE INDEX IF NOT EXISTS idx_posts_similarity_calculated 
ON posts(similarity_calculated_at) 
WHERE similarity_calculated_at IS NOT NULL;

-- Create JSONB index for similarity_scores if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'similarity_scores'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_posts_similarity_scores_gin 
        ON posts USING gin (similarity_scores);
    END IF;
END $$;