// Dedicated job status checking function
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Function version
const FUNCTION_VERSION = "1.1.0";
const LAST_UPDATED = "2025-01-16T19:00:00Z";

// Security configuration (same as ingest function)
const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY");
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // More generous for status checks

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number, windowStart: number }>();

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

interface BaseJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: any;
  result?: any;
  error?: string;
  parameters: any;
}

interface IngestJob extends BaseJob {
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
    };
  };
}

interface EnrichJob extends BaseJob {
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
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

async function getJob(jobId: string): Promise<{ job: BaseJob, type: 'ingest' | 'enrich' } | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Determine job type from job ID prefix
  const jobType = jobId.startsWith('enrich_') ? 'enrich' : 'ingest';
  const tableName = jobType === 'enrich' ? 'enrich_jobs' : 'ingest_jobs';
  
  console.log(`Looking up job ${jobId} in table ${tableName} (type: ${jobType})`);
  
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", jobId)
    .single();
    
  if (error) {
    console.error(`Error querying ${tableName} for job ${jobId}:`, error);
  }
  
  if (!data) {
    console.log(`No data found for job ${jobId} in ${tableName}`);
  }
    
  if (error || !data) {
    return null;
  }
  
  return {
    job: {
      id: data.id,
      status: data.status,
      created_at: data.created_at,
      started_at: data.started_at,
      completed_at: data.completed_at,
      progress: data.progress,
      result: data.result,
      error: data.error,
      parameters: data.parameters
    },
    type: jobType
  };
}

async function listRecentJobs(limit: number = 10, jobType?: 'ingest' | 'enrich'): Promise<{ jobs: BaseJob[], type: string }[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const allJobs: { jobs: BaseJob[], type: string }[] = [];

  // Fetch ingest jobs if not specified or if specified
  if (!jobType || jobType === 'ingest') {
    const { data: ingestData, error: ingestError } = await supabase
      .from("ingest_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
      
    if (!ingestError && ingestData) {
      allJobs.push({
        type: 'ingest',
        jobs: ingestData.map(item => ({
          id: item.id,
          status: item.status,
          created_at: item.created_at,
          started_at: item.started_at,
          completed_at: item.completed_at,
          progress: item.progress,
          result: item.result,
          error: item.error,
          parameters: item.parameters
        }))
      });
    }
  }

  // Fetch enrich jobs if not specified or if specified
  if (!jobType || jobType === 'enrich') {
    const { data: enrichData, error: enrichError } = await supabase
      .from("enrich_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
      
    if (!enrichError && enrichData) {
      allJobs.push({
        type: 'enrich',
        jobs: enrichData.map(item => ({
          id: item.id,
          status: item.status,
          created_at: item.created_at,
          started_at: item.started_at,
          completed_at: item.completed_at,
          progress: item.progress,
          result: item.result,
          error: item.error,
          parameters: item.parameters
        }))
      });
    }
  }
  
  return allJobs;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const url = new URL(req.url);

  try {
    // Only allow GET requests
    if (req.method !== "GET") {
      return new Response(JSON.stringify({
        error: "Only GET requests are supported"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Security checks (same as ingest function)
    const clientIP = getClientIP(req);
    console.log(`Status check from IP: ${clientIP}`);
    
    // Check rate limiting
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({
        error: "Rate limit exceeded. Maximum 10 requests per minute.",
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
    
    // Optional API key check (same as ingest function)
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

    const jobId = url.searchParams.get("job_id") || url.searchParams.get("id");
    const jobTypeParam = url.searchParams.get("type") as 'ingest' | 'enrich' | null;
    
    // If no job_id provided, return recent jobs list
    if (!jobId) {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam), 50) : 10; // Max 50 jobs
      
      const jobsByType = await listRecentJobs(limit, jobTypeParam || undefined);
      
      // Flatten and combine all jobs
      const allJobs = jobsByType.flatMap(({ jobs, type }) => 
        jobs.map(job => ({
          job_id: job.id,
          job_type: type,
          status: job.status,
          created_at: job.created_at,
          started_at: job.started_at,
          completed_at: job.completed_at,
          duration_ms: job.started_at && job.completed_at 
            ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
            : null,
          progress: job.progress,
          error: job.error
        }))
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return new Response(JSON.stringify({
        status: "success",
        total_jobs: allJobs.length,
        job_types: jobsByType.map(({ type }) => type),
        jobs: allJobs.slice(0, limit),
        function_info: {
          version: FUNCTION_VERSION,
          last_updated: LAST_UPDATED
        }
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Get specific job status
    const jobResult = await getJob(jobId);
    
    if (!jobResult) {
      return new Response(JSON.stringify({
        error: "Job not found",
        job_id: jobId
      }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    const { job, type } = jobResult;

    // Calculate duration if job is completed
    const duration = job.started_at && job.completed_at 
      ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
      : null;

    return new Response(JSON.stringify({
      job_id: jobId,
      job_type: type,
      status: job.status,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      duration_ms: duration,
      progress: job.progress,
      result: job.result,
      error: job.error,
      parameters: job.parameters,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Job status check error:", error);
    
    return new Response(JSON.stringify({
      error: String(error),
      message: "Failed to check job status",
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});