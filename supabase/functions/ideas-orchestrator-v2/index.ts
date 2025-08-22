// Lean Ideas Orchestrator v2 - Coordinates microservices for SaaS idea generation
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const IDEAS_API_KEY = Deno.env.get("IDEAS_API_KEY");

// Railway Ideas Service - eliminates all limits
const RAILWAY_IDEAS_ENDPOINT = Deno.env.get("RAILWAY_IDEAS_ENDPOINT");

// Function version
const FUNCTION_VERSION = "2.0.0";
const LAST_UPDATED = "2025-01-19T15:00:00Z";

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 3;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
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

function checkRateLimit(clientIP: string): { allowed: boolean; remainingRequests: number } {
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
  return `ideas_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function createJob(jobId: string, parameters: any): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  const { error } = await supabase.from("ideas_jobs").insert({
    id: jobId,
    status: "pending",
    created_at: new Date().toISOString(),
    parameters,
  });
  
  if (error) {
    throw new Error(`Failed to create ideas job: ${error.message}`);
  }
}

async function triggerIdeasGeneration(jobId: string, parameters: any): Promise<void> {
  try {
    console.log(`Triggering ideas generation for job ${jobId}`);
    
    // Check if Railway Ideas Service is available
    if (RAILWAY_IDEAS_ENDPOINT) {
      console.log("Using Railway Ideas Service (unlimited processing)...");
      
      const railwayResponse = await fetch(RAILWAY_IDEAS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: jobId,
          ...parameters
        })
      });
      
      if (!railwayResponse.ok) {
        const errorText = await railwayResponse.text();
        throw new Error(`Railway ideas service failed: ${railwayResponse.status} - ${errorText}`);
      }
      
      const result = await railwayResponse.json();
      console.log(`Railway ideas service completed: ${result.ideas_generated} ideas generated`);
      
    } else {
      console.log("Using Supabase microservices (limited processing)...");
      
      const baseUrl = SUPABASE_URL!.replace('supabase.co', 'supabase.co/functions/v1');
      
      // Step 1: Trigger post clustering
      console.log("Step 1: Triggering post-clusterer...");
      const clusterResponse = await fetch(`${baseUrl}/post-clusterer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          ...parameters
        })
      });
      
      if (!clusterResponse.ok) {
        const errorText = await clusterResponse.text();
        throw new Error(`Post clustering failed: ${clusterResponse.status} - ${errorText}`);
      }
      
      console.log(`Supabase microservices triggered successfully for job ${jobId}`);
    }
    
  } catch (error) {
    console.error(`Failed to trigger ideas generation for job ${jobId}:`, error);
    
    // Update job as failed
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    await supabase.from("ideas_jobs").update({
      status: "failed",
      error: String(error),
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  
  const url = new URL(req.url);
  
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Only POST requests are supported"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }
    
    // Security checks
    const clientIP = getClientIP(req);
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({
        error: "Rate limit exceeded. Maximum 3 requests per minute.",
        retryAfter: 60
      }), {
        status: 429,
        headers: { ...corsHeaders(), "Content-Type": "application/json", "Retry-After": "60" }
      });
    }
    
    // Optional API key check
    if (IDEAS_API_KEY) {
      const providedKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== IDEAS_API_KEY) {
        return new Response(JSON.stringify({
          error: "Invalid or missing API key"
        }), {
          status: 401,
          headers: { ...corsHeaders(), "Content-Type": "application/json" }
        });
      }
    }
    
    // Parse parameters
    const jobId = generateJobId();
    const parameters = {
      platform: url.searchParams.get("platform") || "all",
      days: parseInt(url.searchParams.get("days") || "14"),
      limit: parseInt(url.searchParams.get("limit") || "300"),
      similarity_threshold: parseFloat(url.searchParams.get("similarity_threshold") || "0.60"),
      min_cluster_size: parseInt(url.searchParams.get("min_cluster_size") || "3"),
      max_clusters_to_process: parseInt(url.searchParams.get("max_clusters_to_process") || "10"),
      enable_validation: url.searchParams.get("enable_validation") !== "false",
      enable_automation_boost: url.searchParams.get("enable_automation_boost") !== "false",
      use_all_reddit: url.searchParams.get("use_all_reddit") === "true", // For potential future ingest integration
    };
    
    // Create job record
    await createJob(jobId, parameters);
    
    console.log(`Created job ${jobId} with parameters:`, parameters);
    
    // Trigger ideas generation async (Railway or Supabase)
    triggerIdeasGeneration(jobId, parameters).catch(error => 
      console.error(`Ideas generation failed for job ${jobId}:`, error)
    );
    
    // Return immediately
    return new Response(JSON.stringify({
      status: "triggered",
      message: RAILWAY_IDEAS_ENDPOINT ? "SaaS idea generation triggered via Railway (unlimited)" : "SaaS idea generation triggered via Supabase (limited)",
      job_id: jobId,
      created_at: new Date().toISOString(),
      parameters,
      status_url: `${url.origin}/functions/v1/job-status?job_id=${jobId}`,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        architecture: "microservices"
      }
    }), {
      status: 202,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Orchestrator error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
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