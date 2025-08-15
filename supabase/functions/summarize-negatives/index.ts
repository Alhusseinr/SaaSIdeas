// supabase/functions/summarize-negatives/index.ts
// Enhanced function to summarize negative complaint posts
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Function version and configuration
const FUNCTION_VERSION = "2.0.0";
const LAST_UPDATED = "2025-01-14T23:00:00Z";

// OpenAI Configuration
const MODEL = "gpt-4o-mini";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

// Processing Configuration
const BATCH_SIZE = 15; // Process posts in batches
const CONCURRENT_REQUESTS = 4; // Max concurrent OpenAI requests
const MAX_PROCESSING_TIME = 14 * 60 * 1000; // 14 minutes
const INTER_REQUEST_DELAY = 200; // Small delay between requests

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function createPrompt(post: any) {
  const text = `${post.title || ""}\n${post.body || ""}`.trim().slice(0, 8000);
  
  const systemPrompt = `You are an expert product researcher analyzing customer complaints.

Your task: Create a concise, actionable business summary of this complaint post.

Requirements:
- 1-2 sentences maximum
- Focus on the core problem/pain point
- Use business-friendly language
- Highlight potential opportunity areas
- No metadata, disclaimers, or JSON formatting
- Return ONLY the summary text

Example format: "Users struggle with slow loading times on mobile apps, particularly during peak hours, creating frustration and potential churn opportunities."`;

  const userPrompt = `Analyze this complaint post and provide a business summary:

Title: ${post.title || "No title"}
Content: ${text || "No content"}
Platform: ${post.platform || "Unknown"}
URL: ${post.url || "N/A"}`;

  return { systemPrompt, userPrompt };
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

async function summarizePost(post: any): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — using fallback summary");
    const text = `${post.title || ""}\n${post.body || ""}`.trim();
    const truncated = text.slice(0, 200);
    return truncated ? `Complaint summary: ${truncated}${text.length > 200 ? "..." : ""}` : "Complaint summary: (no content available)";
  }

  const { systemPrompt, userPrompt } = createPrompt(post);
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 150,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      }, TIMEOUT_MS);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = new Error(`OpenAI ${response.status}: ${errorText.slice(0, 300)}`);
        
        // Retry on 503, 429, or 5xx errors
        if (response.status === 503 || response.status === 429 || (response.status >= 500 && response.status < 600)) {
          console.warn(`Summary attempt ${attempt}/${MAX_RETRIES} failed for post ${post.id}: ${response.status} - retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt * attempt));
          continue;
        }
        
        // Don't retry on client errors
        console.error(`OpenAI error for post ${post.id}:`, response.status, errorText.slice(0, 300));
        break;
      }

      const data = await response.json();
      const summary = data?.choices?.[0]?.message?.content?.trim();
      
      if (summary) {
        return summary;
      } else {
        console.warn(`Empty response from OpenAI for post ${post.id}`);
        break;
      }

    } catch (error) {
      lastError = error;
      console.warn(`Summary attempt ${attempt}/${MAX_RETRIES} error for post ${post.id}:`, error);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt * attempt));
      }
    }
  }

  // Fallback summary on failure
  console.error(`All summary attempts failed for post ${post.id}:`, lastError);
  const text = `${post.title || ""}\n${post.body || ""}`.trim();
  const truncated = text.slice(0, 200);
  return truncated ? `Complaint summary: ${truncated}${text.length > 200 ? "..." : ""}` : "Complaint summary: (processing failed)";
}

async function processPostBatch(posts: any[], supabase: any): Promise<{ success: number, failed: number, details: any[] }> {
  let success = 0;
  let failed = 0;
  const details: any[] = [];
  
  // Process posts with controlled concurrency
  const semaphore = new Array(CONCURRENT_REQUESTS).fill(null);
  let postIndex = 0;
  
  const processPost = async (post: any) => {
    try {
      const summary = await summarizePost(post);
      
      // Update the post with summary
      const { error, data } = await supabase
        .from("posts")
        .update({
          summary: summary,
          summarized_at: new Date().toISOString(),
          summary_status: "completed"
        })
        .eq("id", post.id)
        .is("summary", null) // Only update if not already summarized
        .select("id");
      
      if (error) {
        console.error(`Failed to update post ${post.id}:`, error);
        failed++;
        details.push({ id: post.id, status: "failed", error: error.message });
      } else if (data && data.length > 0) {
        success++;
        details.push({ id: post.id, status: "success", summary: summary.slice(0, 100) + "..." });
      } else {
        // Post was already summarized by another process
        details.push({ id: post.id, status: "skipped", reason: "already_summarized" });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, INTER_REQUEST_DELAY));
      
    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error);
      failed++;
      details.push({ id: post.id, status: "failed", error: String(error) });
    }
  };
  
  // Process with concurrency control
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
  
  const startTime = Date.now();
  
  try {
    console.log("Starting negative post summarization...");
    
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required Supabase environment variables");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let batchCount = 0;
    const allDetails: any[] = [];
    
    console.log("Fetching negative posts that need summarization...");
    
    // Process all negative posts that need summarization
    while (Date.now() - startTime < MAX_PROCESSING_TIME) {
      // Fetch negative complaint posts without summaries
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, title, body, url, platform, sentiment, is_complaint")
        .eq("is_complaint", true)
        .lt("sentiment", -0.1) // More negative sentiment
        .is("summary", null)
        .order("sentiment", { ascending: true }) // Most negative first
        .order("created_at", { ascending: false }) // Most recent first
        .limit(BATCH_SIZE);
      
      if (error) {
        console.error("Error fetching posts:", error);
        break;
      }
      
      if (!posts || posts.length === 0) {
        console.log("No more negative posts to summarize");
        break;
      }
      
      console.log(`Processing batch ${++batchCount} with ${posts.length} negative posts...`);
      
      const batchResult = await processPostBatch(posts, supabase);
      totalProcessed += posts.length;
      totalSuccess += batchResult.success;
      totalFailed += batchResult.failed;
      allDetails.push(...batchResult.details);
      
      console.log(`Batch ${batchCount} complete: ${batchResult.success} success, ${batchResult.failed} failed`);
      
      // Delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const duration = Date.now() - startTime;
    const result = {
      status: "success",
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      },
      stats: {
        total_processed: totalProcessed,
        successful: totalSuccess,
        failed: totalFailed,
        batches: batchCount,
        duration_ms: duration,
        duration_minutes: Math.round(duration / 60000 * 10) / 10
      },
      completed_all: totalProcessed === 0 || (Date.now() - startTime < MAX_PROCESSING_TIME),
      sample_details: allDetails.slice(0, 10) // Show first 10 for debugging
    };
    
    console.log("Summarization complete:", result);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
    
  } catch (error) {
    console.error("Summarization function error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
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