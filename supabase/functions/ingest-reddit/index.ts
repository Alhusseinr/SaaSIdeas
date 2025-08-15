// Enhanced ingest function with Reddit and Twitter/X support
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
const USER_AGENT = Deno.env.get("REDDIT_USER_AGENT") ?? "complaint-scanner/0.1";

// Twitter/X API credentials
const TWITTER_BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN");
const TWITTER_API_TIER = Deno.env.get("TWITTER_API_TIER") || "free"; // free, basic, pro

// Function version and last updated timestamp
const FUNCTION_VERSION = "3.0.0";
const LAST_UPDATED = "2025-01-15T12:00:00Z";

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

// Twitter search hashtags and accounts for business/startup content
const twitterHashtags = [
  "#startup", "#SaaS", "#entrepreneur", "#smallbusiness", "#productivity",
  "#freelance", "#webdev", "#marketing", "#ecommerce", "#digitalnomad"
];

const twitterAccounts = [
  "IndieHackers", "ProductHunt", "ycombinator", "VentureHacks", "Patio11",
  "paulg", "pmarca", "garyvee", "naval", "dhh"
];

// Twitter API tier limits
const TWITTER_LIMITS = {
  free: { monthly_posts: 100, daily_posts: 3, queries_per_day: 1 },
  basic: { monthly_posts: 200000, daily_posts: 6700, queries_per_day: 20 },
  pro: { monthly_posts: 500000, daily_posts: 16700, queries_per_day: 50 }
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

async function fetchTwitterPosts(query: string, maxResults: number = 10): Promise<PostData[]> {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn("Twitter Bearer Token not configured, skipping Twitter ingestion");
    return [];
  }

  try {
    const url = new URL("https://api.twitter.com/2/tweets/search/recent");
    url.searchParams.set("query", `${query} -is:retweet lang:en`);
    url.searchParams.set("max_results", String(Math.min(maxResults, 100)));
    url.searchParams.set("tweet.fields", "created_at,author_id,public_metrics,context_annotations");
    url.searchParams.set("user.fields", "username");
    url.searchParams.set("expansions", "author_id");

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${TWITTER_BEARER_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Twitter API error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const tweets = data.data || [];
    const users = data.includes?.users || [];
    
    const posts: PostData[] = [];
    const nowISO = new Date().toISOString();

    for (const tweet of tweets) {
      const author = users.find((u: any) => u.id === tweet.author_id);
      const tweetText = tweet.text || "";
      const createdAt = tweet.created_at ? new Date(tweet.created_at).toISOString() : nowISO;
      const hash = await makeHash("twitter", tweet.id, tweetText, createdAt);

      posts.push({
        platform: "twitter",
        platform_post_id: String(tweet.id),
        author: author?.username || null,
        url: `https://twitter.com/i/status/${tweet.id}`,
        created_at: createdAt,
        fetched_at: nowISO,
        title: null,
        body: tweetText,
        hash: hash
      });
    }

    return posts;
  } catch (error) {
    console.error(`Error fetching Twitter posts for query "${query}":`, error);
    return [];
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTwitterQuotaUsage(supabase: any): Promise<{ daily: number, monthly: number }> {
  try {
    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyData } = await supabase
      .from("posts")
      .select("id", { count: "exact" })
      .eq("platform", "twitter")
      .gte("fetched_at", `${today}T00:00:00Z`);

    // Get this month's usage
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: monthlyData } = await supabase
      .from("posts")
      .select("id", { count: "exact" })
      .eq("platform", "twitter")
      .gte("fetched_at", monthStart);

    return {
      daily: dailyData?.length || 0,
      monthly: monthlyData?.length || 0
    };
  } catch (error) {
    console.warn("Error checking Twitter quota usage:", error);
    return { daily: 0, monthly: 0 };
  }
}

async function checkTwitterQuota(supabase: any, tier: string): Promise<{ canProceed: boolean, reason?: string, usage: any }> {
  const limits = TWITTER_LIMITS[tier as keyof typeof TWITTER_LIMITS];
  if (!limits) {
    return { canProceed: false, reason: "Unknown API tier", usage: null };
  }

  const usage = await getTwitterQuotaUsage(supabase);
  
  // Check monthly limit (most restrictive for free tier)
  if (usage.monthly >= limits.monthly_posts) {
    return {
      canProceed: false,
      reason: `Monthly limit reached: ${usage.monthly}/${limits.monthly_posts} posts`,
      usage
    };
  }

  // Check daily limit
  if (usage.daily >= limits.daily_posts) {
    return {
      canProceed: false,
      reason: `Daily limit reached: ${usage.daily}/${limits.daily_posts} posts`,
      usage
    };
  }

  return { canProceed: true, usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  try {
    console.log("Starting enhanced multi-platform ingest job...");
    const startTime = Date.now();
    const nowISO = new Date().toISOString();
    const runId = `multiplatform_${Date.now()}`;

    // Validate required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required Supabase environment variables");
    }

    console.log("Environment variables validated");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const allPosts: PostData[] = [];
    let redditPosts = 0;
    let twitterPosts = 0;

    // === REDDIT INGESTION ===
    if (REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET) {
      console.log("Starting Reddit ingestion...");
      try {
        console.log("Getting Reddit token...");
        const accessToken = await getRedditToken();
        console.log("Reddit token obtained successfully");

        // Process Reddit subreddits
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
                    platform: "reddit",
                    platform_post_id: String(p.id),
                    author: p.author ? String(p.author) : null,
                    url: p.permalink ? `https://www.reddit.com${p.permalink}` : null,
                    created_at: createdISO,
                    fetched_at: nowISO,
                    title: p.title ?? null,
                    body: body,
                    hash: hash
                  });
                  redditPosts++;
                }

                // Small delay to avoid rate limiting
                await sleep(100);
              } catch (error) {
                console.error(`Error fetching ${subreddit}/"${phrase}":`, error);
              }
            }
          }
        }
        console.log(`Reddit ingestion complete: ${redditPosts} posts fetched`);
      } catch (error) {
        console.error("Reddit ingestion failed:", error);
      }
    } else {
      console.warn("Reddit credentials not configured, skipping Reddit ingestion");
    }

    // === TWITTER INGESTION ===
    if (TWITTER_BEARER_TOKEN) {
      console.log("Starting Twitter ingestion...");
      try {
        // Check Twitter quota before proceeding
        const quotaCheck = await checkTwitterQuota(supabase, TWITTER_API_TIER);
        console.log(`Twitter quota check - Tier: ${TWITTER_API_TIER}, Usage: ${quotaCheck.usage?.monthly}/${TWITTER_LIMITS[TWITTER_API_TIER as keyof typeof TWITTER_LIMITS]?.monthly_posts || 'unknown'}`);

        if (!quotaCheck.canProceed) {
          console.warn(`Twitter ingestion skipped: ${quotaCheck.reason}`);
          // Continue with Reddit-only data
        } else {
          // Calculate safe query limit based on remaining quota
          const limits = TWITTER_LIMITS[TWITTER_API_TIER as keyof typeof TWITTER_LIMITS];
          const remaining = limits.monthly_posts - (quotaCheck.usage?.monthly || 0);
          const maxQueriesForTier = Math.min(limits.queries_per_day, Math.floor(remaining / 5)); // ~5 posts per query average
          
          // Search for complaint phrases combined with business terms
          const twitterQueries = phrases.slice(0, Math.min(5, maxQueriesForTier)).map(phrase => 
            `"${phrase}" (startup OR SaaS OR business OR entrepreneur OR freelance)`
          );

          // Add hashtag searches if quota allows
          if (twitterQueries.length < maxQueriesForTier) {
            twitterQueries.push(...twitterHashtags.slice(0, Math.min(3, maxQueriesForTier - twitterQueries.length)).map(tag => 
              `${tag} (frustrating OR annoying OR broken OR "doesn't work")`
            ));
          }

          // Add searches from popular accounts if quota allows
          if (twitterQueries.length < maxQueriesForTier) {
            twitterQueries.push(...twitterAccounts.slice(0, Math.min(3, maxQueriesForTier - twitterQueries.length)).map(account => 
              `from:${account} (problem OR issue OR frustrating OR "need a solution")`
            ));
          }

          console.log(`Processing ${twitterQueries.length} Twitter queries (limited by ${TWITTER_API_TIER} tier quota)`);

          for (const query of twitterQueries) {
            console.log(`Processing Twitter query: ${query}`);
            try {
              // Check quota before each query for safety
              const currentQuota = await checkTwitterQuota(supabase, TWITTER_API_TIER);
              if (!currentQuota.canProceed) {
                console.warn(`Stopping Twitter ingestion mid-process: ${currentQuota.reason}`);
                break;
              }

              const twitterResults = await fetchTwitterPosts(query, 10);
              allPosts.push(...twitterResults);
              twitterPosts += twitterResults.length;
              
              // Longer delay for free tier to be extra cautious
              const delayMs = TWITTER_API_TIER === 'free' ? 2000 : 1000;
              await sleep(delayMs);
            } catch (error) {
              console.error(`Error with Twitter query "${query}":`, error);
            }
          }
        }
        console.log(`Twitter ingestion complete: ${twitterPosts} posts fetched`);
      } catch (error) {
        console.error("Twitter ingestion failed:", error);
      }
    } else {
      console.warn("Twitter Bearer Token not configured, skipping Twitter ingestion");
    }

    console.log(`Total posts fetched: ${allPosts.length} (Reddit: ${redditPosts}, Twitter: ${twitterPosts})`);

    // Remove duplicates based on platform + platform_post_id
    const uniquePosts = allPosts.filter((post, index, self) => 
      index === self.findIndex(p => p.platform === post.platform && p.platform_post_id === post.platform_post_id)
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
            onConflict: "platform,platform_post_id",
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
      reddit_posts: redditPosts,
      twitter_posts: twitterPosts,
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