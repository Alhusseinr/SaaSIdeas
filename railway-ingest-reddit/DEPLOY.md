# 🚀 Railway Deployment Guide

## Step-by-Step Deployment

### 1. **Login to Railway (in your terminal)**
```bash
railway login
# This will open browser for authentication
```

### 2. **Initialize Railway Project**
```bash
cd /Users/alhusseinr/Documents/gitWorkspace/redditsaasideas/railway-ingest
railway init
# Choose "Empty Project" and give it a name like "reddit-ingest"
```

### 3. **Set Environment Variables**
```bash
# Add your environment variables to Railway
railway variables set REDDIT_CLIENT_ID=your_reddit_client_id
railway variables set REDDIT_CLIENT_SECRET=your_reddit_client_secret
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
railway variables set NODE_ENV=production
```

### 4. **Deploy to Railway**
```bash
railway up
```

### 5. **Get Your Railway URL**
```bash
railway status
# This will show your deployment URL, something like:
# https://reddit-ingest-production.railway.app
```

## Testing Your Deployment

### Health Check
```bash
curl https://your-app.railway.app/health
```

### Test Small Ingestion
```bash
curl -X POST https://your-app.railway.app/ingest-reddit \
  -H "Content-Type: application/json" \
  -d '{
    "max_posts": 100,
    "use_all_reddit": true
  }'
```

### Test Large Ingestion (The whole point!)
```bash
curl -X POST https://your-app.railway.app/ingest-reddit \
  -H "Content-Type: application/json" \
  -d '{
    "max_posts": 4000,
    "use_all_reddit": true
  }'
```

## Update Your UI

Once deployed, update your frontend to use the Railway endpoint:

```typescript
// Before (Supabase - limited to 200 posts)
const response = await fetch('/functions/v1/ingest-reddit', {
  method: 'POST',
  body: JSON.stringify({ max_posts: 200 })
});

// After (Railway - unlimited posts!)
const response = await fetch('https://your-app.railway.app/ingest-reddit', {
  method: 'POST',
  body: JSON.stringify({ max_posts: 4000, use_all_reddit: true })
});
```

## Monitoring

- **Railway Dashboard**: View logs, metrics, deployments
- **Health Endpoint**: `https://your-app.railway.app/health`
- **Logs**: `railway logs` in terminal

## Cost Expectations

- **Railway Pro**: $5/month for hobby projects
- **Usage-based**: Additional costs for heavy processing
- **Typical cost**: $5-15/month for 4000+ post ingestion

## Next Steps

1. Deploy to Railway
2. Test with small batch (100 posts)
3. Test with large batch (4000 posts)
4. Update your UI to use Railway endpoint
5. Enjoy unlimited processing! 🎉