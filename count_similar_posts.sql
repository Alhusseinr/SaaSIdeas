-- Count similar posts for each post and order by similarity count
SELECT 
    p.id,
    p.title,
    p.created_at,
    CASE 
        WHEN p.similarity_scores IS NULL THEN 0
        ELSE jsonb_array_length(p.similarity_scores)
    END as similar_posts_count,
    p.similarity_scores
FROM posts p
WHERE p.enrich_status = 'completed'
    AND p.embedding IS NOT NULL
ORDER BY similar_posts_count DESC, p.id ASC
LIMIT 100;

-- Summary statistics
SELECT 
    COUNT(*) as total_posts_with_embeddings,
    COUNT(CASE WHEN similarity_scores IS NOT NULL AND jsonb_array_length(similarity_scores) > 0 THEN 1 END) as posts_with_similarities,
    AVG(CASE 
        WHEN similarity_scores IS NULL THEN 0 
        ELSE jsonb_array_length(similarity_scores) 
    END) as avg_similar_posts_per_post,
    MAX(CASE 
        WHEN similarity_scores IS NULL THEN 0 
        ELSE jsonb_array_length(similarity_scores) 
    END) as max_similar_posts
FROM posts 
WHERE enrich_status = 'completed' 
    AND embedding IS NOT NULL;

-- Distribution of similarity counts
SELECT 
    similarity_count,
    COUNT(*) as posts_with_this_count
FROM (
    SELECT 
        CASE 
            WHEN similarity_scores IS NULL THEN 0
            ELSE jsonb_array_length(similarity_scores)
        END as similarity_count
    FROM posts 
    WHERE enrich_status = 'completed' 
        AND embedding IS NOT NULL
) counts
GROUP BY similarity_count
ORDER BY similarity_count DESC;