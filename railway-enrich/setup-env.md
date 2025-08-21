# 🔧 Environment Setup

## Required Environment Variables

Copy these from your existing Supabase project:

### 1. Reddit API (from your Supabase Edge Function env)
```bash
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
```

### 2. Supabase (same database as your existing project)  
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Server Config
```bash
PORT=3000
NODE_ENV=production
```

## Quick Setup

1. **Copy from Supabase dashboard:**
   - Go to Settings → API
   - Copy URL and service role key

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Test locally:**
   ```bash
   npm run dev
   # Visit http://localhost:3000/health
   ```

4. **Test ingestion:**
   ```bash
   curl -X POST http://localhost:3000/ingest-reddit \
     -H "Content-Type: application/json" \
     -d '{"max_posts": 50, "use_all_reddit": true}'
   ```