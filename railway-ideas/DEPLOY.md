# Railway Ideas Service Deployment

## Overview
High-performance SaaS ideas generation service that eliminates all the restrictive limits of Supabase Edge Functions.

## Key Features
- ✅ **No 8-minute timeout** - can run for hours
- ✅ **No 15-post limit** - uses ALL representative posts  
- ✅ **No 8-cluster limit** - processes ALL clusters
- ✅ **No memory constraints** - handles large datasets
- ✅ **Complete pipeline** - clustering → generation → validation → storage
- ✅ **Better error handling** - retry logic for OpenAI calls
- ✅ **Streaming processing** - real-time progress updates

## Railway Deployment

### 1. Create Railway Project
```bash
# In the railway-ideas directory
railway login
railway init
railway link
```

### 2. Set Environment Variables
```bash
railway variables set SUPABASE_URL=your_supabase_url
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
railway variables set OPENAI_API_KEY=your_openai_api_key
railway variables set NODE_ENV=production
```

### 3. Deploy
```bash
# Build and deploy
npm run build
railway up
```

### 4. Get Service URL
```bash
railway domain
# Copy the provided URL (e.g., https://your-service.railway.app)
```

## Update Orchestrator

Add the Railway endpoint to your Supabase environment variables:

```bash
# In Supabase dashboard, add environment variable:
RAILWAY_IDEAS_ENDPOINT=https://your-railway-service.railway.app/generate-ideas
```

The `ideas-orchestrator-v2` will automatically detect and use the Railway service when available, falling back to Supabase microservices when not configured.

## API Usage

### Generate Ideas
```bash
curl -X POST https://your-service.railway.app/generate-ideas \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test_123",
    "platform": "all",
    "days": 14,
    "limit": 1000,
    "similarity_threshold": 0.6,
    "min_cluster_size": 3,
    "enable_automation_boost": true,
    "enable_validation": true
  }'
```

### Check Health
```bash
curl https://your-service.railway.app/health
```

## Performance Comparison

| Metric | Supabase Edge Functions | Railway Ideas Service |
|--------|------------------------|----------------------|
| **Timeout** | 8 minutes max | Unlimited |
| **Representative Posts** | Limited to 15 | Uses ALL posts |
| **Clusters Processed** | Max 8 | Processes ALL clusters |
| **Memory** | Restricted | High allocation |
| **Error Recovery** | Limited | Full retry logic |
| **Architecture** | 3 separate microservices | Single optimized service |

## Monitoring

The service provides detailed progress tracking:
- Real-time job status updates
- Cluster processing progress
- Ideas generation metrics
- Performance timing data

## Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your credentials

# Run in development mode
npm run dev

# Test locally
node test-local.js
```