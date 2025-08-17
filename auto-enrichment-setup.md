# Auto-Enrichment Setup Guide

This guide shows you 3 different ways to automatically trigger enrichment when new posts are added or when unenriched posts exist.

## 🚀 Quick Start: Manual Trigger (Easiest)

### Deploy the trigger function:
```bash
supabase functions deploy trigger-enrichment
```

### Use it:
```bash
# Check if enrichment is needed
curl "https://your-project.supabase.co/functions/v1/trigger-enrichment?check_only=true"

# Trigger enrichment if needed
curl -X POST "https://your-project.supabase.co/functions/v1/trigger-enrichment"

# Force trigger regardless
curl -X POST "https://your-project.supabase.co/functions/v1/trigger-enrichment?force=true"
```

---

## 🔄 Option 1: Database Triggers 

### Option 1A: Simple Trigger (Recommended)
Creates enrichment jobs automatically but requires manual triggering:

1. Run the simple trigger script:
```bash
psql -h your-db-host -U postgres -d postgres -f create_simple_auto_enrich_trigger.sql
```

2. Set up polling or use with the scheduler:
```bash
# Check for pending jobs and trigger them
curl -X POST "https://your-project.supabase.co/functions/v1/trigger-enrichment"
```

### Option 1B: Full Automatic Trigger (Advanced)
Automatically calls enrichment function (requires pg_net extension):

1. Enable pg_net extension:
```bash
psql -h your-db-host -U postgres -d postgres -f enable_pg_net.sql
```

2. If pg_net is available, run the full trigger:
```bash
psql -h your-db-host -U postgres -d postgres -f create_auto_enrich_trigger.sql
```

3. Configure your Supabase settings:
```sql
-- Replace with your actual values
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';
```

### How it works:
- **Simple**: Creates enrichment jobs when posts are inserted, requires manual/scheduled triggering
- **Full**: Automatically triggers enrichment when new posts are inserted
- Both prevent duplicate jobs by checking for recent enrichment jobs

**Note**: If you get "schema net does not exist" error, use Option 1A (Simple Trigger) instead.

---

## ⏰ Option 2: Scheduled Jobs (Most Reliable)

### Setup:
1. Deploy the scheduler function:
```bash
supabase functions deploy auto-enrich-scheduler
```

2. Set up a cron job or scheduled task to call it every 15 minutes:
```bash
# Add to your crontab (every 15 minutes)
*/15 * * * * curl -X POST "https://your-project.supabase.co/functions/v1/auto-enrich-scheduler"
```

### Configuration:
Edit the scheduler function to adjust:
- `CHECK_INTERVAL_MINUTES`: How often to check (default: 15)
- `MIN_POSTS_TO_TRIGGER`: Minimum posts needed to trigger (default: 5)
- `MAX_RECENT_JOBS`: Max concurrent jobs (default: 1)

---

## 🔗 Option 3: Application Integration (Most Control)

### In your application, after creating posts:
```javascript
// After inserting new posts
const response = await fetch('https://your-project.supabase.co/functions/v1/trigger-enrichment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key' // Optional
  },
  body: JSON.stringify({
    context: 'new_posts_added',
    source: 'reddit_ingestion'
  })
});

const result = await response.json();
console.log('Enrichment status:', result);
```

### Response examples:
```json
// When enrichment is triggered
{
  "status": "triggered",
  "jobId": "enrich_1737123456_abc123",
  "message": "Enrichment job triggered successfully",
  "post_status": {
    "hasUnenriched": true,
    "count": 25,
    "total": 150
  }
}

// When all posts are already enriched
{
  "status": "no_action_needed",
  "message": "All posts are already enriched",
  "post_status": {
    "hasUnenriched": false,
    "count": 0,
    "total": 150
  }
}
```

---

## 🛡️ Security

### API Key Protection (Optional):
```bash
# Set environment variable for webhook security
TRIGGER_API_KEY=your-secret-key
```

### Then use it:
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/trigger-enrichment" \
  -H "X-API-Key: your-secret-key"
```

---

## 📊 Monitoring

### Check enrichment status:
```bash
# Get current status
curl "https://your-project.supabase.co/functions/v1/trigger-enrichment?check_only=true"

# Check specific job
curl "https://your-project.supabase.co/functions/v1/job-status?job_id=enrich_123"
```

### The job status will now show:
```json
{
  "enrichment_summary": {
    "total_posts_in_database": 150,
    "fully_enriched": 145,
    "partially_enriched": 3,
    "not_enriched": 2,
    "enrichment_completion_rate": 96.7,
    "all_posts_enriched": false,
    "no_work_needed": false
  },
  "message": "📊 Mostly maintenance run: 140 posts already enriched, 10 newly processed."
}
```

---

## 🔧 Troubleshooting

### Common issues:

1. **No enrichment triggered**: Check if posts need enrichment with `?check_only=true`
2. **Permission errors**: Ensure service role key is correct
3. **Database trigger not working**: Check if `pg_net` extension is enabled
4. **Rate limiting**: The system prevents duplicate jobs automatically

### Force enrichment:
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/trigger-enrichment?force=true"
```

---

## 📝 Recommendation

**For most use cases, I recommend Option 3 (Application Integration)** because:
- ✅ You have full control over when enrichment happens
- ✅ Easy to integrate into existing workflows
- ✅ Clear error handling and responses
- ✅ No complex database setup required
- ✅ Works reliably across different environments

Simply call the trigger after your Reddit/Twitter/etc. ingestion processes complete!