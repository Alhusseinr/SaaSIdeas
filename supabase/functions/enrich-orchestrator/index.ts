// Enrichment orchestrator - coordinates background enrichment with job tracking
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function version and metadata
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-17T12:00:00Z";

// Security configuration
const ENRICH_API_KEY = Deno.env.get("ENRICH_API_KEY");
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 3;

// Processing configuration
const BATCH_SIZE = 20;
const CONCURRENT_REQUESTS = 5;
const MAX_PROCESSING_TIME = 25 * 60 * 1000; // 25 minutes (Edge Function limit is 30min)
const INTER_BATCH_DELAY = 2000; // 2 second delay between batches
const OPENAI_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number, windowStart: number }>();

interface EnrichJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: {
    current_step: string;
    total_steps: number;
    completed_steps: number;
    posts_processed: number;
    posts_total: number;
    current_batch: number;
    total_batches: number;
    posts_success: number;
    posts_failed: number;
  };
  result?: any;
  error?: string;
  parameters: any;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
  };
}

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  
  return "unknown";
}

function checkRateLimit(clientIP: string): { allowed: boolean, remainingRequests: number } {
  const now = Date.now();
  const key = clientIP;
  
  // Clean up old entries
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
  
  const clientData = rateLimitMap.get(key);
  
  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remainingRequests: MAX_REQUESTS_PER_WINDOW - 1 };
  }
  
  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remainingRequests: 0 };
  }
  
  clientData.count++;
  return { allowed: true, remainingRequests: MAX_REQUESTS_PER_WINDOW - clientData.count };
}

function generateJobId(): string {
  return `enrich_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function getJob(jobId: string): Promise<EnrichJob | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from("enrich_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
    
  if (error || !data) {
    return null;
  }
  
  return {
    id: data.id,
    status: data.status,
    created_at: data.created_at,
    started_at: data.started_at,
    completed_at: data.completed_at,
    progress: data.progress,
    result: data.result,
    error: data.error,
    parameters: data.parameters
  };
}

async function createJob(job: EnrichJob): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { error } = await supabase
    .from("enrich_jobs")
    .insert({
      id: job.id,
      status: job.status,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      progress: job.progress,
      result: job.result,
      error: job.error,
      parameters: job.parameters
    });
    
  if (error) {
    console.error("Failed to create enrich job:", error);
    throw new Error(`Failed to create enrich job: ${error.message}`);
  }
  
  console.log(`Created enrich job ${job.id} in database`);
}

async function updateJobStatus(jobId: string, updates: Partial<EnrichJob>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { error } = await supabase
    .from("enrich_jobs")
    .update(updates)
    .eq("id", jobId);
    
  if (error) {
    console.error(`Failed to update enrich job ${jobId}:`, error);
  }
}

// Fallback heuristics for when OpenAI is not available
function fallbackHeuristics(text: string) {
  const low = text.toLowerCase();
  const complaintTerms = [
    "annoying", "frustrat", "i hate", "wish there was", "why is it so hard",
    "broken", "useless", "terrible", "buggy", "hate", "sucks", "pain",
    "doesn't work", "so slow", "awful", "worst", "horrible"
  ];
  
  const match = complaintTerms.some(t => low.includes(t));
  
  const negativeWords = ["hate", "annoying", "terrible", "useless", "broken", "bad", "worst", "pain", "sucks", "awful"];
  const positiveWords = ["love", "great", "awesome", "amazing", "fantastic", "excellent", "perfect"];
  
  const negCount = negativeWords.filter(w => low.includes(w)).length;
  const posCount = positiveWords.filter(w => low.includes(w)).length;
  
  const score = Math.max(-1, Math.min(1, (posCount - negCount) / 3));
  const label = score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
  
  // Extract keywords - remove common words and get meaningful terms
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
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

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
      }, OPENAI_TIMEOUT_MS);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = new Error(`OpenAI ${response.status}: ${errorText.slice(0, 300)}`);
        
        // Retry on rate limit or server errors
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt * attempt));
          continue;
        }
        throw lastError;
      }
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt * attempt));
      }
    }
  }
  
  throw lastError!;
}

async function classifyText(text: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — using fallback heuristics");
    return fallbackHeuristics(text);
  }
  
  const systemPrompt = `You are a JSON-only classifier for social media posts. Return strictly valid JSON with these keys:
- sentiment_label: "negative" | "neutral" | "positive"
- sentiment_score: number in [-1, 1] where -1 is very negative, 0 is neutral, 1 is very positive
- is_complaint: boolean (true if expressing frustration, problems, or complaints)
- keywords: array of 3-8 relevant lowercase keywords/phrases from the text`;
  
  try {
    const response = await callOpenAIWithRetry({
      model: "gpt-4o-mini",
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
    return fallbackHeuristics(text);
  }
}

async function processPostBatch(
  posts: any[], 
  supabase: any, 
  jobId: string,
  batchNumber: number,
  totalBatches: number
): Promise<{ success: number, failed: number }> {
  let success = 0;
  let failed = 0;
  
  // Process posts in parallel with concurrency limit
  const semaphore = new Array(CONCURRENT_REQUESTS).fill(null);
  let postIndex = 0;
  
  const processPost = async (post: any) => {
    try {
      const text = `${post.title || ""}\n${post.body || ""}`.trim();
      
      // Only classify if not already done
      let classification = null;
      if (post.sentiment === null || post.keywords === null) {
        classification = await classifyText(text);
      }
      
      const updateData: any = {
        enriched_at: new Date().toISOString(),
        enrich_status: "completed"
      };
      
      if (classification) {
        updateData.sentiment = typeof classification?.sentiment_score === "number" ? classification.sentiment_score : null;
        updateData.is_complaint = Boolean(classification?.is_complaint);
        updateData.keywords = Array.isArray(classification?.keywords) ? classification.keywords : [];
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
        
        // Update progress for each post processed
        await updateJobStatus(jobId, {
          progress: {
            current_step: `Processing batch ${batchNumber}/${totalBatches}`,
            total_steps: 4,
            completed_steps: 2,
            posts_processed: success + failed,
            posts_total: posts.length,
            current_batch: batchNumber,
            total_batches: totalBatches,
            posts_success: success,
            posts_failed: failed
          }
        });
      }
    }
  });
  
  await Promise.all(workers);
  return { success, failed };
}

async function executeEnrichmentJob(jobId: string, parameters: any): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    await updateJobStatus(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: {
        current_step: 'Counting posts to enrich',
        total_steps: 4,
        completed_steps: 0,
        posts_processed: 0,
        posts_total: 0,
        current_batch: 0,
        total_batches: 0,
        posts_success: 0,
        posts_failed: 0
      }
    });

    const startTime = Date.now();
    console.log(`Job ${jobId}: Starting enrichment process...`);

    // Count total posts to process
    const { count: totalPostsCount, error: countError } = await supabase
      .from("posts")
      .select("*", { count: 'exact', head: true })
      .or("enriched_at.is.null,sentiment.is.null");
    
    if (countError) {
      throw new Error(`Failed to count posts: ${countError.message}`);
    }

    const totalPosts = totalPostsCount || 0;
    const totalBatches = Math.ceil(totalPosts / BATCH_SIZE);

    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Starting batch processing',
        total_steps: 4,
        completed_steps: 1,
        posts_processed: 0,
        posts_total: totalPosts,
        current_batch: 0,
        total_batches: totalBatches,
        posts_success: 0,
        posts_failed: 0
      }
    });

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let batchCount = 0;
    
    // Process posts in batches
    while (Date.now() - startTime < MAX_PROCESSING_TIME) {
      // Fetch next batch of posts
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, title, body, sentiment, keywords, enriched_at")
        .or("enriched_at.is.null,sentiment.is.null")
        .order("created_at", { ascending: false }) // Process recent posts first
        .limit(BATCH_SIZE);
      
      if (error) {
        console.error("Error fetching posts:", error);
        break;
      }
      
      if (!posts || posts.length === 0) {
        console.log("No more posts to enrich");
        break;
      }
      
      batchCount++;
      console.log(`Job ${jobId}: Processing batch ${batchCount}/${totalBatches} with ${posts.length} posts...`);
      
      const batchResult = await processPostBatch(posts, supabase, jobId, batchCount, totalBatches);
      totalProcessed += posts.length;
      totalSuccess += batchResult.success;
      totalFailed += batchResult.failed;
      
      console.log(`Job ${jobId}: Batch ${batchCount} complete: ${batchResult.success} success, ${batchResult.failed} failed`);
      
      // Update progress after each batch
      await updateJobStatus(jobId, {
        progress: {
          current_step: `Completed batch ${batchCount}/${totalBatches}`,
          total_steps: 4,
          completed_steps: 2,
          posts_processed: totalProcessed,
          posts_total: totalPosts,
          current_batch: batchCount,
          total_batches: totalBatches,
          posts_success: totalSuccess,
          posts_failed: totalFailed
        }
      });
      
      // Delay between batches to reduce API pressure
      await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY));
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      status: "success",
      architecture: "orchestrated_enrichment",
      duration_ms: duration,
      duration_minutes: Math.round(duration / 60000 * 10) / 10,
      stats: {
        total_processed: totalProcessed,
        successful: totalSuccess,
        failed: totalFailed,
        batches: batchCount,
        posts_per_minute: Math.round((totalProcessed / (duration / 60000)) * 10) / 10
      },
      completed_all: totalProcessed === 0 || (Date.now() - startTime < MAX_PROCESSING_TIME),
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        orchestrator: true
      }
    };

    await updateJobStatus(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: {
        current_step: 'Completed',
        total_steps: 4,
        completed_steps: 4,
        posts_processed: totalProcessed,
        posts_total: totalPosts,
        current_batch: batchCount,
        total_batches: totalBatches,
        posts_success: totalSuccess,
        posts_failed: totalFailed
      },
      result
    });

    console.log(`Job ${jobId}: Enrichment completed successfully:`, result);

  } catch (error) {
    console.error(`Job ${jobId}: Enrichment error:`, error);
    
    await updateJobStatus(jobId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: String(error)
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const url = new URL(req.url);

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Only POST requests are supported for triggering enrichment jobs"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Security checks
    const clientIP = getClientIP(req);
    console.log(`Enrich orchestrator request from IP: ${clientIP}`);
    
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({
        error: "Rate limit exceeded. Maximum 3 requests per minute.",
        retryAfter: 60
      }), {
        status: 429,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
          "Retry-After": "60"
        }
      });
    }
    
    // Optional API key check
    if (ENRICH_API_KEY) {
      const providedKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== ENRICH_API_KEY) {
        console.warn(`Invalid API key from IP: ${clientIP}`);
        return new Response(JSON.stringify({
          error: "Invalid or missing API key"
        }), {
          status: 401,
          headers: { ...corsHeaders(), "Content-Type": "application/json" }
        });
      }
    }

    // Create new enrichment job
    const jobId = generateJobId();
    const nowISO = new Date().toISOString();
    
    // Parse parameters
    const jobParameters = {
      batch_size: parseInt(url.searchParams.get("batch_size") || String(BATCH_SIZE)),
      concurrent_requests: parseInt(url.searchParams.get("concurrent_requests") || String(CONCURRENT_REQUESTS)),
      priority: url.searchParams.get("priority") || "recent_first"
    };

    const job: EnrichJob = {
      id: jobId,
      status: 'pending',
      created_at: nowISO,
      parameters: jobParameters
    };
    
    await createJob(job);
    
    console.log(`Created enrichment job ${jobId} with parameters:`, jobParameters);

    // Start enrichment in background
    executeEnrichmentJob(jobId, jobParameters).catch(error => {
      console.error(`Background enrichment job ${jobId} failed:`, error);
    });

    // Return immediately with job ID
    return new Response(JSON.stringify({
      status: "triggered",
      message: "Enrichment job has been triggered successfully",
      architecture: "orchestrated_enrichment",
      job_id: jobId,
      created_at: nowISO,
      parameters: jobParameters,
      status_url: `${url.origin}/functions/v1/job-status?job_id=${jobId}`,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        orchestrator: true
      }
    }), {
      status: 202,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Enrich orchestrator trigger error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: "Failed to trigger enrichment job",
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        orchestrator: true
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});