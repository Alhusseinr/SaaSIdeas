// Summarization orchestrator - coordinates background summarization with job tracking
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function version and metadata
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-17T16:00:00Z";

// Security configuration
const SUMMARY_API_KEY = Deno.env.get("SUMMARY_API_KEY");
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 3;

// Processing configuration - Ultra conservative for stability
const BATCH_SIZE = 8; // Smaller batches for summaries (more complex than sentiment)
const CONCURRENT_REQUESTS = 2; // Conservative concurrency
const MAX_PROCESSING_TIME = 12 * 60 * 1000; // 12 minutes
const INTER_BATCH_DELAY = 3000; // Delays for stability
const OPENAI_TIMEOUT_MS = 20000; // Longer timeout for summaries
const MAX_RETRIES = 3;
const SAFETY_BUFFER_MS = 3 * 60 * 1000; // 3 minutes safety buffer
const MAX_POSTS_PER_RUN = 100; // Increased limit for summary processing

// Enhanced reliability configuration
const OPENAI_RATE_LIMIT_DELAY = 60000; // 1 minute delay for rate limit
const EXPONENTIAL_BACKOFF_BASE = 1000; // 1 second base delay
const MAX_EXPONENTIAL_DELAY = 30000; // 30 seconds max delay
const CIRCUIT_BREAKER_THRESHOLD = 5; // Fail fast after 5 consecutive failures
const FALLBACK_USAGE_THRESHOLD = 0.7; // Use fallback when 70% of requests fail

// Smart batching configuration
const SMALL_POST_THRESHOLD = 500; // Characters
const LARGE_POST_THRESHOLD = 3000; // Characters
const COMPLEX_POST_INDICATORS = ['code', 'json', 'xml', 'html', 'css', 'javascript', 'python', 'sql'];
const SMALL_BATCH_SIZE = 12; // For short posts
const LARGE_BATCH_SIZE = 4; // For long/complex posts

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number, windowStart: number }>();

// Database connection pooling
interface DatabaseConnection {
  client: any;
  inUse: boolean;
  lastUsed: number;
  createdAt: number;
}

class DatabasePool {
  private pool: DatabaseConnection[] = [];
  private readonly maxConnections = 5;
  private readonly connectionTimeout = 5 * 60 * 1000; // 5 minutes
  
  async getConnection(): Promise<any> {
    let connection = this.pool.find(conn => !conn.inUse);
    
    if (connection) {
      const age = Date.now() - connection.createdAt;
      if (age > this.connectionTimeout) {
        this.pool = this.pool.filter(c => c !== connection);
        connection = null;
      } else {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        return connection.client;
      }
    }
    
    if (this.pool.length < this.maxConnections) {
      const client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const newConnection: DatabaseConnection = {
        client,
        inUse: true,
        lastUsed: Date.now(),
        createdAt: Date.now()
      };
      this.pool.push(newConnection);
      return client;
    }
    
    return new Promise((resolve) => {
      const checkForConnection = () => {
        const available = this.pool.find(conn => !conn.inUse);
        if (available) {
          available.inUse = true;
          available.lastUsed = Date.now();
          resolve(available.client);
        } else {
          setTimeout(checkForConnection, 100);
        }
      };
      checkForConnection();
    });
  }
  
  releaseConnection(client: any): void {
    const connection = this.pool.find(conn => conn.client === client);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }
  
  cleanup(): void {
    const now = Date.now();
    this.pool = this.pool.filter(conn => {
      const age = now - conn.lastUsed;
      return age < this.connectionTimeout && !conn.inUse;
    });
  }
}

const dbPool = new DatabasePool();

// Enhanced reliability tracking
interface ReliabilityState {
  openaiFailures: number;
  consecutiveFailures: number;
  lastFailureTime: number;
  totalRequests: number;
  failedRequests: number;
  rateLimitHits: number;
  circuitBreakerOpen: boolean;
  fallbackMode: boolean;
}

const reliabilityState: ReliabilityState = {
  openaiFailures: 0,
  consecutiveFailures: 0,
  lastFailureTime: 0,
  totalRequests: 0,
  failedRequests: 0,
  rateLimitHits: 0,
  circuitBreakerOpen: false,
  fallbackMode: false
};

interface SummaryJob {
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
  return `summary_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function getJob(jobId: string): Promise<SummaryJob | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
    const { data, error } = await supabase
      .from("summary_jobs")
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
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

async function createJob(job: SummaryJob): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
    const { error } = await supabase
      .from("summary_jobs")
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
      console.error("Failed to create summary job:", error);
      throw new Error(`Failed to create summary job: ${error.message}`);
    }
    
    console.log(`Created summary job ${job.id} in database`);
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

async function updateJobStatus(jobId: string, updates: Partial<SummaryJob>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
    const { error } = await supabase
      .from("summary_jobs")
      .update(updates)
      .eq("id", jobId);
      
    if (error) {
      console.error(`Failed to update summary job ${jobId}:`, error);
    }
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

// Fallback heuristics for when OpenAI is not available
function fallbackSummary(post: any): string {
  const text = `${post.title || ""}\n${post.body || ""}`.trim();
  const truncated = text.slice(0, 200);
  
  // Try to extract key complaint indicators
  const complaintTerms = [
    "frustrat", "annoying", "broken", "terrible", "awful", "worst", "hate", 
    "slow", "bug", "crash", "error", "fail", "problem", "issue"
  ];
  
  const foundTerms = complaintTerms.filter(term => 
    text.toLowerCase().includes(term)
  ).slice(0, 3);
  
  let summary = "";
  if (foundTerms.length > 0) {
    summary = `Users report issues with ${foundTerms.join(", ")}-related problems`;
  } else {
    summary = "User complaint about product/service experience";
  }
  
  if (truncated) {
    summary += `: ${truncated}${text.length > 200 ? "..." : ""}`;
  }
  
  return summary;
}

// Smart text processing for summaries
function cleanForSummary(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // Remove code blocks
    .replace(/`[^`]*`/g, " ") // Remove inline code
    .replace(/https?:\/\/\S+/g, " ") // Remove URLs
    .replace(/<[^>]+>/g, " ") // Remove HTML tags
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

// Post complexity analysis for smart batching
function analyzePostComplexity(post: any): { complexity: 'simple' | 'medium' | 'complex', priority: number } {
  const text = `${post.title || ""}\n${post.body || ""}`.toLowerCase();
  const textLength = text.length;
  
  const hasCodeIndicators = COMPLEX_POST_INDICATORS.some(indicator => text.includes(indicator));
  const hasMultipleLanguages = /[^\x00-\x7F]/.test(text);
  const hasComplexFormatting = (text.match(/[{}[\]()]/g) || []).length > 5;
  const hasLongWords = text.split(/\s+/).some(word => word.length > 20);
  
  let complexity: 'simple' | 'medium' | 'complex' = 'simple';
  if (textLength > LARGE_POST_THRESHOLD || hasCodeIndicators || hasLongWords) {
    complexity = 'complex';
  } else if (textLength > SMALL_POST_THRESHOLD || hasMultipleLanguages || hasComplexFormatting) {
    complexity = 'medium';
  }
  
  // Calculate priority (higher = more important)
  let priority = 0;
  
  // Recent posts get higher priority
  const postAge = Date.now() - new Date(post.created_at).getTime();
  const daysSincePost = postAge / (1000 * 60 * 60 * 24);
  priority += Math.max(0, 100 - daysSincePost * 10);
  
  // More negative sentiment gets higher priority
  if (post.sentiment !== null) {
    const sentimentScore = Math.abs(post.sentiment);
    priority += sentimentScore * 50; // More negative = higher priority
  }
  
  // Complaint indicators boost priority
  const complaintTerms = ['frustrated', 'annoying', 'broken', 'hate', 'terrible', 'awful', 'worst'];
  const complaintCount = complaintTerms.filter(term => text.includes(term)).length;
  priority += complaintCount * 20;
  
  return { complexity, priority };
}

// Smart batching based on complexity and priority
function createSmartBatches(posts: any[]): any[][] {
  const analyzedPosts = posts.map(post => ({
    ...post,
    analysis: analyzePostComplexity(post)
  }));
  
  // Sort by priority (highest first)
  analyzedPosts.sort((a, b) => b.analysis.priority - a.analysis.priority);
  
  const batches: any[][] = [];
  const simple: any[] = [];
  const medium: any[] = [];
  const complex: any[] = [];
  
  // Separate by complexity
  for (const post of analyzedPosts) {
    switch (post.analysis.complexity) {
      case 'simple':
        simple.push(post);
        break;
      case 'medium':
        medium.push(post);
        break;
      case 'complex':
        complex.push(post);
        break;
    }
  }
  
  // Create batches with appropriate sizes
  const createBatchesFromArray = (arr: any[], batchSize: number) => {
    for (let i = 0; i < arr.length; i += batchSize) {
      batches.push(arr.slice(i, i + batchSize));
    }
  };
  
  // Process complex posts first (smaller batches)
  createBatchesFromArray(complex, LARGE_BATCH_SIZE);
  
  // Then medium posts
  createBatchesFromArray(medium, BATCH_SIZE);
  
  // Finally simple posts (larger batches)
  createBatchesFromArray(simple, SMALL_BATCH_SIZE);
  
  return batches;
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

// Enhanced OpenAI integration with circuit breaker and exponential backoff
async function summarizeWithReliability(post: any): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — using fallback summary");
    return fallbackSummary(post);
  }

  // Check circuit breaker
  if (reliabilityState.circuitBreakerOpen) {
    const timeSinceLastFailure = Date.now() - reliabilityState.lastFailureTime;
    if (timeSinceLastFailure < OPENAI_RATE_LIMIT_DELAY) {
      console.warn("Circuit breaker open, using fallback");
      return fallbackSummary(post);
    } else {
      console.log("Circuit breaker cooling off, attempting request");
      reliabilityState.circuitBreakerOpen = false;
      reliabilityState.consecutiveFailures = 0;
    }
  }

  const cleanedText = cleanForSummary(`${post.title || ""}\n${post.body || ""}`);
  const systemPrompt = `You are an expert product researcher analyzing customer complaints.

Your task: Create a concise, actionable business summary of this complaint post.

Requirements:
- 4-6 sentences maximum
- Focus on the core problem/pain point
- Use business-friendly language
- Highlight potential opportunity areas
- No metadata, disclaimers, or JSON formatting
- Return ONLY the summary text

Example format: "Users struggle with slow loading times on mobile apps, particularly during peak hours, creating frustration and potential churn opportunities."`;

  const userPrompt = `Analyze this complaint post and provide a business summary:

Title: ${post.title || "No title"}
Content: ${cleanedText.slice(0, 6000) || "No content"}
Platform: ${post.platform || "Unknown"}
URL: ${post.url || "N/A"}`;

  let lastError: any;
  reliabilityState.totalRequests++;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 150,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      }, OPENAI_TIMEOUT_MS);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = new Error(`OpenAI ${response.status}: ${errorText.slice(0, 300)}`);
        
        if (response.status === 429) {
          reliabilityState.rateLimitHits++;
          console.warn(`Rate limit hit for post ${post.id}, attempt ${attempt}/${MAX_RETRIES}`);
          
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, OPENAI_RATE_LIMIT_DELAY));
            continue;
          }
        } else if (response.status === 503 || (response.status >= 500 && response.status < 600)) {
          console.warn(`Server error ${response.status} for post ${post.id}, attempt ${attempt}/${MAX_RETRIES}`);
          
          if (attempt < MAX_RETRIES) {
            const delay = Math.min(
              EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
              MAX_EXPONENTIAL_DELAY
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        break;
      }

      const data = await response.json();
      const summary = data?.choices?.[0]?.message?.content?.trim();
      
      if (summary) {
        reliabilityState.consecutiveFailures = 0;
        return summary;
      } else {
        console.warn(`Empty response from OpenAI for post ${post.id}`);
        break;
      }

    } catch (error) {
      lastError = error;
      console.warn(`Summary attempt ${attempt}/${MAX_RETRIES} error for post ${post.id}:`, error);
      
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(
          EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
          MAX_EXPONENTIAL_DELAY
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Handle failure
  reliabilityState.failedRequests++;
  reliabilityState.consecutiveFailures++;
  reliabilityState.lastFailureTime = Date.now();
  
  if (reliabilityState.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    reliabilityState.circuitBreakerOpen = true;
    console.warn("Circuit breaker opened due to consecutive failures");
  }
  
  const failureRate = reliabilityState.failedRequests / reliabilityState.totalRequests;
  if (failureRate >= FALLBACK_USAGE_THRESHOLD) {
    reliabilityState.fallbackMode = true;
    console.warn("Entering fallback mode due to high failure rate");
  }

  console.error(`All summary attempts failed for post ${post.id}:`, lastError);
  return fallbackSummary(post);
}

// Main job execution function
async function executeSummaryJob(jobId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    await updateJobStatus(jobId, {
      status: 'running',
      started_at: new Date().toISOString()
    });

    const job = await getJob(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const supabase = await dbPool.getConnection();
    
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let batchCount = 0;
    const allDetails: any[] = [];

    console.log(`Starting summary job ${jobId}...`);

    // Process posts that need summarization
    while (Date.now() - startTime < MAX_PROCESSING_TIME && totalProcessed < MAX_POSTS_PER_RUN) {
      // Fetch negative complaint posts without summaries
      let query = supabase
        .from("posts")
        .select("id, title, body, url, platform, sentiment, is_complaint, created_at")
        .eq("is_complaint", true)
        .lt("sentiment", job.parameters?.sentiment_threshold || -0.1)
        .is("summary", null);

      // Add platform filter if specified
      if (job.parameters?.platform && job.parameters.platform !== "all") {
        query = query.eq("platform", job.parameters.platform);
      }

      const { data: posts, error } = await query
        .order("sentiment", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(Math.min(BATCH_SIZE * 3, MAX_POSTS_PER_RUN - totalProcessed));
      
      if (error) {
        console.error("Error fetching posts:", error);
        break;
      }
      
      if (!posts || posts.length === 0) {
        console.log("No more posts to summarize");
        break;
      }

      // Create smart batches
      const batches = createSmartBatches(posts);
      
      for (const batch of batches) {
        if (Date.now() - startTime >= MAX_PROCESSING_TIME || totalProcessed >= MAX_POSTS_PER_RUN) {
          break;
        }

        batchCount++;
        console.log(`Processing batch ${batchCount} with ${batch.length} posts...`);
        
        // Update progress
        await updateJobStatus(jobId, {
          progress: {
            current_step: `Processing batch ${batchCount}`,
            total_steps: batches.length,
            completed_steps: batchCount - 1,
            posts_processed: totalProcessed,
            posts_total: posts.length,
            current_batch: batchCount,
            total_batches: batches.length,
            posts_success: totalSuccess,
            posts_failed: totalFailed
          }
        });

        const batchResult = await processSummaryBatch(batch, supabase);
        totalProcessed += batch.length;
        totalSuccess += batchResult.success;
        totalFailed += batchResult.failed;
        allDetails.push(...batchResult.details);

        console.log(`Batch ${batchCount} complete: ${batchResult.success} success, ${batchResult.failed} failed`);
        
        // Inter-batch delay
        await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY));
      }
      
      // Safety check to prevent infinite loops
      if (posts.length < BATCH_SIZE) {
        break;
      }
    }

    dbPool.releaseConnection(supabase);
    
    const duration = Date.now() - startTime;
    const needsContinuation = totalProcessed >= MAX_POSTS_PER_RUN && (Date.now() - startTime < MAX_PROCESSING_TIME);
    
    const result = {
      total_processed: totalProcessed,
      successful: totalSuccess,
      failed: totalFailed,
      batches: batchCount,
      duration_ms: duration,
      duration_minutes: Math.round(duration / 60000 * 10) / 10,
      needs_continuation: needsContinuation,
      sample_details: allDetails.slice(0, 10),
      reliability_stats: {
        total_requests: reliabilityState.totalRequests,
        failed_requests: reliabilityState.failedRequests,
        rate_limit_hits: reliabilityState.rateLimitHits,
        circuit_breaker_open: reliabilityState.circuitBreakerOpen,
        fallback_mode: reliabilityState.fallbackMode
      }
    };

    await updateJobStatus(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: result
    });

    console.log(`Summary job ${jobId} completed:`, result);
    
  } catch (error) {
    console.error(`Summary job ${jobId} failed:`, error);
    
    await updateJobStatus(jobId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: String(error)
    });
    
    throw error;
  } finally {
    dbPool.cleanup();
  }
}

// Process a batch of posts for summarization
async function processSummaryBatch(posts: any[], supabase: any): Promise<{
  success: number;
  failed: number;
  details: any[];
}> {
  let success = 0;
  let failed = 0;
  const details: any[] = [];
  
  const semaphore = new Array(CONCURRENT_REQUESTS).fill(null);
  let postIndex = 0;
  
  const processPost = async (post: any) => {
    try {
      const summary = await summarizeWithReliability(post);
      
      const { error, data } = await supabase
        .from("posts")
        .update({
          summary: summary,
          summarized_at: new Date().toISOString(),
          summary_status: "completed"
        })
        .eq("id", post.id)
        .is("summary", null)
        .select("id");
      
      if (error) {
        console.error(`Failed to update post ${post.id}:`, error);
        failed++;
        details.push({ id: post.id, status: "failed", error: error.message });
      } else if (data && data.length > 0) {
        success++;
        details.push({ id: post.id, status: "success", summary: summary.slice(0, 100) + "..." });
      } else {
        details.push({ id: post.id, status: "skipped", reason: "already_summarized" });
      }
      
    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error);
      failed++;
      details.push({ id: post.id, status: "failed", error: String(error) });
    }
  };
  
  const workers = semaphore.map(async () => {
    while (postIndex < posts.length) {
      const currentIndex = postIndex++;
      if (currentIndex < posts.length) {
        await processPost(posts[currentIndex]);
      }
    }
  });
  
  await Promise.all(workers);
  return { success, failed, details };
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
        error: "Only POST requests are supported for triggering summarization jobs"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Security checks
    const clientIP = getClientIP(req);
    console.log(`Summary orchestrator request from IP: ${clientIP}`);
    
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
    if (SUMMARY_API_KEY) {
      const providedKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== SUMMARY_API_KEY) {
        console.warn(`Invalid API key from IP: ${clientIP}`);
        return new Response(JSON.stringify({
          error: "Invalid or missing API key"
        }), {
          status: 401,
          headers: { ...corsHeaders(), "Content-Type": "application/json" }
        });
      }
    }

    // Create new summarization job
    const jobId = generateJobId();
    const nowISO = new Date().toISOString();
    
    // Parse parameters
    const jobParameters = {
      batch_size: parseInt(url.searchParams.get("batch_size") || String(BATCH_SIZE)),
      concurrent_requests: parseInt(url.searchParams.get("concurrent_requests") || String(CONCURRENT_REQUESTS)),
      sentiment_threshold: parseFloat(url.searchParams.get("sentiment_threshold") || "-0.1"),
      priority: url.searchParams.get("priority") || "recent_negative_first",
      platform: url.searchParams.get("platform") || "all" // New platform filter
    };

    const job: SummaryJob = {
      id: jobId,
      status: 'pending',
      created_at: nowISO,
      parameters: jobParameters
    };
    
    await createJob(job);
    
    console.log(`Created summarization job ${jobId} with parameters:`, jobParameters);

    // Execute the job in the background (fire and forget)
    executeSummaryJob(jobId).catch(error => {
      console.error(`Background summary job ${jobId} failed:`, error);
    });
    
    // Return immediately with job ID
    return new Response(JSON.stringify({
      status: "triggered",
      message: "Summarization job has been triggered successfully",
      architecture: "orchestrated_summarization",
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
    console.error("Summary orchestrator trigger error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: "Failed to trigger summarization job",
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