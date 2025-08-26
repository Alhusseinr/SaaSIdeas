-- Fix vector column to enforce 1536 dimensions
-- This migration will clean up invalid embeddings and enforce proper dimensions

BEGIN;

-- Step 1: Add new column with proper dimension constraint
ALTER TABLE posts ADD COLUMN embedding_new vector(1536);

-- Step 2: Copy valid 1536-dimension embeddings to new column
UPDATE posts 
SET embedding_new = embedding::vector(1536)
WHERE embedding IS NOT NULL 
  AND vector_dims(embedding) = 1536;

-- Step 3: Clear invalid embeddings (they'll be re-enriched)
UPDATE posts
SET embedding_new = NULL,
    enrich_status = 'pending',
    enriched_at = NULL
WHERE embedding IS NOT NULL 
  AND vector_dims(embedding) != 1536;

-- Step 4: Drop old column and rename new one
ALTER TABLE posts DROP COLUMN embedding;
ALTER TABLE posts RENAME COLUMN embedding_new TO embedding;

-- Step 5: Recreate the vector index with proper dimensions
DROP INDEX IF EXISTS posts_embedding_idx;
CREATE INDEX posts_embedding_idx ON posts 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 6: Show results
SELECT 
    COUNT(*) as total_posts,
    COUNT(embedding) as valid_embeddings,
    COUNT(CASE WHEN enrich_status = 'pending' THEN 1 END) as pending_enrichment
FROM posts;

COMMIT;

-- Success message
SELECT 
    'Vector column migration completed!' as status,
    'Invalid embeddings marked for re-enrichment' as cleanup_status,
    'New embeddings will be exactly 1536 dimensions' as dimension_status;