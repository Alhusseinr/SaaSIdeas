// Working version of ingest-reddit
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
const USER_AGENT = Deno.env.get("REDDIT_USER_AGENT") ?? "complaint-scanner/0.1";

// Function version and last updated timestamp
const FUNCTION_VERSION = "2.1.0";
const LAST_UPDATED = "2025-01-14T22:00:00Z";

// Enhanced search phrases
const phrases = [
  "annoying", "frustrated", "i hate", "wish there was", "why is it so hard",
  "broken", "useless", "terrible", "nightmare", "pain in the ass",
  "doesn't work", "so slow", "buggy", "awful", "worst", "horrible"
];

// Expanded subreddit list
const subreddits = [
  "smallbusiness", "Entrepreneur", "startups", "SaaS", "freelance",
  "ecommerce", "marketing", "programming", "webdev", "digitalnomad"
];

interface PostData {
  run_id: string;
  name: string;
  score: number;
  url: string | null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

async function makeHash(platform: string, postId: string, text: string, createdAt: string): Promise<string> {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const data = `${platform}:${postId}:${normalizedText.substring(0, 500)}:${createdAt}`;
  const buf = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getRedditToken(): Promise<string> {
  const basic = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    })
  });
  
  if (!resp.ok) {
    throw new Error(`Reddit token error ${resp.status}: ${await resp.text()}`);
  }
  
  const data = await resp.json();
  return data.access_token;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  try {
    console.log("Starting enhanced ingest job...");
    const startTime = Date.now();
    const nowISO = new Date().toISOString();
    const runId = `reddit_${Date.now()}`;

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      throw new Error("Missing required environment variables");
    }

    console.log("Environment variables validated");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Getting Reddit token...");
    const accessToken = await getRedditToken();
    console.log("Reddit token obtained successfully");

    const allPosts: PostData[] = [];

    // Process subreddits sequentially to avoid rate limits
    for (const subreddit of subreddits) {
      console.log(`Processing subreddit: ${subreddit}`);
      
      // Process phrases in small batches
      for (let i = 0; i < phrases.length; i += 2) {
        const phraseBatch = phrases.slice(i, i + 2);
        
        for (const phrase of phraseBatch) {
          try {
            const url = `https://oauth.reddit.com/r/${subreddit}/search?limit=10&sort=new&restrict_sr=1&t=week&q=${encodeURIComponent(`"${phrase}"`)}`;
            
            const response = await fetch(url, {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "User-Agent": USER_AGENT
              }
            });

            if (!response.ok) {
              console.warn(`Reddit API error for ${subreddit}/"${phrase}": ${response.status}`);
              continue;
            }

            const data = await response.json();
            
            for (const child of data?.data?.children ?? []) {
              const p = child.data;
              const body = `${p.title ?? ""}\n\n${p.selftext ?? ""}`.trim();
              const createdISO = new Date((p.created_utc ?? p.created) * 1000).toISOString();
              const hash = await makeHash("reddit", p.id, body, createdISO);

              allPosts.push({
                run_id: runId,
                name: p.title ?? "Untitled Post",
                score: p.score ?? 0,
                url: p.permalink ? `https://www.reddit.com${p.permalink}` : null
              });
            }

            // Small delay to avoid rate limiting
            await sleep(100);
          } catch (error) {
            console.error(`Error fetching ${subreddit}/"${phrase}":`, error);
          }
        }
      }
    }

    console.log(`Total posts fetched: ${allPosts.length}`);

    // Remove duplicates based on URL
    const uniquePosts = allPosts.filter((post, index, self) => 
      index === self.findIndex(p => p.url === post.url)
    );

    console.log(`Unique posts after deduplication: ${uniquePosts.length}`);

    let insertedCount = 0;
    if (uniquePosts.length > 0) {
      // Insert in smaller batches
      const batchSize = 50;
      for (let i = 0; i < uniquePosts.length; i += batchSize) {
        const batch = uniquePosts.slice(i, i + batchSize);
        console.log(`Inserting batch ${Math.floor(i/batchSize) + 1}, size: ${batch.length}`);

        const { error, count } = await supabase
          .from("posts")
          .upsert(batch, {
            onConflict: "url",
            ignoreDuplicates: true,
            count: 'exact'
          });

        if (error) {
          console.error("Upsert error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          throw new Error(`Database upsert failed: ${error.message}`);
        }

        console.log(`Batch inserted successfully, count: ${count}`);
        insertedCount += count || 0;
      }
    } else {
      console.log("No posts to insert");
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      status: "success",
      duration_ms: duration,
      total_fetched: allPosts.length,
      unique_posts: uniquePosts.length,
      inserted: insertedCount,
      run_id: runId,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        timestamp: nowISO
      }
    };

    console.log("Ingestion complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("Error in enhanced ingest:", error);
    return new Response(JSON.stringify({
      error: String(error),
      status: "error",
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
  }
});