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

### 2. Add Environment Variable

Add the Twitter Bearer Token to your Supabase environment:

```bash
# In your Supabase dashboard:
# Settings → Edge Functions → Environment Variables

TWITTER_BEARER_TOKEN=your_bearer_token_here
```

**Or via Supabase CLI:**
```bash
supabase secrets set TWITTER_BEARER_TOKEN=your_bearer_token_here
```

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

## 🚨 Rate Limits

**Twitter API v2 Rate Limits:**
- **Essential Plan:** 500,000 tweets/month
- **Basic Plan:** 2M tweets/month
- **Pro Plan:** 5M tweets/month

The function respects these limits with:
- ✅ 1-second delays between requests
- ✅ Max 10 tweets per query
- ✅ Limited to ~11 queries per run
- ✅ Graceful error handling

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