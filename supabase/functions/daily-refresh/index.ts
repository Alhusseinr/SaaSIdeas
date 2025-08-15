// Daily refresh function to keep ideas pipeline updated
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-15T12:00:00Z";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callFunction(functionName: string, payload = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`${functionName} failed: ${response.statusText}`);
  }
  
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const startTime = Date.now();

  try {
    console.log("Starting daily refresh pipeline...");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Step 1: Ingest fresh Reddit data
    console.log("Step 1: Ingesting Reddit data...");
    const ingestResult = await callFunction('ingest-reddit');
    console.log(`Ingest complete: ${ingestResult.total_fetched} posts fetched, ${ingestResult.inserted} inserted`);
    
    // Wait for processing
    await sleep(5000);
    
    // Step 2: Summarize new complaints (if you have this function)
    try {
      console.log("Step 2: Summarizing negative posts...");
      const summarizeResult = await callFunction('summarize-negatives');
      console.log(`Summarization complete: ${summarizeResult.stats?.posts_processed || 0} posts processed`);
      
      // Wait for processing
      await sleep(5000);
    } catch (error) {
      console.warn("Summarization step failed (may not be available):", error);
    }
    
    // Step 3: Generate new SaaS ideas
    console.log("Step 3: Generating SaaS ideas...");
    const ideasResult = await callFunction('ideas-from-summaries', {
      days: 7,  // Look at last 7 days
      limit: 100  // Process up to 100 posts
    });
    console.log(`Ideas generation complete: ${ideasResult.stats?.ideas_inserted || 0} new ideas generated`);
    
    // Step 4: Clean up old data (optional)
    console.log("Step 4: Cleaning up old data...");
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Archive old posts (don't delete, just mark as archived)
    const { error: archiveError } = await supabase
      .from('posts')
      .update({ archived: true })
      .lt('created_at', thirtyDaysAgo)
      .is('archived', null);
    
    if (archiveError) {
      console.warn("Archive operation failed:", archiveError);
    }
    
    const duration = Date.now() - startTime;
    const result = {
      status: "success",
      duration_ms: duration,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        timestamp: new Date().toISOString()
      },
      pipeline_results: {
        ingest: {
          posts_fetched: ingestResult.total_fetched || 0,
          posts_inserted: ingestResult.inserted || 0
        },
        ideas: {
          ideas_generated: ideasResult.stats?.ideas_inserted || 0,
          posts_processed: ideasResult.stats?.posts_processed || 0
        }
      },
      message: `Daily refresh completed successfully. Generated ${ideasResult.stats?.ideas_inserted || 0} new ideas from ${ingestResult.total_fetched || 0} Reddit posts.`
    };

    console.log("Daily refresh complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("Daily refresh error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        timestamp: new Date().toISOString()
      },
      duration_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
  }
});