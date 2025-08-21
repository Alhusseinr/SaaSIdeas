// Railway Enrichment Service - Unlimited processing for post enrichment
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// OpenAI Configuration
const CLASSIFIER_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small"; // Use small model for 1536 dimensions
const EXPECTED_EMBED_DIM = 1536;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;
const EMBED_CHAR_LIMIT = 7000;

// Processing Configuration - Conservative to avoid rate limits
const BATCH_SIZE = 10; // Smaller batches to reduce API pressure
const CONCURRENT_REQUESTS = 2; // Reduced concurrency to respect rate limits
const INTER_BATCH_DELAY = 2000; // Longer delays between batches
const OPENAI_TIMEOUT_MS = 30000; // Increased timeout

// Express setup
const app = express();
const PORT = process.env.ENRICHMENT_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

interface PostData {
  id: string;
  platform: string;
  platform_post_id: string;
  title: string | null;
  body: string | null;
  author: string | null;
  url: string | null;
  created_at: string;
  fetched_at: string;
  hash: string;
  sentiment?: number; // Numeric sentiment score, not string
  keywords?: string[];
  embedding?: number[];
  enriched_at?: string;
  enrich_status?: string;
}

interface EnrichmentResult {
  sentiment_label: string;
  sentiment_score: number;
  is_complaint: boolean;
  keywords: string[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fallbackHeuristics(text: string): EnrichmentResult {
  const low = text.toLowerCase();
  
const complaintTerms = [
  "annoying", "frustrat", "i hate", "wish there was", "why is it so hard",
  "broken", "useless", "terrible", "buggy", "hate", "sucks", "pain",
  "doesn't work", "so slow", "awful", "worst", "horrible",
  "laggy", "crash", "glitch", "messy", "complicated", "confusing",
  "unreliable", "unstable", "frozen", "error", "fails", "issue"
];
  
  const match = complaintTerms.some(t => low.includes(t));
  
const negativeWords = [
  "hate", "annoying", "terrible", "useless", "broken", "bad", "worst", "pain", 
  "sucks", "awful", "glitchy", "confusing", "hard", "expensive", "slow"
];  
const positiveWords = [
  "love", "great", "awesome", "amazing", "fantastic", "excellent", "perfect",
  "helpful", "useful", "intuitive", "smooth", "easy", "simple", "efficient",
  "worth it", "recommend"
];  
  
  const negCount = negativeWords.filter(w => low.includes(w)).length;
  const posCount = positiveWords.filter(w => low.includes(w)).length;
  
  const score = Math.max(-1, Math.min(1, (posCount - negCount) / 3));
  const label = score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
  
  // Extract keywords
  const commonWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use"]);
  
  const keywords = Array.from(new Set(
    low.replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(x => x.length > 3 && !commonWords.has(x))
  )).slice(0, 8);
  
  return {
    sentiment_label: label,
    sentiment_score: score,
    is_complaint: match || score < -0.3,
    keywords
  };
}

function cleanForEmbedding(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // Remove code blocks
    .replace(/`[^`]*`/g, " ") // Remove inline code
    .replace(/https?:\/\/\S+/g, " ") // Remove URLs
    .replace(/<[^>]+>/g, " ") // Remove HTML tags
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

function chunkByChars(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    const end = Math.min(i + maxChars, text.length);
    const slice = text.slice(i, end);
    const lastSpace = slice.lastIndexOf(" ");
    const splitPoint = lastSpace > maxChars * 0.7 ? i + lastSpace : end;
    
    chunks.push(text.slice(i, splitPoint));
    i = splitPoint;
  }
  
  return chunks;
}

function meanVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return vectors[0];
  
  const dim = vectors[0].length;
  const mean = new Array(dim).fill(0);
  
  for (const vector of vectors) {
    for (let i = 0; i < dim; i++) {
      mean[i] += vector[i];
    }
  }
  
  for (let i = 0; i < dim; i++) {
    mean[i] /= vectors.length;
  }
  
  return mean;
}

async function fetchWithTimeout(url: string, options: any, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function analyzeWithOpenAI(text: string): Promise<EnrichmentResult | null> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — using fallback heuristics");
    return fallbackHeuristics(text);
  }
  
  const cleanText = text.slice(0, 4000); // Limit for API
  
  const prompt = `Analyze this post for SaaS business opportunities:

"${cleanText}"

Respond with JSON only:
{
  "sentiment_label": "positive/negative/neutral",
  "sentiment_score": -1.0 to 1.0,
  "is_complaint": true/false,
  "keywords": ["key1", "key2", "key3"]
}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: CLASSIFIER_MODEL,
          messages: [
            { role: "system", content: "You are a business analyst. Return only valid JSON." },
            { role: "user", content: prompt }
          ],
          max_tokens: 200,
          temperature: 0.1
        })
      }, OPENAI_TIMEOUT_MS);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        
        if (response.status === 503 || response.status === 429 || (response.status >= 500 && response.status < 600)) {
          console.warn(`Analysis attempt ${attempt}/${MAX_RETRIES} failed: ${response.status} - retrying...`);
          // Longer delays for rate limits - exponential backoff with jitter
          const baseDelay = response.status === 429 ? 10000 : 2000; // 10s for rate limits, 2s for others
          const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
          await sleep(baseDelay * attempt + jitter);
          continue;
        }
        
        console.error(`Analysis failed:`, response.status, errorText.slice(0, 200));
        break;
      }
      
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      
      if (content) {
        try {
          const parsed = JSON.parse(content);
          return {
            sentiment_label: parsed.sentiment_label || "neutral",
            sentiment_score: parsed.sentiment_score || 0,
            is_complaint: parsed.is_complaint || false,
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : []
          };
        } catch (parseError) {
          console.warn(`Failed to parse OpenAI response: ${content.slice(0, 100)}`);
        }
      }
      
      break;
    } catch (error) {
      console.error(`Analysis attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      if (attempt === MAX_RETRIES) break;
      // Longer delay for network errors that might be rate-limit related
      await sleep(2000 * attempt + Math.random() * 1000);
    }
  }
  
  console.warn("OpenAI analysis failed, using fallback heuristics");
  return fallbackHeuristics(text);
}

async function embedText(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — skipping embeddings");
    return null;
  }
  
  const cleaned = cleanForEmbedding(text);
  const chunks = chunkByChars(cleaned, EMBED_CHAR_LIMIT);
  const vectors: number[][] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: chunks[i],
            model: EMBEDDING_MODEL
          })
        }, TIMEOUT_MS);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          
          if (response.status === 503 || response.status === 429 || (response.status >= 500 && response.status < 600)) {
            console.warn(`Embedding attempt ${attempt}/${MAX_RETRIES} failed for chunk ${i + 1}: ${response.status} - retrying...`);
            // Longer delays for rate limits - exponential backoff with jitter
            const baseDelay = response.status === 429 ? 10000 : 2000; // 10s for rate limits, 2s for others
            const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
            await sleep(baseDelay * attempt + jitter);
            continue;
          }
          
          console.error(`Embedding failed for chunk ${i + 1}/${chunks.length}:`, response.status, errorText.slice(0, 200));
          break;
        }
        
        const data = await response.json();
        const vector = data?.data?.[0]?.embedding;
        
        if (Array.isArray(vector) && vector.length === EXPECTED_EMBED_DIM) {
          vectors.push(vector);
          break;
        } else {
          console.error(`Invalid embedding vector for chunk ${i + 1}: expected ${EXPECTED_EMBED_DIM} dimensions`);
          break;
        }
      } catch (error) {
        console.error(`Embedding attempt ${attempt}/${MAX_RETRIES} failed for chunk ${i + 1}:`, error);
        if (attempt === MAX_RETRIES) break;
        // Longer delay for network errors that might be rate-limit related
        await sleep(2000 * attempt + Math.random() * 1000);
      }
    }
  }
  
  return vectors.length > 0 ? meanVectors(vectors) : null;
}

async function enrichPost(post: PostData): Promise<{ success: boolean; error?: string }> {
  try {
    const text = `${post.title || ''} ${post.body || ''}`.trim();
    if (!text) {
      return { success: false, error: "Empty post content" };
    }
    
    console.log(`Enriching post ${post.id} (${text.length} chars)`);
    
    // Analyze sentiment and keywords
    const analysis = await analyzeWithOpenAI(text);
    if (!analysis) {
      return { success: false, error: "Analysis failed" };
    }
    
    // Generate embedding
    const embedding = await embedText(text);
    
    // Update the post in database
    const updateData: any = {
      sentiment: analysis.sentiment_score, // Store numeric score in sentiment column
      keywords: analysis.keywords,
      enriched_at: new Date().toISOString(),
      enrich_status: 'completed'
    };
    
    if (embedding) {
      updateData.embedding = embedding;
    }
    
    const { error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', post.id);
      
    if (error) {
      console.error(`Database update failed for post ${post.id}:`, error);
      return { success: false, error: `Database error: ${error.message}` };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error(`Enrichment failed for post ${post.id}:`, error);
    return { success: false, error: String(error) };
  }
}

async function enrichAllPosts(): Promise<{ 
  total_processed: number; 
  successful: number; 
  failed: number; 
  duration_ms: number;
}> {
  const startTime = Date.now();
  console.log("Starting batch enrichment of all unenriched posts...");
  
  // Get total count first
  let countQuery = supabase.from('posts').select('*', { count: 'exact', head: true });
  
  if (OPENAI_API_KEY) {
    // Count posts without embeddings (fallback heuristics) or never enriched
    countQuery = countQuery.or('sentiment.is.null,keywords.is.null,embedding.is.null,enrich_status.neq.completed');
  } else {
    // Only count completely unenriched posts if no OpenAI key
    countQuery = countQuery.or('sentiment.is.null,keywords.is.null,enrich_status.neq.completed');
  }
  
  const { count: totalUnenriched, error: countError } = await countQuery;
    
  if (countError) {
    throw new Error(`Failed to count posts: ${countError.message}`);
  }
  
  console.log(`Found ${totalUnenriched || 0} posts needing enrichment`);
  
  let totalProcessed = 0;
  let successful = 0;
  let failed = 0;
  let offset = 0;
  
  while (true) {
    // Fetch posts that need enrichment (including those enriched with fallback heuristics)
    // If OpenAI is available, also re-enrich posts that don't have embeddings (fallback-enriched posts)
    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (OPENAI_API_KEY) {
      // Re-enrich posts without embeddings (fallback heuristics) or never enriched
      query = query.or('sentiment.is.null,keywords.is.null,embedding.is.null,enrich_status.neq.completed');
    } else {
      // Only enrich completely unenriched posts if no OpenAI key
      query = query.or('sentiment.is.null,keywords.is.null,enrich_status.neq.completed');
    }
    
    const { data: posts, error } = await query;
      
    if (error) {
      console.error(`Failed to fetch posts at offset ${offset}:`, error);
      break;
    }
    
    if (!posts || posts.length === 0) {
      console.log("No more posts to process");
      break;
    }
    
    console.log(`Processing batch: ${posts.length} posts (offset: ${offset})`);
    
    // Process posts with controlled concurrency to avoid overwhelming OpenAI API
    for (let i = 0; i < posts.length; i += CONCURRENT_REQUESTS) {
      const chunk = posts.slice(i, i + CONCURRENT_REQUESTS);
      console.log(`Processing posts ${i + 1} to ${Math.min(i + chunk.length, posts.length)} of ${posts.length} in this batch`);
      
      const enrichPromises = chunk.map(async (post) => {
        const result = await enrichPost(post);
        if (result.success) {
          successful++;
        } else {
          failed++;
          console.error(`Failed to enrich post ${post.id}: ${result.error}`);
        }
        return result;
      });
      
      await Promise.all(enrichPromises);
      
      // Small delay between concurrent chunks to be gentle on API
      if (i + CONCURRENT_REQUESTS < posts.length) {
        await sleep(1000); // 1 second between concurrent chunks
      }
    }
    totalProcessed += posts.length;
    
    console.log(`Batch complete: ${successful}/${totalProcessed} successful, ${failed} failed`);
    
    // Progress update
    if (totalProcessed % 100 === 0) {
      const elapsed = Date.now() - startTime;
      const rate = totalProcessed / (elapsed / 1000);
      console.log(`Progress: ${totalProcessed}/${totalUnenriched} posts (${rate.toFixed(1)} posts/sec)`);
    }
    
    // Small delay between batches
    await sleep(INTER_BATCH_DELAY);
    offset += BATCH_SIZE;
  }
  
  const duration = Date.now() - startTime;
  console.log(`Enrichment complete: ${successful}/${totalProcessed} successful in ${duration}ms`);
  
  return {
    total_processed: totalProcessed,
    successful,
    failed,
    duration_ms: duration
  };
}

// Routes
app.get('/', (req, res) => {
  res.json({
    service: 'Enrichment Service',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      health: '/health',
      enrichAll: '/enrich-all',
      config: '/config'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: 'railway',
    service: 'enrichment',
    openai_configured: !!OPENAI_API_KEY,
    supabase_configured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  });
});

app.post('/enrich-all', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log("Starting enrichment job for all posts...");
    
    const result = await enrichAllPosts();
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      message: "Post enrichment completed successfully",
      ...result,
      duration_readable: `${Math.round(duration / 1000)}s`,
      platform_info: {
        name: "railway",
        service: "enrichment",
        version: "1.0.0"
      }
    });
    
  } catch (error) {
    console.error("Enrichment job failed:", error);
    const duration = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: String(error),
      duration_ms: duration,
      duration_readable: `${Math.round(duration / 1000)}s`,
      platform_info: {
        name: "railway",
        service: "enrichment",
        version: "1.0.0"
      }
    });
  }
});

// Auto-enrichment scheduler
const POLLING_INTERVAL = 30 * 1000; // 30 seconds for testing (change to 1 hour for production)
let isEnrichmentRunning = false;
let lastEnrichmentTime = Date.now();
let enrichmentStats = {
  totalProcessed: 0,
  lastRunTime: null as string | null,
  nextRunTime: null as string | null,
  isRunning: false
};

async function autoEnrichmentCheck() {
  if (isEnrichmentRunning) {
    console.log("Enrichment already running, skipping this cycle");
    return;
  }

  try {
    console.log("🔍 Checking for posts needing enrichment...");
    
    // Quick count of posts needing enrichment
    let countQuery = supabase.from('posts').select('*', { count: 'exact', head: true });
    
    if (OPENAI_API_KEY) {
      countQuery = countQuery.or('sentiment.is.null,keywords.is.null,embedding.is.null,enrich_status.neq.completed');
    } else {
      countQuery = countQuery.or('sentiment.is.null,keywords.is.null,enrich_status.neq.completed');
    }
    
    const { count } = await countQuery;
    
    if (count && count > 0) {
      console.log(`📊 Found ${count} posts needing enrichment - starting auto-enrichment`);
      isEnrichmentRunning = true;
      enrichmentStats.isRunning = true;
      enrichmentStats.lastRunTime = new Date().toISOString();
      
      const result = await enrichAllPosts();
      
      enrichmentStats.totalProcessed += result.successful;
      console.log(`✅ Auto-enrichment completed: ${result.successful}/${result.total_processed} successful`);
    } else {
      console.log("✨ All posts are enriched - no action needed");
    }
  } catch (error) {
    console.error("❌ Auto-enrichment error:", error);
  } finally {
    isEnrichmentRunning = false;
    enrichmentStats.isRunning = false;
    lastEnrichmentTime = Date.now();
    enrichmentStats.nextRunTime = new Date(Date.now() + POLLING_INTERVAL).toISOString();
  }
}

// Start auto-enrichment scheduler
function startAutoEnrichment() {
  console.log(`🤖 Starting auto-enrichment scheduler (every ${POLLING_INTERVAL/1000} seconds)`);
  enrichmentStats.nextRunTime = new Date(Date.now() + POLLING_INTERVAL).toISOString();
  
  // Run immediately on startup
  setTimeout(autoEnrichmentCheck, 5000); // Wait 5 seconds for server to be ready
  
  // Then run on interval
  setInterval(autoEnrichmentCheck, POLLING_INTERVAL);
}

// Add scheduler status endpoint
app.get('/scheduler', (req, res) => {
  res.json({
    status: 'active',
    polling_interval_seconds: POLLING_INTERVAL / 1000,
    is_enrichment_running: isEnrichmentRunning,
    last_enrichment_time: new Date(lastEnrichmentTime).toISOString(),
    stats: enrichmentStats,
    uptime_seconds: Math.floor(process.uptime()),
    openai_configured: !!OPENAI_API_KEY
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Enrichment Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`⚡ Enrich endpoint: http://localhost:${PORT}/enrich-all`);
  console.log(`📅 Scheduler status: http://localhost:${PORT}/scheduler`);
  
  // Start the auto-enrichment scheduler
  startAutoEnrichment();
});