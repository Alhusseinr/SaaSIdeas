// Multi-platform ingest orchestrator - coordinates individual platform functions
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Function version and metadata
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-17T10:30:00Z";

// Security configuration
const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 5;

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number, windowStart: number }>();

// Platform configuration - using simplified platform functions (no imports, Edge Function compatible)
const PLATFORMS = {
  reddit: { enabled: true, endpoint: "/functions/v1/ingest-reddit" },
  twitter: { enabled: true, endpoint: "/functions/v1/ingest-twitter" },
  hackernews: { enabled: true, endpoint: "/functions/v1/ingest-hackernews" },
  github: { enabled: true, endpoint: "/functions/v1/ingest-github" },
  producthunt: { enabled: true, endpoint: "/functions/v1/ingest-producthunt" },
  stackoverflow: { enabled: true, endpoint: "/functions/v1/ingest-stackoverflow" },
  youtube: { enabled: true, endpoint: "/functions/v1/ingest-youtube" },
  twitch: { enabled: true, endpoint: "/functions/v1/ingest-twitch" },
  podcast: { enabled: true, endpoint: "/functions/v1/ingest-podcast" },
  notion: { enabled: true, endpoint: "/functions/v1/ingest-notion" }
};

interface PostData {
  platform: string;
  platform_post_id: string;
  author: string | null;
  url: string | null;
  created_at: string;
  fetched_at: string;
  title: string | null;
  body: string | null;
  hash: string;
}

interface PlatformResult {
  platform: string;
  success: boolean;
  posts: PostData[];
  filtered: number;
  error?: string;
  duration_ms: number;
}

interface IngestJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: {
    current_step: string;
    total_steps: number;
    completed_steps: number;
    platforms_status: {
      reddit: 'pending' | 'running' | 'completed' | 'failed';
      twitter: 'pending' | 'running' | 'completed' | 'failed';
      hackernews: 'pending' | 'running' | 'completed' | 'failed';
      github: 'pending' | 'running' | 'completed' | 'failed';
      producthunt: 'pending' | 'running' | 'completed' | 'failed';
      stackoverflow: 'pending' | 'running' | 'completed' | 'failed';
      youtube: 'pending' | 'running' | 'completed' | 'failed';
      twitch: 'pending' | 'running' | 'completed' | 'failed';
      podcast: 'pending' | 'running' | 'completed' | 'failed';
      notion: 'pending' | 'running' | 'completed' | 'failed';
    };
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
  return `orchestrator_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function getJob(jobId: string): Promise<IngestJob | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from("ingest_jobs")
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

async function createJob(job: IngestJob): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { error } = await supabase
    .from("ingest_jobs")
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
    throw new Error(`Failed to create job: ${error.message}`);
  }
}

async function updateJobStatus(jobId: string, updates: Partial<IngestJob>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { error } = await supabase
    .from("ingest_jobs")
    .update(updates)
    .eq("id", jobId);
    
  if (error) {
    console.error(`Failed to update job ${jobId}:`, error);
  }
}

async function callPlatformFunction(
  platform: string, 
  endpoint: string, 
  parameters: any, 
  headers: Record<string, string>
): Promise<PlatformResult> {
  const startTime = Date.now();
  
  try {
    const baseUrl = new URL(Deno.env.get("SUPABASE_URL") || "").origin;
    const url = `${baseUrl}${endpoint}`;
    
    console.log(`Calling ${platform} platform function: ${url}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(parameters)
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${platform} platform function failed: ${response.status} - ${errorText}`);
      
      return {
        platform,
        success: false,
        posts: [],
        filtered: 0,
        error: `HTTP ${response.status}: ${errorText}`,
        duration_ms: duration
      };
    }

    const result = await response.json();
    
    return {
      platform,
      success: true,
      posts: result.posts || [],
      filtered: result.filtered || 0,
      duration_ms: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Error calling ${platform} platform function:`, error);
    
    return {
      platform,
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration
    };
  }
}

async function executeOrchestrationJob(jobId: string, parameters: any): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  try {
    await updateJobStatus(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: {
        current_step: 'Initializing platform calls',
        total_steps: 4,
        completed_steps: 0,
        platforms_status: {
          reddit: 'pending',
          twitter: 'pending',
          hackernews: 'pending',
          github: 'pending',
          producthunt: 'pending',
          stackoverflow: 'pending',
          youtube: 'pending',
          twitch: 'pending',
          podcast: 'pending',
          notion: 'pending'
        }
      }
    });

    const startTime = Date.now();
    console.log(`Job ${jobId}: Starting orchestrated multi-platform ingestion...`);

    // Prepare headers for platform function calls
    const headers: Record<string, string> = {};
    if (INGEST_API_KEY) {
      headers["x-api-key"] = INGEST_API_KEY;
    }

    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Calling all platform functions in parallel',
        total_steps: 4,
        completed_steps: 1,
        platforms_status: {
          reddit: 'running',
          twitter: 'running',
          hackernews: 'running',
          github: 'running',
          producthunt: 'running',
          stackoverflow: 'running',
          youtube: 'running',
          twitch: 'running',
          podcast: 'running',
          notion: 'running'
        }
      }
    });

    // Call all enabled platform functions in parallel with individual status updates
    const enabledPlatforms = Object.entries(PLATFORMS).filter(([_, config]) => config.enabled);
    const platformResults: PlatformResult[] = [];
    const currentPlatformStatuses = {
      reddit: 'running' as const,
      twitter: 'running' as const,
      hackernews: 'running' as const,
      github: 'running' as const,
      producthunt: 'running' as const,
      stackoverflow: 'running' as const,
      youtube: 'running' as const,
      twitch: 'running' as const,
      podcast: 'running' as const,
      notion: 'running' as const
    };

    // Start all platform calls with individual completion tracking
    const platformPromises = enabledPlatforms.map(async ([platform, config]) => {
      try {
        const result = await callPlatformFunction(platform, config.endpoint, parameters, headers);
        platformResults.push(result);
        
        // Update this platform's status individually
        currentPlatformStatuses[platform as keyof typeof currentPlatformStatuses] = result.success ? 'completed' : 'failed';
        
        await updateJobStatus(jobId, {
          progress: {
            current_step: `Platform ${platform} ${result.success ? 'completed' : 'failed'} (${platformResults.length}/${enabledPlatforms.length})`,
            total_steps: 4,
            completed_steps: 2,
            platforms_status: { ...currentPlatformStatuses }
          }
        });
        
        console.log(`Job ${jobId}: Platform ${platform} ${result.success ? 'completed' : 'failed'} - ${result.posts.length} posts`);
        return result;
      } catch (error) {
        console.error(`Job ${jobId}: Platform ${platform} failed with error:`, error);
        currentPlatformStatuses[platform as keyof typeof currentPlatformStatuses] = 'failed';
        
        const failedResult: PlatformResult = {
          platform,
          success: false,
          posts: [],
          filtered: 0,
          error: String(error),
          duration_ms: 0
        };
        
        platformResults.push(failedResult);
        
        await updateJobStatus(jobId, {
          progress: {
            current_step: `Platform ${platform} failed (${platformResults.length}/${enabledPlatforms.length})`,
            total_steps: 4,
            completed_steps: 2,
            platforms_status: { ...currentPlatformStatuses }
          }
        });
        
        return failedResult;
      }
    });

    // Wait for all platforms to complete
    await Promise.all(platformPromises);

    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Processing and combining results',
        total_steps: 4,
        completed_steps: 3,
        platforms_status: currentPlatformStatuses
      }
    });

    // Combine results from all platforms
    const allPosts: PostData[] = [];
    let totalFiltered = 0;
    const platformSummary: Record<string, any> = {};

    for (const result of platformResults) {
      allPosts.push(...result.posts);
      totalFiltered += result.filtered;
      
      platformSummary[result.platform] = {
        success: result.success,
        posts: result.posts.length,
        filtered: result.filtered,
        duration_ms: result.duration_ms,
        error: result.error
      };
    }

    console.log(`Job ${jobId}: Collected ${allPosts.length} posts from ${platformResults.length} platforms`);

    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Inserting data into database',
        total_steps: 4,
        completed_steps: 3,
        platforms_status: currentPlatformStatuses
      }
    });

    // Remove duplicates and insert into database
    const uniquePosts = allPosts.filter((post, index, self) => 
      index === self.findIndex(p => p.platform === post.platform && p.platform_post_id === post.platform_post_id)
    );

    let insertedCount = 0;
    if (uniquePosts.length > 0) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Insert in batches
      const batchSize = 50;
      for (let i = 0; i < uniquePosts.length; i += batchSize) {
        const batch = uniquePosts.slice(i, i + batchSize);
        console.log(`Job ${jobId}: Inserting batch ${Math.floor(i/batchSize) + 1}, size: ${batch.length}`);
        
        const { error, count } = await supabase
          .from("posts")
          .upsert(batch, {
            onConflict: "platform,platform_post_id",
            ignoreDuplicates: true,
            count: 'exact'
          });

        if (error) {
          console.error(`Job ${jobId}: Upsert error:`, error);
          throw new Error(`Database upsert failed: ${error.message}`);
        }

        insertedCount += count || 0;
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      status: "success",
      architecture: "modular_orchestrator",
      duration_ms: duration,
      total_fetched: allPosts.length,
      total_filtered: totalFiltered,
      unique_posts: uniquePosts.length,
      inserted: insertedCount,
      platform_results: platformSummary,
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
        platforms_status: currentPlatformStatuses
      },
      result
    });

    console.log(`Job ${jobId}: Orchestrated ingest completed successfully:`, result);

  } catch (error) {
    console.error(`Job ${jobId}: Orchestrated ingest error:`, error);
    
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
        error: "Only POST requests are supported for triggering orchestrated jobs"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Security checks
    const clientIP = getClientIP(req);
    console.log(`Orchestrator request from IP: ${clientIP}`);
    
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({
        error: "Rate limit exceeded. Maximum 5 requests per minute.",
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
    if (INGEST_API_KEY) {
      const providedKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== INGEST_API_KEY) {
        console.warn(`Invalid API key from IP: ${clientIP}`);
        return new Response(JSON.stringify({
          error: "Invalid or missing API key"
        }), {
          status: 401,
          headers: { ...corsHeaders(), "Content-Type": "application/json" }
        });
      }
    }

    // Create new orchestration job
    const jobId = generateJobId();
    const nowISO = new Date().toISOString();
    
    // Parse parameters (pass through to platform functions)
    const jobParameters = {
      max_subreddits: parseInt(url.searchParams.get("max_subreddits") || "35"),
      max_phrases: parseInt(url.searchParams.get("max_phrases") || "12"),
      extended: url.searchParams.get("extended") === "true"
    };

    const job: IngestJob = {
      id: jobId,
      status: 'pending',
      created_at: nowISO,
      parameters: jobParameters
    };
    
    await createJob(job);
    
    console.log(`Created orchestration job ${jobId} with parameters:`, jobParameters);

    // Start orchestration in background
    executeOrchestrationJob(jobId, jobParameters).catch(error => {
      console.error(`Background orchestration job ${jobId} failed:`, error);
    });

    // Return immediately with job ID
    return new Response(JSON.stringify({
      status: "triggered",
      message: "Orchestrated ingest job has been triggered successfully",
      architecture: "modular_orchestrator",
      job_id: jobId,
      created_at: nowISO,
      parameters: jobParameters,
      enabled_platforms: Object.entries(PLATFORMS)
        .filter(([_, config]) => config.enabled)
        .map(([platform, _]) => platform),
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
    console.error("Orchestrator trigger error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: "Failed to trigger orchestrated ingest job",
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