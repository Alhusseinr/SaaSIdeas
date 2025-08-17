// Simple enrichment trigger webhook - call this when you want to check and trigger enrichment
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Optional API key for webhook security
const TRIGGER_API_KEY = Deno.env.get("TRIGGER_API_KEY");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
  };
}

async function hasUnenrichedPosts(): Promise<{
  hasUnenriched: boolean;
  count: number;
  total: number;
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Use multiple query approaches for compatibility
  let unenrichedPosts: any[] = [];
  
  try {
    // Try enrich_status query first
    const { data: statusPosts, error: statusError } = await supabase
      .from("posts")
      .select("id")
      .or("enrich_status.is.null,enrich_status.eq.pending,enrich_status.eq.failed");
    
    if (statusError) {
      console.warn("Enrich status query failed, trying fallback");
      
      // Fallback: posts without enriched_at or with null sentiment/embedding
      const { data: fallbackPosts, error: fallbackError } = await supabase
        .from("posts")
        .select("id")
        .or("enriched_at.is.null,sentiment.is.null,embedding.is.null");
      
      if (fallbackError) {
        throw fallbackError;
      }
      
      unenrichedPosts = fallbackPosts || [];
    } else {
      unenrichedPosts = statusPosts || [];
    }
  } catch (error) {
    throw new Error(`Failed to check unenriched posts: ${error.message}`);
  }

  // Get total posts count
  const { count: totalCount, error: countError } = await supabase
    .from("posts")
    .select("*", { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Failed to count total posts: ${countError.message}`);
  }

  return {
    hasUnenriched: unenrichedPosts.length > 0,
    count: unenrichedPosts.length,
    total: totalCount || 0
  };
}

async function triggerEnrichment(context: any = {}): Promise<{
  jobId: string;
  triggered: boolean;
  message: string;
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/enrich-orchestrator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      triggered_by: "webhook_trigger",
      context: context,
      force_trigger: true // Force trigger even if no posts found
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enrichment trigger failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  
  return {
    jobId: result.job_id,
    triggered: true,
    message: `Enrichment job ${result.job_id} triggered successfully`
  };
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
    // Optional API key check
    if (TRIGGER_API_KEY) {
      const providedKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== TRIGGER_API_KEY) {
        return new Response(JSON.stringify({
          error: "Invalid or missing API key"
        }), {
          status: 401,
          headers: { ...corsHeaders(), "Content-Type": "application/json" }
        });
      }
    }

    const force = url.searchParams.get("force") === "true";
    const checkOnly = url.searchParams.get("check_only") === "true";

    // Parse request body for context
    let context = {};
    if (req.method === "POST") {
      try {
        context = await req.json();
      } catch {
        // Ignore JSON parse errors
      }
    }

    console.log(`Enrichment trigger request: force=${force}, check_only=${checkOnly}`);

    // Check for unenriched posts
    const postStatus = await hasUnenrichedPosts();
    
    console.log(`Post status: ${postStatus.count}/${postStatus.total} posts need enrichment`);

    // If only checking, return status without triggering
    if (checkOnly) {
      return new Response(JSON.stringify({
        status: "check_complete",
        needs_enrichment: postStatus.hasUnenriched,
        unenriched_count: postStatus.count,
        total_posts: postStatus.total,
        message: postStatus.hasUnenriched 
          ? `${postStatus.count} posts need enrichment`
          : "All posts are enriched",
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Trigger enrichment if needed or forced
    if (postStatus.hasUnenriched || force) {
      const triggerResult = await triggerEnrichment({
        ...context,
        unenriched_count: postStatus.count,
        total_posts: postStatus.total,
        forced: force
      });

      return new Response(JSON.stringify({
        status: "triggered",
        ...triggerResult,
        post_status: postStatus,
        forced: force,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({
        status: "no_action_needed",
        message: "All posts are already enriched",
        post_status: postStatus,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

  } catch (error) {
    console.error("Enrichment trigger error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: "Failed to trigger enrichment",
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});