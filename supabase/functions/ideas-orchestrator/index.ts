// Ideas orchestrator - coordinates background SaaS idea generation with job tracking
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function version and metadata
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-17T17:00:00Z";

// Security configuration
const IDEAS_API_KEY = Deno.env.get("IDEAS_API_KEY");
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 2; // More restrictive for complex idea generation

// Processing configuration - Ultra conservative for complex analysis
const CHUNK_SIZE = 60; // Smaller chunks for better analysis
const CONCURRENT_REQUESTS = 1; // Sequential processing for idea generation
const MAX_PROCESSING_TIME = 15 * 60 * 1000; // 15 minutes
const INTER_CHUNK_DELAY = 5000; // Longer delays for stability
const OPENAI_TIMEOUT_MS = 60000; // Very long timeout for complex analysis
const MAX_RETRIES = 3;
const SAFETY_BUFFER_MS = 3 * 60 * 1000; // 3 minutes safety buffer
const MAX_SUMMARIES_PER_RUN = 200; // Conservative limit for idea processing

// Enhanced reliability configuration
const OPENAI_RATE_LIMIT_DELAY = 90000; // 1.5 minute delay for rate limit
const EXPONENTIAL_BACKOFF_BASE = 2000; // 2 second base delay
const MAX_EXPONENTIAL_DELAY = 60000; // 60 seconds max delay
const CIRCUIT_BREAKER_THRESHOLD = 3; // Fail fast after 3 consecutive failures
const FALLBACK_USAGE_THRESHOLD = 0.6; // Use fallback when 60% of requests fail

// Idea generation configuration
const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT = 300;
const SUMMARY_TRUNC = 200;
const DEDUPE_LOOKBACK_DAYS = 60;
const MIN_SCORE_THRESHOLD = 30;

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
  private readonly maxConnections = 3; // Smaller pool for idea generation
  private readonly connectionTimeout = 10 * 60 * 1000; // 10 minutes
  
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
          setTimeout(checkForConnection, 200);
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

interface IdeasJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: {
    current_step: string;
    total_steps: number;
    completed_steps: number;
    summaries_processed: number;
    summaries_total: number;
    current_chunk: number;
    total_chunks: number;
    ideas_generated: number;
    ideas_inserted: number;
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
  return `ideas_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function getJob(jobId: string): Promise<IdeasJob | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
    const { data, error } = await supabase
      .from("ideas_jobs")
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

async function createJob(job: IdeasJob): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
    const { error } = await supabase
      .from("ideas_jobs")
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
      console.error("Failed to create ideas job:", error);
      throw new Error(`Failed to create ideas job: ${error.message}`);
    }
    
    console.log(`Created ideas job ${job.id} in database`);
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

async function updateJobStatus(jobId: string, updates: Partial<IdeasJob>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = await dbPool.getConnection();
  
  try {
    const { error } = await supabase
      .from("ideas_jobs")
      .update(updates)
      .eq("id", jobId);
      
    if (error) {
      console.error(`Failed to update ideas job ${jobId}:`, error);
    }
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

// Utility functions
function normalizeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSummaryText(summary: any): string {
  if (!summary) return "";
  if (typeof summary === "object") {
    return String(summary.text || summary.summary || "");
  }
  return String(summary);
}

// Enhanced prompt for idea generation
function buildEnhancedPrompt(items: string[], existingIdeas: string[]): { system: string, user: string } {
  const system = `You are an innovative SaaS strategist and product visionary.

CRITICAL REQUIREMENTS:
1. Identify COMMON PATTERNS across multiple complaints (not individual post solutions)
2. Generate 3-7 DIVERSE SaaS ideas that solve problems affecting MULTIPLE users
3. Each idea should address similar pain points mentioned across DIFFERENT posts
4. Focus on solutions that can serve many customers with the same underlying problem
5. Prioritize B2B SaaS opportunities with clear revenue potential
6. Analyze market landscape: identify if similar solutions exist and what gaps the new idea could fill

PATTERN IDENTIFICATION FOCUS:
- Look for the SAME problem mentioned by different users/companies
- Identify repeated workflow inefficiencies across industries
- Find common integration or automation needs
- Spot recurring compliance, reporting, or data management issues
- Notice shared user experience frustrations

SCORING CRITERIA (0-100):
- Cross-Post Pattern Strength (0-30): How many posts mention similar problems?
- Market Pain Intensity & Frequency (0-25): How urgent and widespread?
- Market Size & Revenue Potential (0-20): Clear willingness to pay?
- Solution Feasibility & Differentiation (0-15): Buildable competitive advantage?
- Market Timing & Opportunity (0-10): Why now?

AVOID SINGLE-POST SOLUTIONS:
- Ideas that only solve one person's specific problem
- Highly customized or niche one-off solutions
- Generic "productivity tools" without specific pain points
- Solutions that don't scale across multiple customers

FOCUS ON SCALABLE PATTERNS:
- Industry-agnostic workflow problems
- Cross-functional communication gaps
- Data integration and automation needs
- Compliance and reporting inefficiencies
- User experience pain points affecting multiple segments

${existingIdeas.length > 0 ? `EXISTING IDEAS TO AVOID DUPLICATING:\n${existingIdeas.join('\n')}\n\nYour new ideas must be meaningfully different from these.\n` : ''}

Return STRICT JSON:
{
  "ideas": [
    {
      "score": 85,
      "name": "Specific Product Name",
      "one_liner": "Clear value proposition solving the common pattern",
      "target_user": "Specific user persona experiencing this pattern",
      "core_features": ["Feature 1", "Feature 2", "Feature 3"],
      "why_now": "Why this opportunity exists now",
      "pricing_hint": "Pricing model suggestion",
      "rationale": "Why this scores high - specific reasoning about the pattern",
      "representative_post_ids": [123, 456, 789],
      "pattern_evidence": "Description of the common pattern across posts",
      "similar_to": "List of existing similar products or solutions in the market",
      "gaps_filled": "Specific gaps or limitations in existing solutions that this idea addresses",
      "does_not_exist": "Explanation of how this idea differs from or improves upon existing solutions"
    }
  ]
}`;

  const user = `Analyze these complaint summaries and identify COMMON PATTERNS that could be solved by scalable SaaS solutions:

${items}

Look for the SAME underlying problems mentioned across MULTIPLE different posts. Generate ideas that solve these recurring patterns, not individual one-off complaints.`;

  return { system, user };
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

// Enhanced OpenAI integration with reliability
async function generateIdeasWithReliability(summaryLines: string[], existingIdeas: string[]): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — cannot generate ideas");
    return { ideas: [] };
  }

  // Check circuit breaker
  if (reliabilityState.circuitBreakerOpen) {
    const timeSinceLastFailure = Date.now() - reliabilityState.lastFailureTime;
    if (timeSinceLastFailure < OPENAI_RATE_LIMIT_DELAY) {
      console.warn("Circuit breaker open, skipping idea generation");
      return { ideas: [] };
    } else {
      console.log("Circuit breaker cooling off, attempting request");
      reliabilityState.circuitBreakerOpen = false;
      reliabilityState.consecutiveFailures = 0;
    }
  }

  const { system, user } = buildEnhancedPrompt(summaryLines, existingIdeas);
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
          temperature: 0.4,
          max_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      }, OPENAI_TIMEOUT_MS);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = new Error(`OpenAI ${response.status}: ${errorText.slice(0, 300)}`);
        
        if (response.status === 429) {
          reliabilityState.rateLimitHits++;
          console.warn(`Rate limit hit, attempt ${attempt}/${MAX_RETRIES}`);
          
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, OPENAI_RATE_LIMIT_DELAY));
            continue;
          }
        } else if (response.status === 503 || (response.status >= 500 && response.status < 600)) {
          console.warn(`Server error ${response.status}, attempt ${attempt}/${MAX_RETRIES}`);
          
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
      const content = data?.choices?.[0]?.message?.content?.trim();
      
      if (content) {
        reliabilityState.consecutiveFailures = 0;
        return JSON.parse(content);
      } else {
        console.warn("Empty response from OpenAI");
        break;
      }

    } catch (error) {
      lastError = error;
      console.warn(`Ideas generation attempt ${attempt}/${MAX_RETRIES} error:`, error);
      
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

  console.error("All idea generation attempts failed:", lastError);
  return { ideas: [] };
}

// Deduplication functions
function calculateSimilarity(idea1: any, idea2: any): number {
  const name1 = normalizeName(idea1.name || "");
  const name2 = normalizeName(idea2.name || "");
  
  if (name1 === name2) return 1.0;
  
  const words1 = new Set(name1.split(" ").filter(w => w.length > 2));
  const words2 = new Set(name2.split(" ").filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  const wordSimilarity = union.size > 0 ? intersection.size / union.size : 0;
  
  const target1 = normalizeName(idea1.target_user || "");
  const target2 = normalizeName(idea2.target_user || "");
  const targetSimilarity = target1 === target2 ? 0.3 : 0;
  
  return Math.max(wordSimilarity, targetSimilarity);
}

function deduplicateIdeas(newIdeas: any[], existingIdeas: any[], threshold: number = 0.4): any[] {
  const allExisting = [...existingIdeas];
  const result: any[] = [];
  
  for (const idea of newIdeas) {
    let isDuplicate = false;
    
    for (const existing of allExisting) {
      if (calculateSimilarity(idea, existing) > threshold) {
        console.log(`Skipping duplicate idea: "${idea.name}" (similar to existing: "${existing.name}")`);
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      for (const accepted of result) {
        if (calculateSimilarity(idea, accepted) > threshold) {
          console.log(`Skipping duplicate idea in batch: "${idea.name}" (similar to: "${accepted.name}")`);
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate && idea.score >= MIN_SCORE_THRESHOLD) {
      result.push(idea);
      allExisting.push(idea);
    }
  }
  
  return result;
}

// Main job execution function
async function executeIdeasJob(jobId: string): Promise<void> {
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

    const { platform, days, limit } = job.parameters;
    console.log(`Starting ideas job ${jobId} for ${platform}, ${days} days, ${limit} limit...`);

    const supabase = await dbPool.getConnection();

    // Fetch summarized complaint posts
    const sinceISO = new Date(Date.now() - days * 86400000).toISOString();
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, summary, sentiment, url, created_at, platform")
      .eq("platform", platform)
      .eq("is_complaint", true)
      .lt("sentiment", -0.1)
      .not("summary", "is", null)
      .gte("created_at", sinceISO)
      .order("sentiment", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, MAX_SUMMARIES_PER_RUN));

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      await updateJobStatus(jobId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: {
          message: "No summarized complaints found",
          ideas_generated: 0,
          ideas_inserted: 0,
          posts_processed: 0
        }
      });
      return;
    }

    // Get existing ideas for deduplication
    const dedupeSinceISO = new Date(Date.now() - DEDUPE_LOOKBACK_DAYS * 86400000).toISOString();
    const { data: existingIdeas } = await supabase
      .from("saas_idea_items")
      .select("name, target_user, name_norm")
      .gte("created_at", dedupeSinceISO);

    const existingIdeaNames = (existingIdeas || []).map(idea => 
      `${idea.name} (Target: ${idea.target_user || 'N/A'})`
    );

    // Create run header
    const { data: runData, error: runError } = await supabase
      .from("saas_idea_runs")
      .insert({
        platform: `${platform}_patterns`,
        period_days: days,
        source_limit: limit,
        notes: `Enhanced orchestrated generation from ${posts.length} posts`
      })
      .select("id, created_at")
      .single();

    if (runError || !runData) {
      throw new Error(`Failed to create run: ${runError?.message}`);
    }

    const runId = runData.id;
    console.log(`Created run ${runId}`);

    // Process posts in chunks
    const chunks = [];
    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      chunks.push(posts.slice(i, i + CHUNK_SIZE));
    }

    const allIdeas: any[] = [];
    let processedSummaries = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      if (Date.now() - startTime >= MAX_PROCESSING_TIME) {
        console.log("Processing time limit reached, stopping");
        break;
      }

      const chunk = chunks[chunkIndex];
      const summaryLines = chunk.map(post => {
        const summary = extractSummaryText(post.summary).replace(/\s+/g, " ").trim();
        const truncated = summary.slice(0, SUMMARY_TRUNC);
        return `(${post.id}) ${truncated}${summary.length > SUMMARY_TRUNC ? "…" : ""} [${post.url || 'N/A'}]`;
      });

      console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} posts...`);
      
      // Update progress
      await updateJobStatus(jobId, {
        progress: {
          current_step: `Processing chunk ${chunkIndex + 1}`,
          total_steps: chunks.length,
          completed_steps: chunkIndex,
          summaries_processed: processedSummaries,
          summaries_total: posts.length,
          current_chunk: chunkIndex + 1,
          total_chunks: chunks.length,
          ideas_generated: allIdeas.length,
          ideas_inserted: 0
        }
      });

      try {
        const result = await generateIdeasWithReliability(summaryLines, existingIdeaNames);
        const ideas = Array.isArray(result?.ideas) ? result.ideas : [];
        console.log(`Chunk ${chunkIndex + 1}: received ${ideas.length} raw ideas`);
        
        const deduplicatedIdeas = deduplicateIdeas(ideas, allIdeas.concat(existingIdeas || []));
        console.log(`Chunk ${chunkIndex + 1}: ${deduplicatedIdeas.length} unique ideas after deduplication`);
        
        allIdeas.push(...deduplicatedIdeas);
        processedSummaries += chunk.length;
        
        // Inter-chunk delay
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, INTER_CHUNK_DELAY));
        }
        
      } catch (error) {
        console.error(`Chunk ${chunkIndex + 1} failed:`, error);
      }
    }

    // Prepare and insert ideas
    const preparedIdeas = allIdeas.map(idea => {
      const postIds = Array.isArray(idea.representative_post_ids) 
        ? idea.representative_post_ids.filter(id => Number.isInteger(Number(id))).map(Number)
        : [];
      
      return {
        run_id: runId,
        name: String(idea.name || "Untitled Idea"),
        name_norm: normalizeName(idea.name || ""),
        score: Math.min(100, Math.max(0, Math.round(Number(idea.score) || 0))),
        one_liner: idea.one_liner ? String(idea.one_liner) : null,
        target_user: idea.target_user ? String(idea.target_user) : null,
        core_features: Array.isArray(idea.core_features) ? idea.core_features.map(String) : [],
        why_now: idea.why_now ? String(idea.why_now) : null,
        pricing_hint: idea.pricing_hint ? String(idea.pricing_hint) : null,
        rationale: idea.rationale ? String(idea.rationale) : null,
        representative_post_ids: postIds,
        posts_in_common: postIds.length, // Number of posts that support this idea
        pattern_evidence: idea.pattern_evidence ? String(idea.pattern_evidence) : null,
        similar_to: idea.similar_to ? String(idea.similar_to) : null,
        gaps_filled: idea.gaps_filled ? String(idea.gaps_filled) : null,
        does_not_exist: idea.does_not_exist ? String(idea.does_not_exist) : null,
        payload: idea
      };
    });

    let insertedCount = 0;
    if (preparedIdeas.length > 0) {
      const { data: insertedIdeas, error: insertError } = await supabase
        .from("saas_idea_items")
        .upsert(preparedIdeas, {
          onConflict: "run_id,name_norm",
          ignoreDuplicates: true
        })
        .select("id, name, score");

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        insertedCount = insertedIdeas?.length || 0;
      }
    }

    dbPool.releaseConnection(supabase);
    
    const duration = Date.now() - startTime;
    const result = {
      run_id: runId,
      platform,
      period_days: days,
      source_limit: limit,
      posts_processed: processedSummaries,
      chunks_processed: chunks.length,
      raw_ideas_generated: allIdeas.length,
      ideas_inserted: insertedCount,
      existing_ideas_checked: existingIdeas?.length || 0,
      duration_ms: duration,
      duration_minutes: Math.round(duration / 60000 * 10) / 10,
      sample_ideas: preparedIdeas.slice(0, 5).map(idea => ({
        name: idea.name,
        score: idea.score,
        target_user: idea.target_user,
        posts_in_common: idea.posts_in_common,
        pattern_evidence: idea.pattern_evidence?.slice(0, 100) + "..." || null,
        similar_to: idea.similar_to?.slice(0, 100) + "..." || null,
        gaps_filled: idea.gaps_filled?.slice(0, 100) + "..." || null,
        does_not_exist: idea.does_not_exist?.slice(0, 100) + "..." || null
      })),
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

    console.log(`Ideas job ${jobId} completed:`, result);
    
  } catch (error) {
    console.error(`Ideas job ${jobId} failed:`, error);
    
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
        error: "Only POST requests are supported for triggering idea generation jobs"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Security checks
    const clientIP = getClientIP(req);
    console.log(`Ideas orchestrator request from IP: ${clientIP}`);
    
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({
        error: "Rate limit exceeded. Maximum 2 requests per minute.",
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
    if (IDEAS_API_KEY) {
      const providedKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== IDEAS_API_KEY) {
        console.warn(`Invalid API key from IP: ${clientIP}`);
        return new Response(JSON.stringify({
          error: "Invalid or missing API key"
        }), {
          status: 401,
          headers: { ...corsHeaders(), "Content-Type": "application/json" }
        });
      }
    }

    // Create new ideas job
    const jobId = generateJobId();
    const nowISO = new Date().toISOString();
    
    // Parse parameters
    const jobParameters = {
      platform: url.searchParams.get("platform") || "reddit",
      days: parseInt(url.searchParams.get("days") || String(DEFAULT_DAYS)),
      limit: parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT)),
      chunk_size: parseInt(url.searchParams.get("chunk_size") || String(CHUNK_SIZE))
    };

    const job: IdeasJob = {
      id: jobId,
      status: 'pending',
      created_at: nowISO,
      parameters: jobParameters
    };
    
    await createJob(job);
    
    console.log(`Created ideas job ${jobId} with parameters:`, jobParameters);

    // Execute the job in the background (fire and forget)
    executeIdeasJob(jobId).catch(error => {
      console.error(`Background ideas job ${jobId} failed:`, error);
    });
    
    // Return immediately with job ID
    return new Response(JSON.stringify({
      status: "triggered",
      message: "SaaS idea generation job has been triggered successfully",
      architecture: "orchestrated_ideas",
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
    console.error("Ideas orchestrator trigger error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: "Failed to trigger idea generation job",
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