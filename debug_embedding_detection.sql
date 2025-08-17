-- Debug script to understand why posts with null embeddings aren't being detected

-- 1. Check the actual data types and values
SELECT 
  id,
  sentiment,
  keywords,
  embedding,
  enriched_at,
  enrich_status,
  CASE 
    WHEN embedding IS NULL THEN 'NULL'
    WHEN embedding = '[]'::jsonb THEN 'EMPTY_ARRAY'
    WHEN jsonb_array_length(embedding) = 0 THEN 'ZERO_LENGTH_ARRAY'
    ELSE 'HAS_DATA'
  END as embedding_type,
  CASE 
    WHEN sentiment IS NULL THEN 'NULL'
    ELSE 'HAS_DATA'
  END as sentiment_type,
  CASE 
    WHEN keywords IS NULL THEN 'NULL'
    WHEN keywords = '[]'::jsonb THEN 'EMPTY_ARRAY'
    WHEN jsonb_array_length(keywords) = 0 THEN 'ZERO_LENGTH_ARRAY'
    ELSE 'HAS_DATA'
  END as keywords_type
FROM posts 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Count posts by enrichment completeness
SELECT 
  'All posts' as category,
  COUNT(*) as count
FROM posts
UNION ALL
SELECT 
  'Has sentiment' as category,
  COUNT(*) as count
FROM posts 
WHERE sentiment IS NOT NULL
UNION ALL
SELECT 
  'Has keywords' as category,
  COUNT(*) as count
FROM posts 
WHERE keywords IS NOT NULL
UNION ALL
SELECT 
  'Has embedding' as category,
  COUNT(*) as count
FROM posts 
WHERE embedding IS NOT NULL
UNION ALL
SELECT 
  'Has enriched_at' as category,
  COUNT(*) as count
FROM posts 
WHERE enriched_at IS NOT NULL
UNION ALL
SELECT 
  'Fully complete (all fields)' as category,
  COUNT(*) as count
FROM posts 
WHERE sentiment IS NOT NULL 
  AND keywords IS NOT NULL 
  AND embedding IS NOT NULL 
  AND enriched_at IS NOT NULL;

-- 3. Find posts missing only embedding
SELECT 
  id,
  sentiment,
  keywords,
  embedding,
  enriched_at,
  enrich_status,
  created_at
FROM posts 
WHERE sentiment IS NOT NULL 
  AND keywords IS NOT NULL 
  AND enriched_at IS NOT NULL
  AND embedding IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- 4. Test the OR query that should find posts with null embeddings
SELECT COUNT(*) as should_be_found
FROM posts 
WHERE enriched_at IS NULL 
   OR sentiment IS NULL 
   OR embedding IS NULL;

-- 5. Test the enrich_status query
SELECT COUNT(*) as enrich_status_count
FROM posts 
WHERE enrich_status IS NULL 
   OR enrich_status = 'pending' 
   OR enrich_status = 'failed';

-- 6. Check if there's a discrepancy between the queries
WITH 
  missing_fields AS (
    SELECT id FROM posts 
    WHERE enriched_at IS NULL 
       OR sentiment IS NULL 
       OR embedding IS NULL
  ),
  status_based AS (
    SELECT id FROM posts 
    WHERE enrich_status IS NULL 
       OR enrich_status = 'pending' 
       OR enrich_status = 'failed'
  )
SELECT 
  'Missing fields query' as query_type,
  COUNT(*) as count
FROM missing_fields
UNION ALL
SELECT 
  'Status based query' as query_type,
  COUNT(*) as count
FROM status_based
UNION ALL
SELECT 
  'In missing_fields but not status_based' as query_type,
  COUNT(*) as count
FROM missing_fields 
WHERE id NOT IN (SELECT id FROM status_based)
UNION ALL
SELECT 
  'In status_based but not missing_fields' as query_type,
  COUNT(*) as count
FROM status_based 
WHERE id NOT IN (SELECT id FROM missing_fields);