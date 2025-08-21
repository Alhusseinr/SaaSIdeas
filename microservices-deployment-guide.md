# Microservices Architecture Deployment Guide

## 🏗️ Architecture Overview

The ideas-orchestrator has been broken down into 4 lean microservices for better performance and maintainability:

```
ideas-orchestrator-v2  (50 lines)
    ↓ triggers
post-clusterer         (300 lines) 
    ↓ triggers
idea-generator         (350 lines)
    ↓ triggers  
idea-validator         (250 lines)
    ↓ completes job
```

**Benefits:**
- ⚡ **Faster execution** - Each service is optimized for its specific task
- 🔄 **True async** - Services trigger each other, no blocking waits
- 📊 **Better monitoring** - Track progress through each stage
- 🛠️ **Maintainable** - Small, focused codebases
- 🔧 **Configurable** - Can skip validation or enable/disable features
- 💰 **Cost efficient** - Only run what you need

## 📋 Deployment Steps

### 1. Create Database Table
Run this in your Supabase SQL editor:

```sql
-- Create cluster_results table for microservice communication
```

Copy and run the contents of `create-cluster-results-table.sql`

### 2. Deploy Edge Functions

Deploy each function using the Supabase CLI:

```bash
# Deploy the orchestrator
supabase functions deploy ideas-orchestrator-v2

# Deploy the clustering service  
supabase functions deploy post-clusterer

# Deploy the idea generation service
supabase functions deploy idea-generator

# Deploy the validation service
supabase functions deploy idea-validator
```

### 3. Test the Pipeline

```bash
# Trigger the full pipeline
curl -X POST "https://your-project.supabase.co/functions/v1/ideas-orchestrator-v2?platform=reddit&days=7&similarity_threshold=0.60&min_cluster_size=3"

# Check job status  
curl "https://your-project.supabase.co/functions/v1/job-status?job_id=YOUR_JOB_ID"
```

## 🎛️ Configuration Options

### Core Parameters
- `platform`: reddit, all (default: all)
- `days`: Look back period (default: 14)
- `limit`: Max posts to fetch (default: 300)

### Clustering Parameters  
- `similarity_threshold`: 0.50-0.80 (default: 0.60)
- `min_cluster_size`: 2-5 (default: 3)
- `max_clusters_to_process`: 5-15 (default: 10)

### Feature Toggles
- `enable_validation`: true/false (default: true)
- `enable_automation_boost`: true/false (default: true)

### Example: Quick Test Run
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/ideas-orchestrator-v2?platform=reddit&days=3&limit=100&similarity_threshold=0.50&min_cluster_size=2&enable_validation=false"
```

## 📊 Monitoring Progress

The job status will show detailed progress through each stage:

```json
{
  "job_id": "ideas_1737389000_abc123",
  "status": "running",
  "progress": {
    "current_step": "Generating ideas from cluster 2/5",
    "total_steps": 3,
    "completed_steps": 1,
    "clusters_found": 5,
    "clusters_processed": 1,
    "ideas_generated": 12
  }
}
```

**Progress Stages:**
1. **Clustering** (0-1): Fetch posts, filter opportunities, create clusters
2. **Idea Generation** (1-2): Generate ideas from each cluster
3. **Validation** (2-3): Validate high-scoring ideas with GPT-4o

## 🚀 Performance Improvements

**Before (Monolith):**
- ⏱️ **Timeout**: 15 minutes, often hit limits
- 💾 **Memory**: Heavy, processed everything in memory
- 🐌 **Speed**: Sequential processing
- 🛑 **Failures**: One error killed entire job

**After (Microservices):**
- ⚡ **Timeout**: 8 minutes per service (32 min total budget)
- 💾 **Memory**: Lightweight, focused processing  
- 🚀 **Speed**: Parallel execution, immediate responses
- 🔄 **Resilience**: Services can retry independently

## 🔧 Troubleshooting

### No Clusters Found
```bash
# Try more relaxed settings
curl -X POST "...?similarity_threshold=0.45&min_cluster_size=2"
```

### Ideas Generation Fails
- Check OpenAI API key configuration
- Verify cluster data was stored properly
- Check idea-generator logs

### Validation Timeout  
- Reduce `max_validation_ideas` 
- Or disable validation: `enable_validation=false`

### Job Gets Stuck
- Check logs of each microservice
- Verify inter-service communication
- Clean up old cluster_results if needed

## 🎯 Next Steps

1. **Deploy** all 4 microservices
2. **Create** the cluster_results table  
3. **Test** with relaxed parameters first
4. **Monitor** job progress through stages
5. **Optimize** parameters based on your data

The new architecture should be much faster and more reliable than the monolithic version!

## 🔄 Migration from Old System

If you want to keep the old orchestrator as backup:
- The new system uses `ideas-orchestrator-v2`
- Old system remains at `ideas-orchestrator` 
- Both use the same database tables
- You can run both and compare results