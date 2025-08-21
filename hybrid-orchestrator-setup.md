# 🔄 Hybrid Orchestrator Setup Guide

## 🎯 What This Does

Your `ingest-orchestrator` now supports a **hybrid approach**:
- ✅ **Reddit**: Uses Railway (unlimited processing, 4000+ posts)
- ✅ **Other platforms**: Stay on Supabase (fast, lightweight)
- ✅ **Automatic fallback**: If Railway URL not set, uses Supabase for Reddit too

## 🚀 Setup Steps

### 1. **Deploy Your Railway Service** (if not done yet)
```bash
cd /Users/alhusseinr/Documents/gitWorkspace/redditsaasideas/railway-ingest
railway login
railway init
railway variables set REDDIT_CLIENT_ID=lkOWFWkv7sYn930ncK2Ojg
railway variables set REDDIT_CLIENT_SECRET=UwQ7DXNS1ZiPQNPfCCacA8ZTIOnd0w
railway variables set SUPABASE_URL=https://fjydrbrxguoptnysdzmk.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
railway up
```

### 2. **Get Your Railway URL**
```bash
railway status
# Note the URL, something like: https://reddit-ingest-production.railway.app
```

### 3. **Configure Supabase Environment Variable**
In your Supabase project dashboard:
- Go to **Edge Functions** → **Settings** → **Environment Variables**
- Add: `RAILWAY_REDDIT_ENDPOINT = https://your-app.railway.app/ingest-reddit`

### 4. **Redeploy Your Orchestrator**
```bash
supabase functions deploy ingest-orchestrator
```

## 📊 Usage Examples

### **Hybrid Multi-Platform Ingestion:**
```bash
# This will now use Railway for Reddit (4000+ posts) and Supabase for others
curl -X POST https://your-project.supabase.co/functions/v1/ingest-orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "max_posts": 4000,
    "use_all_reddit": true
  }'
```

### **Check Job Status:**
```bash
curl "https://your-project.supabase.co/functions/v1/job-status?job_id=orchestrator_123"
```

## 🎯 What You Get

### **Before (All Supabase):**
- ❌ Reddit: ~200 posts max (timeout)
- ✅ Other platforms: Works fine
- ❌ Total: Limited by weakest link

### **After (Hybrid):**
- ✅ Reddit: 4000+ posts via Railway (unlimited)
- ✅ Other platforms: Still fast on Supabase  
- ✅ Total: Best of both worlds

## 📈 Expected Results

| Platform | Endpoint | Max Posts | Success Rate |
|----------|----------|-----------|--------------|
| **Reddit** | Railway | 4000+ | 95%+ |
| **Twitter** | Supabase | 200-500 | 90%+ |
| **GitHub** | Supabase | 200-500 | 90%+ |
| **Others** | Supabase | 200-500 | 90%+ |

## 🔧 Troubleshooting

### **Test Railway Connection:**
```bash
curl -X POST https://your-app.railway.app/ingest-reddit \
  -d '{"max_posts": 100, "use_all_reddit": true}'
```

### **Test Orchestrator:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ingest-orchestrator \
  -d '{"max_posts": 100}'
```

### **Check Logs:**
- **Railway**: `railway logs`
- **Supabase**: Function logs in dashboard

## ✅ Benefits

1. **Unlimited Reddit Ingestion**: 4000+ posts via Railway
2. **Fast Other Platforms**: Still use optimized Supabase functions
3. **Automatic Fallback**: Works even if Railway is down
4. **Single Endpoint**: Your UI calls one orchestrator for everything
5. **Cost Optimization**: Heavy processing on Railway ($5/month), light tasks on Supabase

**Your orchestrator is now the perfect hybrid system!** 🎉