# 🔄 Railway Functions Alternative

## If you prefer serverless (like Supabase Edge Functions):

### 1. **Create railway.toml**
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"

[[services]]
name = "ingest-function"
type = "function"
runtime = "nodejs18"

[services.ingest-function.config]
timeout = 900  # 15 minutes (max allowed)
memory = 1024  # 1GB memory
```

### 2. **Create function handler**
```typescript
// functions/ingest.ts
export default async function handler(request: Request) {
  // Your exact same ingestion logic
  // Limited to 15 minutes execution time
}
```

### 3. **Pros of Functions:**
- ✅ Pay only when used
- ✅ Auto-scaling
- ✅ Serverless simplicity

### 4. **Cons for Your Use Case:**
- ❌ 15-minute timeout (vs unlimited)
- ❌ Cold starts (vs instant)
- ❌ Less predictable costs

## Recommendation:

**Stick with the Always-On Service** because:
1. Your 4000+ post ingestion needs unlimited time
2. Predictable $5/month cost
3. Better performance (no cold starts)
4. Simpler deployment (what we already built)