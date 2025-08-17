# Job Status Function Testing

## Issue
Getting 401 "Missing authorization header" when calling job-status function

## Possible Solutions

### 1. **Deploy Function Correctly**
Make sure the function is deployed with proper permissions:

```bash
# Deploy the job-status function
supabase functions deploy job-status

# Check if it needs to be public
supabase functions list
```

### 2. **Test Different Auth Methods**

**Option A: No Auth (if you want it public)**
```bash
# Test without any headers
curl "https://your-project.supabase.co/functions/v1/job-status?job_id=test"
```

**Option B: With API Key (if you set INGEST_API_KEY)**
```bash
# Test with API key header
curl -H "x-api-key: your_api_key" "https://your-project.supabase.co/functions/v1/job-status?job_id=test"

# Or with API key as query param
curl "https://your-project.supabase.co/functions/v1/job-status?job_id=test&api_key=your_api_key"
```

**Option C: With Supabase Auth (if required)**
```bash
# Test with Supabase anon key
curl -H "Authorization: Bearer your_anon_key" "https://your-project.supabase.co/functions/v1/job-status?job_id=test"
```

### 3. **Check Supabase Function Settings**
- Go to Supabase Dashboard → Edge Functions
- Check if authentication is required for the job-status function
- Make sure it's deployed and active

### 4. **Alternative: Use Same Auth as Ingest Function**
If the ingest function works, use the same authentication method for job-status.