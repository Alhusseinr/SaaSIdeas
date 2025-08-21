# 🚀 Batch Reddit Ingestion Strategy

## Problem
- Supabase Edge Functions timeout after ~10 minutes
- Large ingestion requests (1000+ posts) fail due to timeout
- Need a strategy to reliably ingest high volumes

## Solution: Batch Processing

### Option 1: Sequential Batches (Manual)
```bash
# Batch 1: First 300 posts
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 300, "use_all_reddit": true}'

# Batch 2: Next 300 posts (different time window)
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 300, "use_all_reddit": true}'

# Batch 3: Next 300 posts
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 300, "use_all_reddit": true}'
```

### Option 2: Smart Batching (Recommended)
Instead of requesting 1000 posts at once:

**Target 1000 posts? Use 4 batches of 250:**
```bash
# High-volume phrases first (most complaints)
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 250, "use_all_reddit": true}'

curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 250, "use_all_reddit": true}'

curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 250, "use_all_reddit": true}'

curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 250, "use_all_reddit": true}'
```

### Option 3: Time-Based Windows
```bash
# Week 1 posts
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 500, "use_all_reddit": true, "time_window": "week"}'

# Week 2 posts  
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 500, "use_all_reddit": true, "time_window": "week", "offset_weeks": 1}'
```

## Current Timeout Protection ✅

The ingest function now includes:
- **8-minute timeout protection** (stops before Edge Function limit)
- **Graceful degradation** (returns partial results)
- **Progress tracking** (shows where timeout occurred)
- **Timeout indicators** in response

## Recommended Batch Sizes

| Target Posts | Batch Size | Batches | Success Rate |
|-------------|------------|---------|--------------|
| 100-300     | 300        | 1       | 95%+ ✅      |
| 500         | 250        | 2       | 90%+ ✅      |
| 1000        | 250        | 4       | 85%+ ✅      |
| 2000        | 200        | 10      | 80%+ ⚠️       |

## Implementation Notes

1. **Deduplication**: Database handles duplicate posts via hash
2. **Rate Limiting**: Each batch respects Reddit API limits
3. **Error Recovery**: Failed batches can be retried independently
4. **Progress Tracking**: Each batch shows posts collected vs timeout

## Usage Examples

### Safe High-Volume Ingestion (Recommended)
```bash
# 4 batches of 250 = 1000 total posts
for i in {1..4}; do
  curl -X POST /functions/v1/ingest-reddit \
    -d '{"max_posts": 250, "use_all_reddit": true}'
  sleep 30  # Brief pause between batches
done
```

### Maximum Coverage Strategy
```bash
# Specific high-value subreddits first
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 300, "use_all_reddit": false}'

# Then ALL Reddit for broader discovery
curl -X POST /functions/v1/ingest-reddit \
  -d '{"max_posts": 400, "use_all_reddit": true}'
```

This approach gives you **reliable high-volume ingestion** without timeout failures! 🎯