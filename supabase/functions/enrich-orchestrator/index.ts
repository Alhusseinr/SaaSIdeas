// Enrichment orchestrator - coordinates background enrichment with job tracking
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Railway enrichment service configuration
const RAILWAY_ENRICHMENT_ENDPOINT = Deno.env.get("RAILWAY_ENRICHMENT_ENDPOINT") || "https://enrichment-production-8fd0.up.railway.app";

// Function version and metadata
const FUNCTION_VERSION = "2.0.0";
const LAST_UPDATED = "2025-01-17T15:00:00Z";

// Security configuration
const ENRICH_API_KEY = Deno.env.get("ENRICH_API_KEY");
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 3;

// Processing configuration - Ultra conservative for stability
const BATCH_SIZE = 10; // Much smaller batches
const CONCURRENT_REQUESTS = 2; // Minimal concurrency to prevent memory issues
const MAX_PROCESSING_TIME = 12 * 60 * 1000; // 12 minutes (much safer)
const INTER_BATCH_DELAY = 3000; // Longer delays for stability
const OPENAI_TIMEOUT_MS = 15000; // Shorter timeout
const MAX_RETRIES = 3; // Increased for better reliability
const SAFETY_BUFFER_MS = 3 * 60 * 1000; // 3 minutes safety buffer
const MAX_POSTS_PER_RUN = 200; // Increased limit on posts per function execution

// Embedding configuration
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBED_CHAR_LIMIT = 7000; // Conservative limit for embedding API

// Enhanced reliability configuration
const OPENAI_RATE_LIMIT_DELAY = 60000; // 1 minute delay for rate limit
const EXPONENTIAL_BACKOFF_BASE = 1000; // 1 second base delay
const MAX_EXPONENTIAL_DELAY = 30000; // 30 seconds max delay
const CIRCUIT_BREAKER_THRESHOLD = 5; // Fail fast after 5 consecutive failures
const FALLBACK_USAGE_THRESHOLD = 0.7; // Use fallback when 70% of requests fail

// Smart batching configuration - Much more conservative
const SMALL_POST_THRESHOLD = 500; // Characters
const LARGE_POST_THRESHOLD = 3000; // Characters
const COMPLEX_POST_INDICATORS = ['code', 'json', 'xml', 'html', 'css', 'javascript', 'python', 'sql'];
const SMALL_BATCH_SIZE = 15; // Reduced for short posts
const LARGE_BATCH_SIZE = 5; // Much smaller for long/complex posts

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
  private readonly maxConnections = 5; // Conservative limit for Edge Functions
  private readonly connectionTimeout = 5 * 60 * 1000; // 5 minutes
  
  async getConnection(): Promise<any> {
    // Find available connection
    let connection = this.pool.find(conn => !conn.inUse);
    
    if (connection) {
      // Check if connection is still valid (not too old)
      const age = Date.now() - connection.createdAt;
      if (age > this.connectionTimeout) {
        // Remove old connection
        this.pool = this.pool.filter(c => c !== connection);
        connection = null;
      } else {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        return connection.client;
      }
    }
    
    // Create new connection if pool not full
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
    
    // Pool is full, wait for available connection
    return new Promise((resolve) => {
      const checkForConnection = () => {
        const available = this.pool.find(conn => !conn.inUse);
        if (available) {
          available.inUse = true;
          available.lastUsed = Date.now();
          resolve(available.client);
        } else {
          setTimeout(checkForConnection, 100); // Check every 100ms
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
  
  // Clean up old connections periodically
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
  
  const supabase = await dbPool.getConnection();
  
  try {
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
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

async function createJob(job: EnrichJob): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
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
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

async function updateJobStatus(jobId: string, updates: Partial<EnrichJob>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
    const { error } = await supabase
      .from("enrich_jobs")
      .update(updates)
      .eq("id", jobId);
      
    if (error) {
      console.error(`Failed to update enrich job ${jobId}:`, error);
    }
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

// Fallback heuristics for when OpenAI is not available
// Removed fallback heuristics - AI-only approach for consistency

// Smart text chunking for better OpenAI processing
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
  let currentChunk = "";
  
  // Split by sentences to maintain semantic coherence
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const potentialChunk = currentChunk + (currentChunk ? ". " : "") + trimmedSentence;
    
    if (potentialChunk.length <= maxChars) {
      currentChunk = potentialChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + ".");
      }
      
      // Handle very long sentences
      if (trimmedSentence.length > maxChars) {
        const words = trimmedSentence.split(/\s+/);
        let wordChunk = "";
        
        for (const word of words) {
          const potentialWordChunk = wordChunk + (wordChunk ? " " : "") + word;
          if (potentialWordChunk.length <= maxChars) {
            wordChunk = potentialWordChunk;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk);
            }
            wordChunk = word.length <= maxChars ? word : word.substring(0, maxChars);
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        } else {
          currentChunk = "";
        }
      } else {
        currentChunk = trimmedSentence;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk + ".");
  }
  
  return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
}

function intelligentChunk(text: string, maxChars: number = 6000): string[] {
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const potentialChunk = currentChunk + (currentChunk ? ". " : "") + trimmedSentence;
    
    if (potentialChunk.length <= maxChars) {
      currentChunk = potentialChunk;
    } else {
      // Save current chunk if it has content
      if (currentChunk) {
        chunks.push(currentChunk + ".");
      }
      
      // Handle very long sentences by word-splitting
      if (trimmedSentence.length > maxChars) {
        const words = trimmedSentence.split(/\s+/);
        let wordChunk = "";
        
        for (const word of words) {
          const potentialWordChunk = wordChunk + (wordChunk ? " " : "") + word;
          if (potentialWordChunk.length <= maxChars) {
            wordChunk = potentialWordChunk;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk);
            }
            wordChunk = word.length <= maxChars ? word : word.substring(0, maxChars);
          }
        }
        
        if (wordChunk) {
          chunks.push(wordChunk);
        }
        currentChunk = "";
      } else {
        currentChunk = trimmedSentence;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk + ".");
  }
  
  return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
}

// Post complexity and priority scoring
function analyzePostComplexity(post: any): { complexity: 'simple' | 'medium' | 'complex', priority: number } {
  const text = `${post.title || ""}\n${post.body || ""}`.toLowerCase();
  const textLength = text.length;
  
  // Check for complexity indicators
  const hasCodeIndicators = COMPLEX_POST_INDICATORS.some(indicator => text.includes(indicator));
  const hasMultipleLanguages = /[^\x00-\x7F]/.test(text); // Non-ASCII characters
  const hasComplexFormatting = (text.match(/[{}[\]()]/g) || []).length > 5;
  const hasLongWords = text.split(/\s+/).some(word => word.length > 20);
  
  // Determine complexity
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
  priority += Math.max(0, 100 - daysSincePost * 10); // Decay over 10 days
  
  // Complaint indicators boost priority
  const complaintTerms = ['frustrated', 'annoying', 'broken', 'hate', 'terrible', 'awful', 'worst'];
  const complaintCount = complaintTerms.filter(term => text.includes(term)).length;
  priority += complaintCount * 20;
  
  // Popular posts (if we had engagement metrics) would get priority boost
  // For now, longer posts get slight priority as they may contain more insights
  if (textLength > 1000) priority += 10;
  
  return { complexity, priority };
}

// Smart batching based on complexity and priority
function createSmartBatches(posts: any[]): any[][] {
  // Analyze all posts first
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

async function embedText(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — skipping embeddings");
    return null;
  }
  
  // Use circuit breaker and fallback for embeddings too
  if (reliabilityState.circuitBreakerOpen || reliabilityState.fallbackMode) {
    console.warn("Skipping embedding due to reliability state");
    return null;
  }
  
  const cleaned = cleanForEmbedding(text);
  const chunks = chunkByChars(cleaned, EMBED_CHAR_LIMIT);
  const vectors: number[][] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    let lastError: any;
    
    // Track embedding requests in reliability state
    reliabilityState.totalRequests++;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const backoffDelay = Math.min(
          EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
          MAX_EXPONENTIAL_DELAY
        );
        
        if (attempt > 1) {
          console.log(`Embedding retry attempt ${attempt}/${MAX_RETRIES}, waiting ${backoffDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

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
        }, OPENAI_TIMEOUT_MS);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          lastError = new Error(`Embedding API ${response.status}: ${errorText.slice(0, 300)}`);
          
          if (response.status === 429) {
            reliabilityState.rateLimitHits++;
            reliabilityState.consecutiveFailures++;
            await new Promise(resolve => setTimeout(resolve, OPENAI_RATE_LIMIT_DELAY));
            continue;
          }
          
          if (response.status >= 500 && response.status < 600) {
            reliabilityState.consecutiveFailures++;
            continue;
          }
          
          reliabilityState.failedRequests++;
          throw lastError;
        }
        
        const data = await response.json();
        const vector = data?.data?.[0]?.embedding;
        
        if (!Array.isArray(vector)) {
          throw new Error("Invalid embedding response format");
        }
        
        vectors.push(vector);
        reliabilityState.consecutiveFailures = 0; // Reset on success
        break;
        
      } catch (error) {
        lastError = error as Error;
        reliabilityState.failedRequests++;
        reliabilityState.consecutiveFailures++;
        
        if (reliabilityState.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          reliabilityState.circuitBreakerOpen = true;
          console.error(`Circuit breaker opened during embedding for chunk ${i + 1}`);
        }
        
        if (attempt === MAX_RETRIES) {
          console.error(`All embedding attempts failed for chunk ${i + 1}:`, lastError);
          return null; // Return null instead of throwing to continue processing
        }
      }
    }
  }
  
  if (vectors.length === 0) {
    return null;
  }
  
  // Average multiple vectors if we had to chunk the text
  if (vectors.length === 1) {
    return vectors[0];
  }
  
  // Compute element-wise average
  const dimensions = vectors[0].length;
  const averaged = new Array(dimensions).fill(0);
  
  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      averaged[i] += vector[i];
    }
  }
  
  for (let i = 0; i < dimensions; i++) {
    averaged[i] /= vectors.length;
  }
  
  return averaged;
}

async function callOpenAIWithRetry(body: any): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  // Check circuit breaker
  if (reliabilityState.circuitBreakerOpen) {
    const timeSinceLastFailure = Date.now() - reliabilityState.lastFailureTime;
    if (timeSinceLastFailure < OPENAI_RATE_LIMIT_DELAY) {
      console.warn("Circuit breaker is open, using fallback");
      throw new Error("Circuit breaker open - OpenAI API temporarily unavailable");
    } else {
      // Reset circuit breaker after cool down
      reliabilityState.circuitBreakerOpen = false;
      reliabilityState.consecutiveFailures = 0;
      console.log("Circuit breaker reset after cooldown period");
    }
  }

  // Enable fallback mode if failure rate is too high
  if (reliabilityState.totalRequests > 10) {
    const failureRate = reliabilityState.failedRequests / reliabilityState.totalRequests;
    if (failureRate >= FALLBACK_USAGE_THRESHOLD && !reliabilityState.fallbackMode) {
      reliabilityState.fallbackMode = true;
      console.warn(`Enabling fallback mode due to high failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }
  }

  let lastError: Error;
  reliabilityState.totalRequests++;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Calculate exponential backoff delay
      const backoffDelay = Math.min(
        EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
        MAX_EXPONENTIAL_DELAY
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * backoffDelay;
      const delayWithJitter = backoffDelay + jitter;
      
      if (attempt > 1) {
        console.log(`OpenAI retry attempt ${attempt}/${MAX_RETRIES}, waiting ${Math.round(delayWithJitter)}ms`);
        await new Promise(resolve => setTimeout(resolve, delayWithJitter));
      }

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
        
        // Track rate limit hits
        if (response.status === 429) {
          reliabilityState.rateLimitHits++;
          reliabilityState.openaiFailures++;
          reliabilityState.consecutiveFailures++;
          reliabilityState.lastFailureTime = Date.now();
          console.warn(`OpenAI rate limit hit (${reliabilityState.rateLimitHits} total), waiting ${OPENAI_RATE_LIMIT_DELAY}ms`);
          
          // Longer wait for rate limits
          await new Promise(resolve => setTimeout(resolve, OPENAI_RATE_LIMIT_DELAY));
          continue;
        }
        
        // Track other failures
        if (response.status >= 500 && response.status < 600) {
          reliabilityState.openaiFailures++;
          reliabilityState.consecutiveFailures++;
          reliabilityState.lastFailureTime = Date.now();
          continue;
        }
        
        // Client errors (400-499) don't get retried
        reliabilityState.failedRequests++;
        throw lastError;
      }
      
      // Success - reset consecutive failures
      reliabilityState.consecutiveFailures = 0;
      reliabilityState.circuitBreakerOpen = false;
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      reliabilityState.failedRequests++;
      reliabilityState.consecutiveFailures++;
      reliabilityState.lastFailureTime = Date.now();
      
      // Open circuit breaker if too many consecutive failures
      if (reliabilityState.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        reliabilityState.circuitBreakerOpen = true;
        console.error(`Circuit breaker opened after ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures`);
      }
      
      if (attempt < MAX_RETRIES) {
        // Skip exponential backoff for last attempt to fail fast
        continue;
      }
    }
  }
  
  throw lastError!;
}

async function classifyText(text: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — using fallback heuristics");
    return null;
  }
  
  // Use fallback if circuit breaker is open or fallback mode is enabled
  if (reliabilityState.circuitBreakerOpen || reliabilityState.fallbackMode) {
    console.warn("Using fallback heuristics due to reliability state:", {
      circuitBreakerOpen: reliabilityState.circuitBreakerOpen,
      fallbackMode: reliabilityState.fallbackMode,
      consecutiveFailures: reliabilityState.consecutiveFailures,
      failureRate: reliabilityState.totalRequests > 0 ? 
        (reliabilityState.failedRequests / reliabilityState.totalRequests * 100).toFixed(1) + '%' : '0%'
    });
    return null;
  }
  
  // Clean and chunk text intelligently
  const cleanedText = cleanForEmbedding(text);
  const chunks = intelligentChunk(cleanedText, 7000); // Leave room for system prompt
  
  // For multiple chunks, classify each and combine results
  if (chunks.length > 1) {
    const results = [];
    for (const chunk of chunks.slice(0, 3)) { // Limit to 3 chunks for cost control
      try {
        const result = await classifySingleChunk(chunk);
        if (result) results.push(result);
      } catch (error) {
        console.warn("Chunk classification failed:", error);
        // If OpenAI fails, fall back to heuristics for this chunk
        if (error.message.includes("Circuit breaker") || error.message.includes("rate limit")) {
          const fallbackResult = null;
          if (fallbackResult) results.push(fallbackResult);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between chunks
    }
    
    if (results.length === 0) {
      return null;
    }
    
    // Combine results from multiple chunks
    return combineClassificationResults(results);
  } else {
    return classifySingleChunk(chunks[0]);
  }
}

async function classifySingleChunk(text: string): Promise<any> {
  if (!text || text.trim().length === 0) {
    console.warn("Empty text provided for classification");
    return null;
  }

  // If no OpenAI key, use fallback immediately
  if (!OPENAI_API_KEY) {
    console.log("No OpenAI API key, using fallback heuristics");
    return null;
  }

  const systemPrompt = `You are a JSON-only classifier for social media posts. Return strictly valid JSON with these keys:
- sentiment_label: "negative" | "neutral" | "positive"
- sentiment_score: number in [-1, 1] where -1 is very negative, 0 is neutral, 1 is very positive
- is_complaint: boolean (true if expressing frustration, problems, or complaints)
- keywords: array of 3-8 relevant lowercase keywords/phrases from the text`;
  
  try {
    console.log(`Making OpenAI API call for text: ${text.substring(0, 100)}...`);
    
    const response = await callOpenAIWithRetry({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ]
    });
    
    if (!response?.choices?.[0]?.message?.content) {
      console.error("Empty response from OpenAI API");
      return null;
    }
    
    const content = response.choices[0].message.content;
    console.log(`OpenAI response: ${content}`);
    
    const parsed = JSON.parse(content);
    
    // Validate the response structure
    if (typeof parsed.sentiment_score !== 'number' || 
        typeof parsed.is_complaint !== 'boolean' ||
        !Array.isArray(parsed.keywords)) {
      console.warn("Invalid OpenAI response structure, using fallback");
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error("Classification failed:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    // For circuit breaker or rate limit errors, re-throw to trigger fallback at higher level
    if (error.message.includes("Circuit breaker") || error.message.includes("rate limit")) {
      throw error;
    }
    
    // For other errors, use fallback heuristics
    return null;
  }
}

function combineClassificationResults(results: any[]): any {
  if (results.length === 1) return results[0];
  
  // Calculate average sentiment score
  const sentimentScores = results.map(r => r.sentiment_score).filter(s => typeof s === 'number');
  const avgSentiment = sentimentScores.length > 0 
    ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length 
    : 0;
  
  // Determine overall sentiment label
  const sentimentLabel = avgSentiment > 0.2 ? "positive" : avgSentiment < -0.2 ? "negative" : "neutral";
  
  // Combine complaints (any chunk being a complaint makes the whole post a complaint)
  const isComplaint = results.some(r => r.is_complaint);
  
  // Combine and deduplicate keywords
  const allKeywords = results.flatMap(r => r.keywords || []);
  const uniqueKeywords = Array.from(new Set(allKeywords)).slice(0, 8);
  
  return {
    sentiment_label: sentimentLabel,
    sentiment_score: Math.round(avgSentiment * 100) / 100, // Round to 2 decimal places
    is_complaint: isComplaint,
    keywords: uniqueKeywords
  };
}

// Call Railway enrichment service for high-performance processing
async function callRailwayEnrichment(posts: any[]): Promise<{ success: any[], failed: any[] }> {
  const startTime = Date.now();
  console.log(`Calling Railway enrichment service for ${posts.length} posts...`);
  
  try {
    const response = await fetch(`${RAILWAY_ENRICHMENT_ENDPOINT}/enrich-posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        posts: posts.map(post => ({
          id: post.id,
          title: post.title || "",
          body: post.body || "",
          platform: post.platform || "unknown"
        }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Railway enrichment failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`Railway enrichment completed in ${duration}ms: ${result.enriched?.length || 0} success, ${result.failed?.length || 0} failed`);
    
    return {
      success: result.enriched || [],
      failed: result.failed || []
    };

  } catch (error) {
    console.error("Railway enrichment service error:", error);
    throw error;
  }
}

async function processPostBatch(
  posts: any[], 
  supabase: any, 
  jobId: string,
  batchNumber: number,
  totalBatches: number,
  totalPostsProcessed: number,
  totalPostsCount: number
): Promise<{ success: number, failed: number, skipped: number }> {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  console.log(`Batch ${batchNumber}: Processing ${posts.length} posts via Railway enrichment service`);

  // Filter out already enriched posts
  const postsToEnrich = posts.filter(post => {
    const isFullyEnriched = post.sentiment !== null && post.keywords !== null && post.embedding !== null && post.enriched_at;
    if (isFullyEnriched) {
      console.log(`Skipping already enriched post ${post.id}`);
      skipped++;
      return false;
    }
    return true;
  });

  if (postsToEnrich.length === 0) {
    console.log(`Batch ${batchNumber}: All posts already enriched`);
    return { success, failed, skipped };
  }

  try {
    // Call Railway enrichment service
    const enrichmentResult = await callRailwayEnrichment(postsToEnrich);
    
    // Update database with enrichment results
    for (const enrichedPost of enrichmentResult.success) {
      try {
        const updateData = {
          sentiment: enrichedPost.sentiment,
          is_complaint: enrichedPost.is_complaint,
          keywords: enrichedPost.keywords,
          embedding: enrichedPost.embedding,
          enriched_at: new Date().toISOString(),
          enrich_status: "completed"
        };

        const { error } = await supabase
          .from("posts")
          .update(updateData)
          .eq("id", enrichedPost.id);

        if (error) {
          console.error(`Failed to update post ${enrichedPost.id}:`, error);
          failed++;
        } else {
          console.log(`Successfully updated post ${enrichedPost.id}`);
          success++;
        }
      } catch (updateError) {
        console.error(`Exception updating post ${enrichedPost.id}:`, updateError);
        failed++;
      }
    }

    // Handle failed enrichments
    for (const failedPost of enrichmentResult.failed) {
      try {
        await supabase
          .from("posts")
          .update({ 
            enrich_status: "failed",
            enriched_at: new Date().toISOString()
          })
          .eq("id", failedPost.id);
        failed++;
      } catch (statusError) {
        console.warn(`Could not update failed status for post ${failedPost.id}:`, statusError);
        failed++;
      }
    }

  } catch (enrichmentError) {
    console.error(`Railway enrichment service failed for batch ${batchNumber}:`, enrichmentError);
    
    // Mark all posts as failed
    for (const post of postsToEnrich) {
      try {
        await supabase
          .from("posts")
          .update({ 
            enrich_status: "failed",
            enriched_at: new Date().toISOString()
          })
          .eq("id", post.id);
        failed++;
      } catch (statusError) {
        console.warn(`Could not update failed status for post ${post.id}:`, statusError);
        failed++;
      }
    }
  }

  console.log(`Batch ${batchNumber} completed: ${success} success, ${failed} failed, ${skipped} skipped`);
  return { success, failed, skipped };
}

async function executeEnrichmentJob(jobId: string, parameters: any): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  let supabase: any = null;
  
  try {
    supabase = await dbPool.getConnection();
    
    // Clean up old connections periodically
    dbPool.cleanup();
    
    await updateJobStatus(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: {
        current_step: 'Starting Railway enrichment orchestration',
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
    console.log(`Job ${jobId}: Starting Railway enrichment orchestration...`);

    // Count posts needing enrichment
    let totalPostsCount = 0;
    try {
      const { count, error } = await supabase
        .from("posts")
        .select("*", { count: 'exact', head: true })
        .or("enriched_at.is.null,sentiment.is.null,embedding.is.null");
      
      if (error) {
        console.warn(`Count query failed: ${error.message}`);
        // Fallback count
        const allPostsResult = await supabase
          .from("posts")
          .select("*", { count: 'exact', head: true });
        totalPostsCount = allPostsResult.count || 0;
      } else {
        totalPostsCount = count || 0;
      }
    } catch (countError) {
      console.error("Error counting posts:", countError);
      totalPostsCount = 0;
    }

    console.log(`Job ${jobId}: Found ${totalPostsCount} posts to enrich`);

    if (totalPostsCount === 0) {
      const result = {
        status: "success",
        message: "No posts need enrichment",
        architecture: "railway_enrichment_orchestrator",
        duration_ms: Date.now() - startTime,
        stats: {
          total_processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0
        }
      };

      await updateJobStatus(jobId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        result
      });

      console.log(`Job ${jobId}: No posts to enrich`);
      return;
    }

    // Process posts using Railway service with larger batches
    const RAILWAY_BATCH_SIZE = 50; // Railway can handle larger batches
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let batchCount = 0;
    
    while (totalProcessed < totalPostsCount) {
      const remainingPosts = totalPostsCount - totalProcessed;
      const batchSize = Math.min(RAILWAY_BATCH_SIZE, remainingPosts);
      
      // Fetch posts needing enrichment
      let posts: any[] = [];
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("id, title, body, sentiment, keywords, enriched_at, embedding")
          .or("enriched_at.is.null,sentiment.is.null,embedding.is.null")
          .order("created_at", { ascending: false })
          .limit(batchSize);
        
        if (error) {
          console.error("Error fetching posts:", error);
          break;
        }
        
        posts = data || [];
      } catch (fetchError) {
        console.error("Exception fetching posts:", fetchError);
        break;
      }

      if (posts.length === 0) {
        console.log(`Job ${jobId}: No more posts to process`);
        break;
      }

      batchCount++;
      console.log(`Job ${jobId}: Processing batch ${batchCount} with ${posts.length} posts`);
      
      const batchResult = await processPostBatch(
        posts, 
        supabase, 
        jobId, 
        batchCount, 
        Math.ceil(totalPostsCount / RAILWAY_BATCH_SIZE),
        totalProcessed,
        totalPostsCount
      );
      
      totalProcessed += posts.length;
      totalSuccess += batchResult.success;
      totalFailed += batchResult.failed;
      totalSkipped += batchResult.skipped;
      
      // Update progress
      await updateJobStatus(jobId, {
        progress: {
          current_step: `Completed batch ${batchCount}`,
          total_steps: 4,
          completed_steps: 2,
          posts_processed: totalProcessed,
          posts_total: totalPostsCount,
          current_batch: batchCount,
          total_batches: Math.ceil(totalPostsCount / RAILWAY_BATCH_SIZE),
          posts_success: totalSuccess,
          posts_failed: totalFailed
        }
      });

      // Short delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      status: "success",
      architecture: "railway_enrichment_orchestrator",
      duration_ms: duration,
      duration_minutes: Math.round(duration / 60000 * 10) / 10,
      stats: {
        total_processed: totalProcessed,
        successful: totalSuccess,
        failed: totalFailed,
        skipped: totalSkipped,
        batches: batchCount,
        posts_per_minute: Math.round((totalProcessed / (duration / 60000)) * 10) / 10,
        success_rate: totalProcessed > 0 ? Math.round((totalSuccess / totalProcessed) * 100 * 10) / 10 : 0
      },
      message: `✅ Railway enrichment completed: ${totalSuccess} posts enriched successfully`,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        orchestrator: true,
        enrichment_service: "Railway"
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
        posts_total: totalPostsCount,
        current_batch: batchCount,
        total_batches: batchCount,
        posts_success: totalSuccess,
        posts_failed: totalFailed
      },
      result
    });

    console.log(`Job ${jobId}: Railway enrichment orchestration completed:`, result);

  } catch (error) {
    console.error(`Job ${jobId}: Railway enrichment orchestration error:`, error);
    
    await updateJobStatus(jobId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: String(error)
    });
  } finally {
    if (supabase) {
      dbPool.releaseConnection(supabase);
    }
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
      batch_size: parseInt(url.searchParams.get("batch_size") || "50"), // Use Railway batch size
      concurrent_requests: parseInt(url.searchParams.get("concurrent_requests") || "20"), // Railway concurrency
      priority: url.searchParams.get("priority") || "recent_first",
      platform: url.searchParams.get("platform") || "all"
    };

    const job: EnrichJob = {
      id: jobId,
      status: 'pending',
      created_at: nowISO,
      parameters: jobParameters
    };
    
    await createJob(job);
    
    console.log(`Created Railway enrichment job ${jobId} with parameters:`, jobParameters);

    // Start enrichment in background
    executeEnrichmentJob(jobId, jobParameters).catch(error => {
      console.error(`Background Railway enrichment job ${jobId} failed:`, error);
    });

    // Return immediately with job ID
    return new Response(JSON.stringify({
      status: "triggered",
      message: "Railway enrichment job has been triggered successfully",
      architecture: "railway_enrichment_orchestrator",
      job_id: jobId,
      created_at: nowISO,
      parameters: jobParameters,
      status_url: `${url.origin}/functions/v1/job-status?job_id=${jobId}`,
      enrichment_service: "Railway",
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
    console.error("Railway enrichment orchestrator trigger error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: "Failed to trigger Railway enrichment job",
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
