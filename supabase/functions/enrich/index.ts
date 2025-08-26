// supabase/functions/enrich/index.ts
// Enhanced Edge Function to enrich posts with sentiment/keywords/embedding
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Function version and configuration
const FUNCTION_VERSION = "3.0.0";
const LAST_UPDATED = "2025-01-14T22:30:00Z";

// OpenAI Configuration
const CLASSIFIER_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-large";
const EXPECTED_EMBED_DIM = 1536; // Reduced dimensions for compatibility
const EMBEDDING_DIMENSIONS = 1536;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000; // 30s per OpenAI call
const EMBED_CHAR_LIMIT = 6000;

// Processing Configuration
const BATCH_SIZE = 10; // Process posts in smaller batches
const CONCURRENT_REQUESTS = 3; // More conservative concurrent requests
const MAX_PROCESSING_TIME = 14 * 60 * 1000; // 14 minutes (leave 1 min buffer)
const INTER_BATCH_DELAY = 1000; // 1 second delay between batches

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

// Removed fallback heuristics - AI-only approach for consistency

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
  const numVectors = vectors.length;
  if (numVectors === 1) return vectors[0];
  
  const dimensions = vectors[0].length;
  const result = new Array(dimensions).fill(0);
  
  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      result[i] += vector[i];
    }
  }
  
  for (let i = 0; i < dimensions; i++) {
    result[i] /= numVectors;
  }
  
  return result;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAIWithRetry(body: any): Promise<any> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }, TIMEOUT_MS);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = new Error(`OpenAI ${response.status}: ${errorText.slice(0, 300)}`);
        
        // Retry on rate limit or server errors
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw lastError;
      }
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError!;
}

async function classifyText(text: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.error("No OPENAI_API_KEY — cannot perform AI analysis");
    throw new Error("OpenAI API key required for classification");
  }
  
  const systemPrompt = `You are a JSON-only classifier for social media posts. Return strictly valid JSON with these keys:
- sentiment_label: "negative" | "neutral" | "positive"
- sentiment_score: number in [-1, 1] where -1 is very negative, 0 is neutral, 1 is very positive
- is_complaint: boolean (true if expressing frustration, problems, or complaints)
- keywords: array of 3-8 relevant lowercase keywords/phrases from the text`;
  
  try {
    const response = await callOpenAIWithRetry({
      model: CLASSIFIER_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text.slice(0, 8000) }
      ]
    });
    
    const content = response?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error("Classification failed:", error);
    throw error; // Don't use fallback - let it fail properly
  }
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
    let lastError: any;
    
    // Retry embedding with exponential backoff
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
            model: EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIMENSIONS
          })
        }, TIMEOUT_MS);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          lastError = new Error(`OpenAI Embedding ${response.status}: ${errorText.slice(0, 200)}`);
          
          // Retry on 503, 429, or 5xx errors
          if (response.status === 503 || response.status === 429 || (response.status >= 500 && response.status < 600)) {
            console.warn(`Embedding attempt ${attempt}/${MAX_RETRIES} failed for chunk ${i + 1}: ${response.status} - retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt * attempt)); // Exponential backoff
            continue;
          }
          
          // Don't retry on client errors (4xx except 429)
          console.error(`Embedding failed for chunk ${i + 1}/${chunks.length}:`, response.status, errorText.slice(0, 200));
          break;
        }
        
        const data = await response.json();
        const vector = data?.data?.[0]?.embedding;
        
        if (Array.isArray(vector) && vector.length === EXPECTED_EMBED_DIM) {
          vectors.push(vector);
          break; // Success - exit retry loop
        } else {
          console.error(`Invalid vector dimensions for chunk ${i + 1}: expected ${EXPECTED_EMBED_DIM}, got ${vector?.length}`);
          break;
        }
        
      } catch (error) {
        lastError = error;
        console.warn(`Embedding attempt ${attempt}/${MAX_RETRIES} error for chunk ${i + 1}:`, error);
        
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt * attempt));
        }
      }
    }
    
    if (lastError && vectors.length === 0) {
      console.error(`All embedding attempts failed for chunk ${i + 1}:`, lastError);
    }
  }
  
  return vectors.length > 0 ? meanVectors(vectors) : null;
}

async function processPostBatch(posts: any[], supabase: any): Promise<{ success: number, failed: number }> {
  let success = 0;
  let failed = 0;
  
  // Process posts in parallel with concurrency limit
  const semaphore = new Array(CONCURRENT_REQUESTS).fill(null);
  let postIndex = 0;
  
  const processPost = async (post: any) => {
    try {
      const text = `${post.title || ""}\n${post.body || ""}`.trim();
      
      // Run classification and embedding in parallel
      const [classification, embedding] = await Promise.all([
        classifyText(text),
        post.embedding ? Promise.resolve(null) : embedText(text)
      ]);
      
      const updateData: any = {
        sentiment: typeof classification?.sentiment_score === "number" ? classification.sentiment_score : null,
        is_complaint: Boolean(classification?.is_complaint),
        keywords: Array.isArray(classification?.keywords) ? classification.keywords : [],
        enriched_at: new Date().toISOString(),
        enrich_status: "completed"
      };
      
      if (embedding && Array.isArray(embedding)) {
        updateData.embedding = embedding;
      }
      
      const { error } = await supabase
        .from("posts")
        .update(updateData)
        .eq("id", post.id);
      
      if (error) {
        console.error(`Failed to update post ${post.id}:`, error);
        failed++;
      } else {
        success++;
      }
    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error);
      failed++;
    }
  };
  
  // Process with concurrency control
  const workers = semaphore.map(async () => {
    while (postIndex < posts.length) {
      const currentIndex = postIndex++;
      if (currentIndex < posts.length) {
        await processPost(posts[currentIndex]);
      }
    }
  });
  
  await Promise.all(workers);
  return { success, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }
  
  const startTime = Date.now();
  
  try {
    console.log("Starting enhanced enrichment process...");
    
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required Supabase environment variables");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let batchCount = 0;
    
    console.log("Fetching posts that need enrichment...");
    
    // Process all unenriched posts in batches
    while (Date.now() - startTime < MAX_PROCESSING_TIME) {
      // Fetch posts that haven't been enriched yet
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, title, body, embedding, sentiment, enriched_at")
        .or("enriched_at.is.null,sentiment.is.null,embedding.is.null")
        .limit(BATCH_SIZE);
      
      if (error) {
        console.error("Error fetching posts:", error);
        break;
      }
      
      if (!posts || posts.length === 0) {
        console.log("No more posts to enrich");
        break;
      }
      
      console.log(`Processing batch ${++batchCount} with ${posts.length} posts...`);
      
      const batchResult = await processPostBatch(posts, supabase);
      totalProcessed += posts.length;
      totalSuccess += batchResult.success;
      totalFailed += batchResult.failed;
      
      console.log(`Batch ${batchCount} complete: ${batchResult.success} success, ${batchResult.failed} failed`);
      
      // Delay between batches to reduce API pressure
      await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY));
    }
    
    const duration = Date.now() - startTime;
    const result = {
      status: "success",
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      },
      stats: {
        total_processed: totalProcessed,
        successful: totalSuccess,
        failed: totalFailed,
        batches: batchCount,
        duration_ms: duration,
        duration_minutes: Math.round(duration / 60000 * 10) / 10
      },
      completed_all: totalProcessed === 0 || (Date.now() - startTime < MAX_PROCESSING_TIME)
    };
    
    console.log("Enrichment complete:", result);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
    
  } catch (error) {
    console.error("Enrichment function error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      },
      duration_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
  }
});