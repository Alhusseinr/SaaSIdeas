# Twitter API Setup Guide

## 🐦 Enable Twitter/X Integration

Your `ingest-reddit` function has been enhanced to support **multi-platform ingestion** from both Reddit and Twitter/X. Follow these steps to enable Twitter integration:

## 📋 Prerequisites

1. **Twitter Developer Account** (Apply at [developer.twitter.com](https://developer.twitter.com))
2. **Twitter API v2 Bearer Token** (Essential plan or higher)

## 🔧 Setup Steps

### 1. Get Twitter API Access

1. **Apply for Twitter Developer Account:**
   - Go to [developer.twitter.com](https://developer.twitter.com)
   - Click "Apply for a developer account"
   - Fill out the application (mention you're building a SaaS discovery tool)
   - Wait for approval (usually 1-7 days)

2. **Create a Twitter App:**
   - Go to [Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Click "Create App"
   - Fill in app details:
     - **App Name:** "SaaS Idea Validator"
     - **Description:** "AI-powered SaaS opportunity discovery from social media"
     - **Website:** Your domain
     - **Use Case:** Research/Analysis

3. **Get Bearer Token:**
   - In your app dashboard, go to "Keys and Tokens"
   - Under "Authentication Tokens" → Click "Generate" for Bearer Token
   - **Save this token securely** - you'll only see it once!

### 2. Add Environment Variables

Add the Twitter Bearer Token and API tier to your Supabase environment:

```bash
# In your Supabase dashboard:
# Settings → Edge Functions → Environment Variables

TWITTER_BEARER_TOKEN=your_bearer_token_here
TWITTER_API_TIER=free
```

**Or via Supabase CLI:**
```bash
supabase secrets set TWITTER_BEARER_TOKEN=your_bearer_token_here
supabase secrets set TWITTER_API_TIER=free
```

**API Tier Options:**
- `free` - 100 posts/month, 3 posts/day, 1 query/day
- `basic` - 200K posts/month, 6.7K posts/day, 20 queries/day  
- `pro` - 500K posts/month, 16.7K posts/day, 50 queries/day

### 3. Deploy Updated Function

```bash
supabase functions deploy ingest-reddit
```

## 🎯 What Gets Ingested from Twitter

The enhanced function now searches for:

### **Complaint Phrases + Business Context:**
- `"frustrated" (startup OR SaaS OR business OR entrepreneur OR freelance)`
- `"annoying" (startup OR SaaS OR business OR entrepreneur OR freelance)`
- `"i hate" (startup OR SaaS OR business OR entrepreneur OR freelance)`
- etc.

### **Hashtag Searches:**
- `#startup (frustrating OR annoying OR broken OR "doesn't work")`
- `#SaaS (frustrating OR annoying OR broken OR "doesn't work")`
- `#entrepreneur (frustrating OR annoying OR broken OR "doesn't work")`

### **Popular Account Searches:**
- `from:IndieHackers (problem OR issue OR frustrating OR "need a solution")`
- `from:ProductHunt (problem OR issue OR frustrating OR "need a solution")`
- `from:ycombinator (problem OR issue OR frustrating OR "need a solution")`

## 📊 Expected Results

After setup, your daily pipeline will ingest:
- **Reddit posts:** ~100-200 per day
- **Twitter posts:** ~50-100 per day
- **Total:** ~150-300 posts with complaints and business problems

## 🔍 Verification

Check if Twitter integration is working:

1. **Run the function manually:**
   ```bash
   curl -X POST "https://your-project.supabase.co/functions/v1/ingest-reddit" \
        -H "Authorization: Bearer your-anon-key"
   ```

2. **Check the response:**
   ```json
   {
     "status": "success",
     "total_fetched": 150,
     "reddit_posts": 100,
     "twitter_posts": 50,
     "unique_posts": 140,
     "inserted": 135
   }
   ```

3. **Verify in database:**
   ```sql
   SELECT platform, COUNT(*) 
   FROM posts 
   WHERE created_at > NOW() - INTERVAL '1 day'
   GROUP BY platform;
   ```

## 🚨 Quota Management & Rate Limits

The function now includes **intelligent quota management** for Twitter's free tier limits:

**Free Tier Limits (100 posts/month):**
- ✅ **Pre-flight quota checks** before starting ingestion
- ✅ **Real-time quota monitoring** during ingestion
- ✅ **Automatic query limiting** based on remaining quota
- ✅ **Graceful degradation** when limits are reached
- ✅ **Detailed quota reporting** in function response

**Safety Features:**
- 2-second delays between requests (free tier)
- Max 1 query per day (free tier restriction)
- Quota tracking in database
- Smart query prioritization
- Fallback to Reddit-only mode when quota exhausted

**Function Response includes quota info:**
```json
{
  "status": "success",
  "twitter_posts": 8,
  "twitter_quota": {
    "tier": "free",
    "daily_usage": "8/3",
    "monthly_usage": "45/100", 
    "monthly_remaining": 55
  }
}
```

## 🛠️ Troubleshooting

### **No Twitter posts found:**
1. Check Bearer Token is correct
2. Verify Twitter API plan has search access
3. Check function logs for errors

### **API errors:**
- **401 Unauthorized:** Invalid Bearer Token
- **429 Too Many Requests:** Hit rate limit, wait and retry
- **403 Forbidden:** App suspended or insufficient permissions

### **Function logs:**
```bash
supabase functions logs ingest-reddit
```

## 🎉 Success!

Once configured, your system will automatically:
- ✅ **Ingest from both Reddit and Twitter**
- ✅ **Deduplicate across platforms**
- ✅ **Generate more diverse SaaS ideas**
- ✅ **Better trend detection**

Your "Today's Validated Opportunity" will now include insights from both platforms! 🚀

## 📊 X/Twitter API Usage Summary

**What data we collect from X:**
- **Tweet text content** - Business complaints and pain points
- **Author usernames** - For attribution and credibility
- **Tweet timestamps** - For trend analysis and recency
- **Tweet IDs** - For deduplication and source tracking
- **Public metrics** - Engagement data (likes, retweets, replies)

**Search queries we run:**
1. **Complaint + Business terms:** `"frustrated" (startup OR SaaS OR business)`
2. **Hashtag searches:** `#startup (frustrating OR annoying OR broken)`
3. **Expert account monitoring:** `from:IndieHackers (problem OR issue)`

**Data processing:**
- Real problems → AI analysis → SaaS opportunities
- Deduplication across platforms
- Sentiment analysis for pain point validation
- Trend detection for timing insights

**Privacy & Compliance:**
- ✅ Only public tweets collected
- ✅ No personal data stored beyond username
- ✅ Data used for business opportunity research only
- ✅ Complies with Twitter Developer Agreement
- ✅ No tracking or profiling of individual users

**Monthly API usage breakdown (Free Tier - 100 posts):**
- Daily ingestion: ~3-8 tweets
- Weekly patterns: ~25-30 tweets  
- Monthly total: ~90-100 tweets
- Buffer for manual testing: ~10 tweets