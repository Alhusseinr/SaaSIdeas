// Enrichment orchestrator - coordinates background enrichment with job tracking
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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
    return fallbackHeuristics(text);
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
    return fallbackHeuristics(text);
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
          const fallbackResult = fallbackHeuristics(chunk);
          if (fallbackResult) results.push(fallbackResult);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between chunks
    }
    
    if (results.length === 0) {
      return fallbackHeuristics(text);
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
    return fallbackHeuristics(text);
  }

  // If no OpenAI key, use fallback immediately
  if (!OPENAI_API_KEY) {
    console.log("No OpenAI API key, using fallback heuristics");
    return fallbackHeuristics(text);
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
      return fallbackHeuristics(text);
    }
    
    const content = response.choices[0].message.content;
    console.log(`OpenAI response: ${content}`);
    
    const parsed = JSON.parse(content);
    
    // Validate the response structure
    if (typeof parsed.sentiment_score !== 'number' || 
        typeof parsed.is_complaint !== 'boolean' ||
        !Array.isArray(parsed.keywords)) {
      console.warn("Invalid OpenAI response structure, using fallback");
      return fallbackHeuristics(text);
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
    return fallbackHeuristics(text);
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
  
  // Determine optimal concurrency based on batch complexity
  const avgComplexity = posts.reduce((sum, post) => {
    const complexity = post.analysis?.complexity || 'medium';
    return sum + (complexity === 'complex' ? 3 : complexity === 'medium' ? 2 : 1);
  }, 0) / posts.length;
  
  const optimalConcurrency = Math.min(
    avgComplexity > 2.5 ? 4 : avgComplexity > 1.5 ? 6 : 8,
    CONCURRENT_REQUESTS
  );
  
  console.log(`Batch ${batchNumber}: Processing ${posts.length} posts with ${optimalConcurrency} workers (avg complexity: ${avgComplexity.toFixed(1)})`);
  
  // Create semaphore for concurrency control
  const semaphore = new Array(optimalConcurrency).fill(null);
  let postIndex = 0;
  
  const processPost = async (post: any) => {
    let localDbConnection: any = null;
    
    try {
      // Get dedicated connection for this post to prevent blocking
      localDbConnection = await dbPool.getConnection();
      console.log(`Processing post ${post.id}...`);
      
      // Mark post as processing (optimistic update)
      try {
        await localDbConnection
          .from("posts")
          .update({ enrich_status: "processing" })
          .eq("id", post.id);
      } catch (statusError) {
        console.warn(`Could not update status to processing for post ${post.id}:`, statusError);
        // Continue processing even if status update fails
      }
      
      const text = `${post.title || ""}\n${post.body || ""}`.trim();
      
      // Skip if already enriched (optimization)
      if (post.sentiment !== null && post.keywords !== null && post.embedding !== null && post.enriched_at) {
        console.log(`Skipping already enriched post ${post.id} (sentiment: ${post.sentiment}, keywords: ${post.keywords?.length || 0}, embedding: ${post.embedding ? 'present' : 'missing'}, enriched: ${post.enriched_at})`);
        skipped++;
        return;
      }
      
      // Partial success: Try classification and embedding but continue even if they fail
      let classification = null;
      let embedding = null;
      let classificationFailed = false;
      let embeddingFailed = false;
      
      // Run classification and embedding in parallel if needed
      const needsClassification = post.sentiment === null || post.keywords === null;
      const needsEmbedding = post.embedding === null;
      
      console.log(`Post ${post.id} enrichment status: sentiment=${post.sentiment !== null ? 'present' : 'MISSING'}, keywords=${post.keywords !== null ? 'present' : 'MISSING'}, embedding=${post.embedding !== null ? 'present' : 'MISSING'}, enriched_at=${post.enriched_at ? 'present' : 'MISSING'}`);
      console.log(`Post ${post.id} needs: classification=${needsClassification}, embedding=${needsEmbedding}`);
      
      if (needsClassification || needsEmbedding) {
        const tasks: Promise<any>[] = [];
        
        if (needsClassification) {
          tasks.push(
            classifyText(text).catch(error => {
              console.warn(`Classification failed for post ${post.id}:`, error.message);
              classificationFailed = true;
              return null;
            })
          );
        } else {
          tasks.push(Promise.resolve(null));
        }
        
        if (needsEmbedding) {
          tasks.push(
            embedText(text).catch(error => {
              console.warn(`Embedding failed for post ${post.id}:`, error.message);
              embeddingFailed = true;
              return null;
            })
          );
        } else {
          tasks.push(Promise.resolve(null));
        }
        
        console.log(`Processing post ${post.id} (${text.length} chars) - needs: ${needsClassification ? 'classification' : ''} ${needsEmbedding ? 'embedding' : ''}`);
        
        const [classificationResult, embeddingResult] = await Promise.all(tasks);
        
        if (needsClassification) {
          classification = classificationResult;
        }
        
        if (needsEmbedding) {
          embedding = embeddingResult;
        }
        
        console.log(`Results for post ${post.id}: classification=${classification ? 'success' : 'failed'}, embedding=${embedding ? 'success' : 'failed'}`);
      }
      
      const updateData: any = {
        enriched_at: new Date().toISOString(),
        enrich_status: (classificationFailed && embeddingFailed) ? "completed" : "completed" // Mark as completed even with partial success
      };
      
      // Apply classification results if available
      if (classification && !classificationFailed) {
        updateData.sentiment = typeof classification?.sentiment_score === "number" ? classification.sentiment_score : null;
        updateData.is_complaint = Boolean(classification?.is_complaint);
        updateData.keywords = Array.isArray(classification?.keywords) ? classification.keywords : [];
      } else if (classificationFailed) {
        // Partial success: at least mark that we attempted enrichment
        console.log(`Storing partial classification data for post ${post.id}`);
        if (needsClassification) {
          updateData.sentiment = null; // Explicitly mark as attempted but failed
          updateData.is_complaint = false; // Safe default
          updateData.keywords = []; // Empty array
        }
      }
      
      // Apply embedding results if available
      if (embedding && !embeddingFailed) {
        updateData.embedding = embedding;
      } else if (embeddingFailed) {
        console.log(`Storing partial embedding data for post ${post.id}`);
        if (needsEmbedding) {
          updateData.embedding = null; // Explicitly mark as attempted but failed
        }
      }
      
      // Store complexity analysis for analytics and future optimizations
      if (post.analysis) {
        updateData.complexity_score = post.analysis.complexity;
        updateData.priority_score = Math.round(post.analysis.priority * 10) / 10; // Round to 1 decimal
      }
      
      console.log(`Updating post ${post.id} with data:`, updateData);
      
      // Partial success: Try database update with fallback strategy
      let updateSucceeded = false;
      
      try {
        const { error } = await localDbConnection
          .from("posts")
          .update(updateData)
          .eq("id", post.id);
          
        if (error) {
          // Fallback strategy: try with just basic fields
          if (error.message.includes("column") || error.message.includes("does not exist")) {
            console.warn(`Column error for post ${post.id}, trying basic update:`, error.message);
            
            const basicUpdateData = {
              enriched_at: updateData.enriched_at,
              sentiment: updateData.sentiment,
              is_complaint: updateData.is_complaint,
              keywords: updateData.keywords,
              enrich_status: "completed"
            };
            
            const { error: basicError } = await localDbConnection
              .from("posts")
              .update(basicUpdateData)
              .eq("id", post.id);
              
            if (basicError) {
              console.error(`Basic update also failed for post ${post.id}:`, basicError);
              updateSucceeded = false;
            } else {
              console.log(`Basic update succeeded for post ${post.id}`);
              updateSucceeded = true;
            }
          } else {
            console.error(`Database error for post ${post.id}:`, error);
            updateSucceeded = false;
          }
        } else {
          console.log(`Full update succeeded for post ${post.id}`);
          updateSucceeded = true;
        }
      } catch (dbError) {
        console.error(`Database exception for post ${post.id}:`, dbError);
        updateSucceeded = false;
      }
      
      // Count partial success as success if we at least marked it as processed
      if (updateSucceeded) {
        success++;
        console.log(`Successfully processed post ${post.id} (classification: ${!classificationFailed ? 'success' : 'partial'})`);
      } else {
        failed++;
        console.log(`Failed to process post ${post.id}`);
      }
      
    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error);
      console.error(`Error details:`, {
        message: error.message,
        stack: error.stack,
        post: { id: post.id, title: post.title?.substring(0, 100) }
      });
      
      // Partial success: At least try to mark the post as failed
      try {
        if (localDbConnection) {
          await localDbConnection
            .from("posts")
            .update({ 
              enrich_status: "failed",
              enriched_at: new Date().toISOString()
            })
            .eq("id", post.id);
        }
      } catch (statusError) {
        console.warn(`Could not update status to failed for post ${post.id}:`, statusError);
        // Continue - don't let status update failures block the process
      }
      
      failed++;
    } finally {
      // Always release the connection
      if (localDbConnection) {
        dbPool.releaseConnection(localDbConnection);
      }
    }
  };
  
  // Process with enhanced concurrency control
  const workers = semaphore.map(async (_, workerIndex) => {
    while (postIndex < posts.length) {
      const currentIndex = postIndex++;
      if (currentIndex < posts.length) {
        await processPost(posts[currentIndex]);
        
        // Update progress every 2 posts for better monitoring
        if ((success + failed + skipped) % 2 === 0 || currentIndex === posts.length - 1) {
          await updateJobStatus(jobId, {
            progress: {
              current_step: `Processing batch ${batchNumber}/${totalBatches} (worker ${workerIndex + 1})`,
              total_steps: 4,
              completed_steps: 2,
              posts_processed: totalPostsProcessed + success + failed + skipped,
              posts_total: totalPostsCount,
              current_batch: batchNumber,
              total_batches: totalBatches,
              posts_success: totalPostsProcessed + success,
              posts_failed: failed
            }
          });
        }
      }
    }
  });
  
  await Promise.all(workers);
  
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

    // Count total posts to process with priority query
    // First, let's check what posts exist and their current enrichment status
    console.log(`Job ${jobId}: Diagnosing current post state...`);
    
    // Get total posts count for comparison
    const { count: allPostsCount, error: allPostsError } = await supabase
      .from("posts")
      .select("*", { count: 'exact', head: true });
    
    if (allPostsError) {
      console.warn(`Could not count all posts: ${allPostsError.message}`);
    } else {
      console.log(`Total posts in database: ${allPostsCount || 0}`);
    }
    
    // Check enrichment status distribution
    const { data: enrichmentStats, error: statsError } = await supabase
      .from("posts")
      .select("sentiment, keywords, enriched_at, enrich_status, embedding");
    
    if (statsError) {
      console.warn(`Enrichment stats query failed: ${statsError.message}`);
    } else {
      const totalPosts = enrichmentStats?.length || 0;
      const alreadyEnriched = enrichmentStats?.filter(p => 
        p.enriched_at && p.sentiment !== null && p.keywords !== null && p.embedding !== null
      ).length || 0;
      const partiallyEnriched = enrichmentStats?.filter(p => 
        p.enriched_at && (p.sentiment === null || p.keywords === null || p.embedding === null)
      ).length || 0;
      const notEnriched = totalPosts - alreadyEnriched - partiallyEnriched;
      
      // Debug: Count specific issues
      const missingEmbedding = enrichmentStats?.filter(p => p.embedding === null).length || 0;
      const missingSentiment = enrichmentStats?.filter(p => p.sentiment === null).length || 0;
      const missingKeywords = enrichmentStats?.filter(p => p.keywords === null).length || 0;
      const missingEnrichedAt = enrichmentStats?.filter(p => p.enriched_at === null).length || 0;
      
      console.log(`🔍 DETAILED BREAKDOWN:`);
      console.log(`  - Posts missing embedding: ${missingEmbedding}`);
      console.log(`  - Posts missing sentiment: ${missingSentiment}`);
      console.log(`  - Posts missing keywords: ${missingKeywords}`);
      console.log(`  - Posts missing enriched_at: ${missingEnrichedAt}`);
      
      // Show sample posts missing embeddings
      if (missingEmbedding > 0) {
        const sampleMissingEmbedding = enrichmentStats?.filter(p => p.embedding === null).slice(0, 3);
        console.log(`📝 Sample posts missing embeddings:`);
        sampleMissingEmbedding?.forEach(post => {
          console.log(`  Post: sentiment=${post.sentiment !== null ? 'present' : 'NULL'}, keywords=${post.keywords !== null ? 'present' : 'NULL'}, embedding=NULL, enriched_at=${post.enriched_at ? 'present' : 'NULL'}, enrich_status=${post.enrich_status || 'NULL'}`);
        });
      }
      
      console.log(`Enrichment status breakdown:`);
      console.log(`  - Total posts: ${totalPosts}`);
      console.log(`  - Fully enriched: ${alreadyEnriched} (${totalPosts > 0 ? ((alreadyEnriched / totalPosts) * 100).toFixed(1) : 0}%)`);
      console.log(`  - Partially enriched: ${partiallyEnriched} (${totalPosts > 0 ? ((partiallyEnriched / totalPosts) * 100).toFixed(1) : 0}%)`);
      console.log(`  - Not enriched: ${notEnriched} (${totalPosts > 0 ? ((notEnriched / totalPosts) * 100).toFixed(1) : 0}%)`);
      
      if (alreadyEnriched === totalPosts && totalPosts > 0) {
        console.log(`🎉 ALL POSTS ARE ALREADY FULLY ENRICHED! No work needed.`);
      } else if (notEnriched === 0 && totalPosts > 0) {
        console.log(`ℹ️  All posts have been processed (some partially enriched). Consider re-processing partial ones.`);
      }
    }
    
    const { data: diagPosts, error: diagError } = await supabase
      .from("posts")
      .select("id, sentiment, keywords, enriched_at, enrich_status, embedding")
      .limit(5);
    
    if (diagError) {
      console.warn(`Diagnostic query failed: ${diagError.message}`);
    } else {
      console.log(`Sample posts:`, diagPosts);
    }
    
    // Try multiple query approaches to find posts to enrich
    let totalPostsCount = 0;
    let countError: any = null;
    
    // Try the specific enrich_status query first
    const statusResult = await supabase
      .from("posts")
      .select("*", { count: 'exact', head: true })
      .or("enrich_status.is.null,enrich_status.eq.pending,enrich_status.eq.failed");
    
    console.log(`Enrich status query result: count=${statusResult.count}, error=${statusResult.error?.message || 'none'}`);
    
    // ALWAYS check for missing embeddings specifically, regardless of enrich_status
    const missingEmbeddingResult = await supabase
      .from("posts")
      .select("*", { count: 'exact', head: true })
      .is("embedding", null);
    
    console.log(`Missing embedding query result: count=${missingEmbeddingResult.count}, error=${missingEmbeddingResult.error?.message || 'none'}`);
    
    if (statusResult.error) {
      console.warn(`Enrich status query failed: ${statusResult.error.message}`);
      
      // Fallback: try querying posts without enriched_at or with null sentiment/embedding
      const fallbackResult = await supabase
        .from("posts")
        .select("*", { count: 'exact', head: true })
        .or("enriched_at.is.null,sentiment.is.null,embedding.is.null");
      
      console.log(`Fallback query result: count=${fallbackResult.count}, error=${fallbackResult.error?.message || 'none'}`);
      
      if (fallbackResult.error) {
        console.warn(`Fallback query also failed: ${fallbackResult.error.message}`);
        
        // Try a more explicit query to find incomplete enrichments
        const explicitResult = await supabase
          .from("posts")
          .select("*", { count: 'exact', head: true })
          .not("sentiment", "is", null)
          .not("keywords", "is", null)
          .not("embedding", "is", null)
          .not("enriched_at", "is", null);
        
        if (explicitResult.error) {
          console.warn(`Explicit complete enrichment query failed: ${explicitResult.error.message}`);
          
          // Last resort: count all posts and assume they need enrichment
          const allPostsResult = await supabase
            .from("posts")
            .select("*", { count: 'exact', head: true });
          
          totalPostsCount = allPostsResult.count || 0;
          countError = allPostsResult.error;
          console.log(`Using all posts count (assume all need enrichment): ${totalPostsCount}`);
        } else {
          // Subtract complete posts from total to get posts that need enrichment
          const allPostsResult = await supabase
            .from("posts")
            .select("*", { count: 'exact', head: true });
          
          const totalPosts = allPostsResult.count || 0;
          const completePosts = explicitResult.count || 0;
          totalPostsCount = Math.max(0, totalPosts - completePosts);
          console.log(`Using explicit calculation: ${totalPosts} total - ${completePosts} complete = ${totalPostsCount} need enrichment`);
        }
      } else {
        totalPostsCount = fallbackResult.count || 0;
        console.log(`Using fallback query count: ${totalPostsCount}`);
      }
    } else {
      totalPostsCount = statusResult.count || 0;
      console.log(`Using enrich_status query count: ${totalPostsCount}`);
      
      // If we found more posts missing embeddings than the status query found, use that count instead
      const missingEmbeddingCount = missingEmbeddingResult.count || 0;
      if (missingEmbeddingCount > totalPostsCount) {
        console.log(`⚠️  Missing embedding count (${missingEmbeddingCount}) is higher than status query count (${totalPostsCount})`);
        console.log(`This suggests posts have enrich_status='completed' but missing embeddings`);
        totalPostsCount = missingEmbeddingCount;
        console.log(`Updated count to ${totalPostsCount} to include missing embeddings`);
      }
    }
    
    if (countError) {
      throw new Error(`Failed to count posts: ${countError.message}`);
    }

    const totalPosts = totalPostsCount || 0;
    console.log(`Job ${jobId}: Found ${totalPosts} posts to enrich`);

    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Analyzing posts and creating smart batches',
        total_steps: 4,
        completed_steps: 1,
        posts_processed: 0,
        posts_total: totalPosts,
        current_batch: 0,
        total_batches: 0,
        posts_success: 0,
        posts_failed: 0
      }
    });

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let batchCount = 0;
    
    // Process posts using smart batching and priority queue with time management
    while (Date.now() - startTime < MAX_PROCESSING_TIME) {
      const timeRemaining = MAX_PROCESSING_TIME - (Date.now() - startTime);
      const timeWithBuffer = timeRemaining - SAFETY_BUFFER_MS;
      
      // Stop processing if we're getting close to timeout
      if (timeWithBuffer <= 0) {
        console.log(`Job ${jobId}: Approaching timeout limit, stopping processing gracefully`);
        break;
      }
      
      console.log(`Job ${jobId}: Time remaining: ${Math.round(timeRemaining / 60000)}min, with buffer: ${Math.round(timeWithBuffer / 60000)}min`);
      // Check hard limits
      if (totalProcessed >= MAX_POSTS_PER_RUN) {
        console.log(`Job ${jobId}: Reached hard limit of ${MAX_POSTS_PER_RUN} posts per run, stopping`);
        break;
      }
      
      // Fetch smaller batch for analysis and smart batching
      const remainingInLimit = MAX_POSTS_PER_RUN - totalProcessed;
      const fetchSize = Math.min(50, totalPosts - totalProcessed, remainingInLimit);
      if (fetchSize <= 0) break;

      // Try to fetch posts with the same fallback logic as counting
      let posts: any[] = [];
      let error: any = null;
      
      // Try enrich_status query first
      const statusQuery = await supabase
        .from("posts")
        .select("id, title, body, sentiment, keywords, enriched_at, created_at, enrich_status, embedding")
        .or("enrich_status.is.null,enrich_status.eq.pending,enrich_status.eq.failed")
        .order("created_at", { ascending: false })
        .limit(fetchSize);
      
      if (statusQuery.error) {
        console.warn(`Enrich status fetch failed: ${statusQuery.error.message}`);
        
        // Try specifically fetching posts with missing embeddings first
        const missingEmbeddingQuery = await supabase
          .from("posts")
          .select("id, title, body, sentiment, keywords, enriched_at, created_at, embedding")
          .is("embedding", null)
          .order("created_at", { ascending: false })
          .limit(fetchSize);
        
        if (missingEmbeddingQuery.error) {
          console.warn(`Missing embedding fetch failed: ${missingEmbeddingQuery.error.message}`);
          
          // Fallback: fetch posts without enriched_at or with null sentiment/embedding
          let fallbackQuery = supabase
            .from("posts")
            .select("id, title, body, sentiment, keywords, enriched_at, created_at, embedding")
            .or("enriched_at.is.null,sentiment.is.null,embedding.is.null");

          // Add platform filter if specified
          if (parameters?.platform && parameters.platform !== "all") {
            fallbackQuery = fallbackQuery.eq("platform", parameters.platform);
          }

          const fallbackQueryResult = await fallbackQuery
            .order("created_at", { ascending: false })
            .limit(fetchSize);
        
          if (fallbackQueryResult.error) {
            console.warn(`Fallback fetch also failed: ${fallbackQueryResult.error.message}`);
            
            // Try explicit incomplete posts query
            let incompleteQuery = supabase
              .from("posts")
              .select("id, title, body, sentiment, keywords, enriched_at, created_at, embedding")
              .or("sentiment.is.null,keywords.is.null,embedding.is.null,enriched_at.is.null");

            // Add platform filter if specified
            if (parameters?.platform && parameters.platform !== "all") {
              incompleteQuery = incompleteQuery.eq("platform", parameters.platform);
            }

            const incompleteQueryResult = await incompleteQuery
              .order("created_at", { ascending: false })
              .limit(fetchSize);
          
          if (incompleteQueryResult.error) {
            console.warn(`Incomplete posts query failed: ${incompleteQueryResult.error.message}`);
            
            // Last resort: fetch all posts and filter in code
            const allPostsQuery = await supabase
              .from("posts")
              .select("id, title, body, sentiment, keywords, enriched_at, created_at, embedding")
              .order("created_at", { ascending: false })
              .limit(fetchSize);
            
            posts = allPostsQuery.data || [];
            error = allPostsQuery.error;
            console.log(`Using all posts fetch: ${posts.length} posts`);
          } else {
            posts = incompleteQueryResult.data || [];
            console.log(`Using incomplete posts fetch: ${posts.length} posts`);
          }
          } else {
            posts = fallbackQueryResult.data || [];
            console.log(`Using fallback fetch: ${posts.length} posts`);
          }
        } else {
          posts = missingEmbeddingQuery.data || [];
          console.log(`Using missing embedding fetch: ${posts.length} posts`);
        }
      } else {
        posts = statusQuery.data || [];
        console.log(`Using enrich_status fetch: ${posts.length} posts`);
        
        // If the status query didn't find any posts but we know there are missing embeddings, try the missing embedding query
        if (posts.length === 0 && (missingEmbeddingResult.count || 0) > 0) {
          console.log(`Status query found 0 posts but ${missingEmbeddingResult.count} posts missing embeddings. Trying missing embedding query...`);
          
          const missingEmbeddingFetch = await supabase
            .from("posts")
            .select("id, title, body, sentiment, keywords, enriched_at, created_at, embedding")
            .is("embedding", null)
            .order("created_at", { ascending: false })
            .limit(fetchSize);
          
          if (!missingEmbeddingFetch.error && missingEmbeddingFetch.data) {
            posts = missingEmbeddingFetch.data;
            console.log(`Found ${posts.length} posts with missing embeddings despite status query finding 0`);
          }
        }
      }
      
      if (error) {
        console.error("Error fetching posts:", error);
        break;
      }
      
      // Filter posts at code level to ensure we catch partial enrichment
      const postsNeedingEnrichment = posts?.filter(post => {
        const needsEnrichment = (
          post.sentiment === null || 
          post.keywords === null || 
          post.embedding === null || 
          post.enriched_at === null
        );
        
        if (!needsEnrichment) {
          console.log(`Code-level filter: Skipping fully enriched post ${post.id}`);
        }
        
        return needsEnrichment;
      }) || [];
      
      console.log(`Code-level filter: ${posts?.length || 0} fetched → ${postsNeedingEnrichment.length} need enrichment`);
      
      if (!postsNeedingEnrichment || postsNeedingEnrichment.length === 0) {
        console.log(`No more posts to enrich found in this batch (${posts?.length || 0} fetched, ${postsNeedingEnrichment.length} need enrichment)`);
        if (totalProcessed === 0) {
          console.log(`⚠️  NO POSTS FOUND TO PROCESS AFTER ${totalPosts} were counted. This suggests:`);
          console.log(`   - All ${totalPosts} posts may already be fully enriched`);
          console.log(`   - Database query logic may need adjustment`);
          console.log(`   - Post counting and fetching queries are inconsistent`);
          
          // Debug: Show a sample of what we fetched
          if (posts && posts.length > 0) {
            console.log(`Sample of fetched posts (first 3):`);
            posts.slice(0, 3).forEach(post => {
              console.log(`  Post ${post.id}: sentiment=${post.sentiment !== null ? 'present' : 'NULL'}, keywords=${post.keywords !== null ? 'present' : 'NULL'}, embedding=${post.embedding !== null ? 'present' : 'NULL'}, enriched_at=${post.enriched_at ? 'present' : 'NULL'}`);
            });
          }
        }
        break;
      }
      
      // Use the filtered posts
      posts = postsNeedingEnrichment;
      
      console.log(`Job ${jobId}: Analyzing ${posts.length} posts for smart batching...`);
      
      // Create smart batches based on complexity and priority
      const smartBatches = createSmartBatches(posts);
      const totalBatches = Math.max(batchCount + smartBatches.length, 1);
      
      console.log(`Job ${jobId}: Created ${smartBatches.length} smart batches (${smartBatches.map(b => b.length).join(', ')} posts each)`);
      
      // Process each smart batch
      for (const batch of smartBatches) {
        const timeRemaining = MAX_PROCESSING_TIME - (Date.now() - startTime);
        const timeWithBuffer = timeRemaining - SAFETY_BUFFER_MS;
        
        if (timeWithBuffer <= 0) {
          console.log(`Job ${jobId}: Reached safe time limit, stopping batch processing`);
          break;
        }
        
        // Estimate time needed for this batch
        const avgTimePerPost = totalProcessed > 0 ? (Date.now() - startTime) / totalProcessed : 10000; // 10s default
        const estimatedBatchTime = batch.length * avgTimePerPost;
        
        if (estimatedBatchTime > timeWithBuffer) {
          console.log(`Job ${jobId}: Estimated batch time (${Math.round(estimatedBatchTime/1000)}s) exceeds remaining time, stopping`);
          break;
        }
        
        batchCount++;
        
        // Determine delay based on batch complexity
        const avgComplexity = batch.reduce((sum, post) => {
          const complexity = post.analysis?.complexity || 'medium';
          return sum + (complexity === 'complex' ? 3 : complexity === 'medium' ? 2 : 1);
        }, 0) / batch.length;
        
        const dynamicDelay = avgComplexity > 2.5 ? INTER_BATCH_DELAY * 2 : 
                            avgComplexity > 1.5 ? INTER_BATCH_DELAY : 
                            INTER_BATCH_DELAY / 2;
        
        console.log(`Job ${jobId}: Processing smart batch ${batchCount} (${batch.length} posts, avg complexity: ${avgComplexity.toFixed(1)})`);
        
        const batchResult = await processPostBatch(
          batch, 
          supabase, 
          jobId, 
          batchCount, 
          totalBatches,
          totalProcessed,
          totalPosts
        );
        
        totalProcessed += batch.length;
        totalSuccess += batchResult.success;
        totalFailed += batchResult.failed;
        totalSkipped += batchResult.skipped;
        
        console.log(`Job ${jobId}: Smart batch ${batchCount} complete: ${batchResult.success} success, ${batchResult.failed} failed, ${batchResult.skipped} skipped`);
        
        // Update progress after each batch
        await updateJobStatus(jobId, {
          progress: {
            current_step: `Completed smart batch ${batchCount}`,
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
        
        // Dynamic delay based on batch complexity + memory cleanup
        await new Promise(resolve => setTimeout(resolve, dynamicDelay));
        
        // Force garbage collection between batches if available
        if (typeof globalThis.gc === 'function') {
          try {
            globalThis.gc();
          } catch (gcError) {
            // GC not available, that's fine
          }
        }
      }
      
      // If we processed fewer posts than fetched, we're done
      if (posts.length < fetchSize) {
        console.log(`Job ${jobId}: Processed all available posts`);
        break;
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Check if there are still posts to process
    const timeRanOut = Date.now() - startTime >= (MAX_PROCESSING_TIME - SAFETY_BUFFER_MS);
    const hitPostLimit = totalProcessed >= MAX_POSTS_PER_RUN;
    let hasMorePosts = false;
    
    if (timeRanOut || hitPostLimit) {
      try {
        // Use same fallback logic for checking remaining posts
        let remainingCount = 0;
        
        const statusCheck = await supabase
          .from("posts")
          .select("*", { count: 'exact', head: true })
          .or("enrich_status.is.null,enrich_status.eq.pending,enrich_status.eq.failed");
        
        if (statusCheck.error) {
          console.warn(`Remaining posts status check failed: ${statusCheck.error.message}`);
          
          const fallbackCheck = await supabase
            .from("posts")
            .select("*", { count: 'exact', head: true })
            .or("enriched_at.is.null,sentiment.is.null,embedding.is.null");
          
          if (fallbackCheck.error) {
            console.warn(`Remaining posts fallback check failed: ${fallbackCheck.error.message}`);
            remainingCount = 0; // Assume no remaining posts if we can't check
          } else {
            remainingCount = fallbackCheck.count || 0;
          }
        } else {
          remainingCount = statusCheck.count || 0;
        }
        
        hasMorePosts = remainingCount > 0;
        if (timeRanOut) {
          console.log(`Job ${jobId}: Time ran out. Remaining posts to process: ${remainingCount}`);
        }
        if (hitPostLimit) {
          console.log(`Job ${jobId}: Hit post limit (${MAX_POSTS_PER_RUN}). Remaining posts to process: ${remainingCount}`);
        }
      } catch (error) {
        console.warn(`Job ${jobId}: Could not check remaining posts:`, error);
      }
    }

    // Check if all posts were already enriched by getting final stats
    let enrichmentSummary: any = {};
    try {
      const { data: finalStats, error: finalStatsError } = await supabase
        .from("posts")
        .select("sentiment, keywords, enriched_at, enrich_status, embedding");
      
      if (!finalStatsError && finalStats) {
        const totalInDb = finalStats.length;
        const fullyEnriched = finalStats.filter(p => 
          p.enriched_at && p.sentiment !== null && p.keywords !== null && p.embedding !== null
        ).length;
        const partiallyEnriched = finalStats.filter(p => 
          p.enriched_at && (p.sentiment === null || p.keywords === null || p.embedding === null)
        ).length;
        const notEnriched = totalInDb - fullyEnriched - partiallyEnriched;
        
        enrichmentSummary = {
          total_posts_in_database: totalInDb,
          fully_enriched: fullyEnriched,
          partially_enriched: partiallyEnriched,
          not_enriched: notEnriched,
          enrichment_completion_rate: totalInDb > 0 ? Math.round((fullyEnriched / totalInDb) * 100 * 10) / 10 : 0,
          all_posts_enriched: fullyEnriched === totalInDb && totalInDb > 0,
          no_work_needed: totalProcessed === 0 && totalPosts > 0
        };
      }
    } catch (summaryError) {
      console.warn("Could not generate enrichment summary:", summaryError);
    }

    const result = {
      status: "success",
      architecture: "smart_batched_enrichment_with_enhanced_reliability",
      duration_ms: duration,
      duration_minutes: Math.round(duration / 60000 * 10) / 10,
      stats: {
        total_processed: totalProcessed,
        successful: totalSuccess,
        failed: totalFailed,
        skipped: totalSkipped,
        smart_batches: batchCount,
        posts_per_minute: Math.round((totalProcessed / (duration / 60000)) * 10) / 10,
        success_rate: totalProcessed > 0 ? Math.round((totalSuccess / totalProcessed) * 100 * 10) / 10 : 0,
        efficiency_score: totalProcessed > 0 ? Math.round(((totalSuccess + totalSkipped) / totalProcessed) * 100) : 0,
        partial_success_rate: totalProcessed > 0 ? Math.round(((totalSuccess + totalSkipped) / totalProcessed) * 100 * 10) / 10 : 0
      },
      enrichment_summary: enrichmentSummary,
      message: enrichmentSummary.all_posts_enriched 
        ? `🎉 All ${enrichmentSummary.total_posts_in_database} posts are already fully enriched! No work needed.`
        : enrichmentSummary.no_work_needed
        ? `⚠️  Found ${totalPosts} posts but processed 0. Most likely all posts are already enriched.`
        : totalSkipped > totalSuccess
        ? `📊 Mostly maintenance run: ${totalSkipped} posts already enriched, ${totalSuccess} newly processed.`
        : `✅ Successfully processed ${totalProcessed} posts.`,
      reliability: {
        openai_total_requests: reliabilityState.totalRequests,
        openai_failed_requests: reliabilityState.failedRequests,
        openai_failure_rate: reliabilityState.totalRequests > 0 ? 
          Math.round((reliabilityState.failedRequests / reliabilityState.totalRequests) * 100 * 10) / 10 : 0,
        rate_limit_hits: reliabilityState.rateLimitHits,
        consecutive_failures: reliabilityState.consecutiveFailures,
        circuit_breaker_triggered: reliabilityState.circuitBreakerOpen,
        fallback_mode_used: reliabilityState.fallbackMode,
        connection_pool_utilization: Math.round((dbPool as any).pool?.length || 0)
      },
      optimizations: {
        smart_batching: true,
        priority_queue: true,
        parallel_processing: true,
        intelligent_chunking: true,
        dynamic_concurrency: true,
        complexity_analysis: true,
        resumable_processing: true,
        enhanced_reliability: true,
        database_connection_pooling: true,
        partial_success_handling: true,
        exponential_backoff: true,
        circuit_breaker: true,
        fallback_strategies: true
      },
      completed_all: !hasMorePosts,
      time_limited: timeRanOut,
      post_limited: hitPostLimit,
      needs_continuation: hasMorePosts,
      max_posts_per_run: MAX_POSTS_PER_RUN,
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
        total_batches: batchCount,
        posts_success: totalSuccess,
        posts_failed: totalFailed
      },
      result
    });

    console.log(`Job ${jobId}: Enrichment completed successfully:`, result);
    
    // Additional summary logging for clarity
    if (totalProcessed === 0 && totalPosts > 0) {
      console.log(`📊 SUMMARY: Found ${totalPosts} posts in database but processed 0 posts.`);
      console.log(`   This typically means all posts are already fully enriched.`);
    } else if (totalSkipped > totalSuccess) {
      console.log(`📊 SUMMARY: Skipped ${totalSkipped} already-enriched posts, processed ${totalSuccess} new posts.`);
    } else if (totalProcessed > 0) {
      console.log(`📊 SUMMARY: Successfully processed ${totalProcessed} posts (${totalSuccess} success, ${totalFailed} failed, ${totalSkipped} skipped).`);
    }
    
    // Optional: Auto-trigger continuation job if needed and enabled
    if (hasMorePosts && Deno.env.get("AUTO_CONTINUE_ENRICHMENT") === "true") {
      console.log(`Job ${jobId}: Auto-continuing enrichment due to remaining posts`);
      
      // Trigger a new enrichment job asynchronously (fire and forget)
      try {
        const baseUrl = new URL(Deno.env.get("SUPABASE_URL") || "").origin;
        
        fetch(`${baseUrl}/functions/v1/enrich-orchestrator`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          },
          body: JSON.stringify({
            auto_continuation: true,
            previous_job: jobId
          })
        }).catch(error => {
          console.warn(`Failed to auto-trigger continuation job:`, error);
        });
        
      } catch (autoError) {
        console.warn(`Auto-continuation setup failed:`, autoError);
      }
    }

  } catch (error) {
    console.error(`Job ${jobId}: Enrichment error:`, error);
    
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
      batch_size: parseInt(url.searchParams.get("batch_size") || String(BATCH_SIZE)),
      concurrent_requests: parseInt(url.searchParams.get("concurrent_requests") || String(CONCURRENT_REQUESTS)),
      priority: url.searchParams.get("priority") || "recent_first",
      platform: url.searchParams.get("platform") || "all" // New platform filter
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