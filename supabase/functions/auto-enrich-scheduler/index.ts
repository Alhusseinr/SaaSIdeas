// Auto-enrichment scheduler - checks for unenriched posts and triggers enrichment
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Configuration
const CHECK_INTERVAL_MINUTES = 15; // How often to check for unenriched posts
const MIN_POSTS_TO_TRIGGER = 5; // Minimum posts needed to trigger enrichment
const MAX_RECENT_JOBS = 1; // Max concurrent enrichment jobs

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

async function checkForUnenrichedPosts(): Promise<{
  total: number;
  unenriched: number;
  shouldTrigger: boolean;
  reason: string;
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check for posts that need enrichment
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, sentiment, keywords, enriched_at, enrich_status");

  if (error) {
    throw new Error(`Failed to check posts: ${error.message}`);
  }

  const total = posts?.length || 0;
  const unenriched = posts?.filter(p => 
    !p.enriched_at || p.sentiment === null || p.keywords === null
  ).length || 0;

  // Check for recent enrichment jobs
  const { data: recentJobs, error: jobError } = await supabase
    .from("enrich_jobs")
    .select("id, status, created_at")
    .gte("created_at", new Date(Date.now() - CHECK_INTERVAL_MINUTES * 60 * 1000).toISOString())
    .in("status", ["pending", "running"]);

  if (jobError) {
    console.warn("Could not check recent jobs:", jobError.message);
  }

  const recentJobCount = recentJobs?.length || 0;
  
  let shouldTrigger = false;
  let reason = "";

  if (unenriched === 0) {
    reason = `All ${total} posts are already enriched`;
  } else if (unenriched < MIN_POSTS_TO_TRIGGER) {
    reason = `Only ${unenriched} unenriched posts (minimum ${MIN_POSTS_TO_TRIGGER} required)`;
  } else if (recentJobCount >= MAX_RECENT_JOBS) {
    reason = `${recentJobCount} enrichment job(s) already running/pending`;
  } else {
    shouldTrigger = true;
    reason = `${unenriched} posts need enrichment, triggering job`;
  }

  return {
    total,
    unenriched,
    shouldTrigger,
    reason
  };
}

async function triggerEnrichmentJob(context: string): Promise<string> {
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
      triggered_by: "auto_scheduler",
      context: context,
      auto_created: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to trigger enrichment: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.job_id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  try {
    console.log("Auto-enrichment scheduler running...");

    const checkResult = await checkForUnenrichedPosts();
    
    console.log(`Check result: ${checkResult.reason}`);
    console.log(`Posts status: ${checkResult.unenriched}/${checkResult.total} need enrichment`);

    let jobId: string | null = null;
    
    if (checkResult.shouldTrigger) {
      try {
        jobId = await triggerEnrichmentJob(checkResult.reason);
        console.log(`✅ Triggered enrichment job: ${jobId}`);
      } catch (triggerError) {
        console.error("Failed to trigger enrichment:", triggerError);
        
        return new Response(JSON.stringify({
          status: "error",
          message: "Failed to trigger enrichment job",
          error: String(triggerError),
          posts_status: checkResult
        }), {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "application/json" }
        });
      }
    }

    return new Response(JSON.stringify({
      status: "success",
      triggered: checkResult.shouldTrigger,
      job_id: jobId,
      reason: checkResult.reason,
      posts_status: {
        total_posts: checkResult.total,
        unenriched_posts: checkResult.unenriched,
        enrichment_needed: checkResult.unenriched > 0
      },
      config: {
        check_interval_minutes: CHECK_INTERVAL_MINUTES,
        min_posts_to_trigger: MIN_POSTS_TO_TRIGGER,
        max_concurrent_jobs: MAX_RECENT_JOBS
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Auto-enrichment scheduler error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      message: "Auto-enrichment scheduler failed",
      error: String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});