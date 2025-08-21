-- Debug query to check embedding data quality (for pgvector)
-- Run this in your Supabase SQL editor to understand your data

-- 1. Check posts with embeddings
SELECT 
    COUNT(*) as total_posts,
    COUNT(embedding) as posts_with_embeddings,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as posts_with_valid_embeddings,
    -- For pgvector, we can't easily get dimensions, but we can check if they exist
    MIN(created_at) as oldest_post,
    MAX(created_at) as newest_post
FROM posts 
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND title IS NOT NULL 
  AND body IS NOT NULL;

-- 2. Check recent posts with embeddings by platform
SELECT 
    platform,
    COUNT(*) as total_posts,
    COUNT(embedding) as posts_with_embeddings,
    COUNT(CASE WHEN is_complaint = true THEN 1 END) as complaint_posts,
    AVG(sentiment) as avg_sentiment
FROM posts 
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND title IS NOT NULL 
  AND body IS NOT NULL
GROUP BY platform
ORDER BY posts_with_embeddings DESC;

-- 3. Sample posts to see data structure
SELECT 
    id,
    platform,
    title,
    LEFT(body, 100) as body_preview,
    sentiment,
    is_complaint,
    CASE WHEN embedding IS NOT NULL THEN 'HAS_EMBEDDING' ELSE 'NO_EMBEDDING' END as embedding_status,
    created_at
FROM posts 
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND title IS NOT NULL 
  AND body IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check if embeddings are actually similar between any posts (pgvector version)
-- This uses pgvector's cosine similarity function
WITH sample_posts AS (
    SELECT id, title, embedding, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
    FROM posts 
    WHERE embedding IS NOT NULL 
      AND created_at >= NOW() - INTERVAL '7 days'
    LIMIT 20  -- Smaller sample for performance
)
SELECT 
    p1.id as post1_id,
    p2.id as post2_id,
    p1.title as post1_title,
    p2.title as post2_title,
    -- Use pgvector's cosine similarity (1 - cosine_distance)
    (1 - (p1.embedding <=> p2.embedding)) as cosine_similarity
FROM sample_posts p1
CROSS JOIN sample_posts p2
WHERE p1.rn < p2.rn
  AND p1.embedding IS NOT NULL 
  AND p2.embedding IS NOT NULL
ORDER BY cosine_similarity DESC
LIMIT 10;