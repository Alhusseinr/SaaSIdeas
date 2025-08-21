// Railway Express Server - High-volume Reddit ingestion without timeouts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { configLoader } from "./config/config-loader";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Environment variables
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_AGENT = "complaint-scanner/0.1";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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

async function makeHash(
  platform: string,
  postId: string,
  text: string,
  createdAt: string
): Promise<string> {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, " ");
  const data = `${platform}:${postId}:${normalizedText.substring(
    0,
    500
  )}:${createdAt}`;

  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSoftwareFocused(title: string, body: string): boolean {
  const content = `${title} ${body}`.toLowerCase();

  // Get keywords from config
  const physicalKeywords = configLoader.getAllPhysicalKeywords();
  const softwareKeywords = configLoader.getAllSoftwareKeywords();
  const techTerms = configLoader.getTechRegex();

  // Filter out physical products
  if (physicalKeywords.some((keyword) => content.includes(keyword))) {
    return false;
  }

  // Look for software indicators
  return (
    softwareKeywords.some((keyword) => content.includes(keyword)) ||
    techTerms.test(content)
  );
}

async function getRedditToken(): Promise<string> {
  const basic = Buffer.from(
    `${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`
  ).toString("base64");

  const resp = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!resp.ok) {
    throw new Error(`Reddit token error ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function fetchRedditPosts(
  maxPosts: number = 500,
  useAllReddit: boolean = false
): Promise<{ posts: PostData[]; filtered: number; completed: boolean; totalStored: number; totalDuplicates: number }> {
  const streamingBatch: PostData[] = []; // Small batch for immediate storage
  const seenPostIds = new Set<string>(); // Track unique post IDs to prevent duplicates
  const nowISO = new Date().toISOString();
  let filteredCount = 0;
  let totalStoredPosts = 0;
  let totalDuplicates = 0;
  const STREAMING_BATCH_SIZE = 100; // Store every 100 posts immediately

  console.log(
    `Starting Reddit ingestion: ${maxPosts} posts, useAllReddit: ${useAllReddit}`
  );

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error("Reddit credentials not configured");
  }

  // Get subreddits from config
  const subreddits = useAllReddit ? ["all"] : configLoader.getAllSubreddits();

  // Get phrases from config
  const phrases = configLoader.getAllPhrases();

  try {
    console.log("Getting Reddit token...");
    const accessToken = await getRedditToken();
    console.log("Reddit token obtained successfully");

    const selectedSubreddits = subreddits;
    const selectedPhrases = phrases;

    console.log(
      `Processing ${selectedSubreddits.length} subreddits with ${selectedPhrases.length} phrases`
    );

    for (const subreddit of selectedSubreddits) {
      for (const phrase of selectedPhrases) {
        try {
          // Get settings from config
          const config = configLoader.getRedditConfig();
          const postsPerSearch = config.settings.default_posts_per_search;
          const timeRange = config.settings.default_time_range;
          const sorted = config.settings.sorted_by;

          console.log("sorted: ", config.settings.sorted_by)

          for (const sortby of sorted) {
            const url = `https://oauth.reddit.com/r/${subreddit}/search?limit=${postsPerSearch}&sort=${sortby}&restrict_sr=1&t=${timeRange}&q=${encodeURIComponent(
              `"${phrase}"`
            )}`;

            console.log(
              `Fetching from r/${subreddit} with phrase "${phrase}" (limit: ${postsPerSearch}) (url: ${url})`
            );

            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": USER_AGENT,
              },
            });

            if (!response.ok) {
              if (response.status === 429) {
                console.warn(`Rate limited on r/${subreddit}, sleeping 5s...`);
                await sleep(5000);
                continue;
              }
              console.error(
                `Failed to fetch r/${subreddit}: ${response.status}`
              );
              continue;
            }

            const data = await response.json();
            const redditPosts = data?.data?.children || [];

            for (const child of redditPosts) {
              const post = child.data;
              const title = post.title || "";
              const body = post.selftext || "";

              if (!title && !body) {
                filteredCount++;
                continue;
              }

              if (!isSoftwareFocused(title, body)) {
                filteredCount++;
                continue;
              }

              const hash = await makeHash(
                "reddit",
                post.id,
                `${title} ${body}`,
                post.created_utc
              );

              const postData: PostData = {
                platform: "reddit",
                platform_post_id: post.id,
                author: post.author || null,
                url: `https://reddit.com${post.permalink}`,
                created_at: new Date(post.created_utc * 1000).toISOString(),
                fetched_at: nowISO,
                title: title || null,
                body: body || null,
                hash,
              };

              // Skip if we've already seen this post ID
              if (seenPostIds.has(post.id)) {
                continue;
              }

              seenPostIds.add(post.id);
              streamingBatch.push(postData);

              // Store batch immediately when it reaches the threshold
              if (streamingBatch.length >= STREAMING_BATCH_SIZE) {
                console.log(`Storing batch of ${streamingBatch.length} posts...`);
                const storage = await storePosts([...streamingBatch]);
                totalStoredPosts += storage.inserted;
                totalDuplicates += storage.duplicates;
                console.log(`Batch stored: ${storage.inserted} inserted, ${storage.duplicates} duplicates. Total: ${totalStoredPosts} posts`);
                
                // Clear the batch for next round
                streamingBatch.length = 0;
              }
            }

            await sleep(
              configLoader.getRedditConfig().settings.rate_limit_delay_ms
            ); // Rate limiting from config
          }
        } catch (error) {
          console.error(`Error fetching ${subreddit}/"${phrase}":`, error);
        }
      }

      await sleep(configLoader.getRedditConfig().settings.subreddit_delay_ms); // Pause between subreddits from config
    }

    // Store any remaining posts in the batch
    if (streamingBatch.length > 0) {
      console.log(`Storing final batch of ${streamingBatch.length} posts...`);
      const storage = await storePosts([...streamingBatch]);
      totalStoredPosts += storage.inserted;
      totalDuplicates += storage.duplicates;
      console.log(`Final batch stored: ${storage.inserted} inserted, ${storage.duplicates} duplicates`);
    }

    console.log(
      `Reddit ingestion complete: ${totalStoredPosts + totalDuplicates} posts processed, ${totalStoredPosts} stored, ${totalDuplicates} duplicates, ${filteredCount} filtered`
    );
    
    return { 
      posts: [], // Return empty array since we've already stored everything
      filtered: filteredCount, 
      completed: true,
      totalStored: totalStoredPosts,
      totalDuplicates: totalDuplicates
    };
  } catch (error) {
    console.error("Reddit ingestion failed:", error);
    throw error;
  }
}

// Store posts in Supabase with batch processing to avoid memory issues
async function storePosts(
  posts: PostData[]
): Promise<{ inserted: number; duplicates: number }> {
  if (posts.length === 0) {
    return { inserted: 0, duplicates: 0 };
  }

  console.log(`Storing ${posts.length} posts in Supabase using batch processing...`);

  const BATCH_SIZE = 1000; // Process 1000 posts at a time to avoid memory issues
  let totalInserted = 0;
  let totalDuplicates = 0;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(posts.length / BATCH_SIZE);
    
    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} posts)`);

    try {
      const { data, error } = await supabase
        .from("posts")
        .upsert(batch, {
          onConflict: "platform,platform_post_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        console.error(`Batch ${batchNumber} insert error:`, error);
        throw error;
      }

      const batchInserted = data?.length || 0;
      const batchDuplicates = batch.length - batchInserted;
      
      totalInserted += batchInserted;
      totalDuplicates += batchDuplicates;

      console.log(`Batch ${batchNumber} complete: ${batchInserted} inserted, ${batchDuplicates} duplicates`);
      
      // Small delay between batches to avoid overwhelming the database
      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to process batch ${batchNumber}:`, error);
      throw error;
    }
  }

  console.log(
    `All batches complete: ${totalInserted} total inserted, ${totalDuplicates} total duplicates`
  );

  return { inserted: totalInserted, duplicates: totalDuplicates };
}

// Routes
app.get("/", (req, res) => {
  res.json({
    service: "Reddit Ingest Service",
    version: "1.0.0",
    platform: "Railway",
    status: "running",
    endpoints: {
      health: "/health",
      ingest: "/ingest-reddit",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/config", (req, res) => {
  try {
    const redditConfig = configLoader.getRedditConfig();
    const filterConfig = configLoader.getFilterConfig();

    res.json({
      status: "success",
      config: {
        subreddit_categories: Object.keys(redditConfig.subreddits),
        phrase_categories: Object.keys(redditConfig.phrases),
        total_subreddits: configLoader.getAllSubreddits().length,
        total_phrases: configLoader.getAllPhrases().length,
        settings: redditConfig.settings,
        filter_categories: {
          physical: Object.keys(filterConfig.physical_keywords),
          software: Object.keys(filterConfig.software_keywords),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: String(error),
    });
  }
});

app.post("/reload-config", (req, res) => {
  try {
    configLoader.reloadConfig();
    const redditConfig = configLoader.getRedditConfig();

    res.json({
      status: "success",
      message: "Configuration reloaded successfully",
      timestamp: new Date().toISOString(),
      total_subreddits: configLoader.getAllSubreddits().length,
      total_phrases: configLoader.getAllPhrases().length,
      settings: redditConfig.settings,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: String(error),
    });
  }
});

app.post("/ingest-reddit", async (req, res) => {
  const startTime = Date.now();

  try {
    const { max_posts = 500, use_all_reddit = false } = req.body;

    console.log(
      `Starting Reddit ingestion: ${max_posts} posts, useAllReddit: ${use_all_reddit}`
    );

    // Fetch and stream posts from Reddit (posts are stored automatically during fetching)
    const result = await fetchRedditPosts(max_posts, use_all_reddit);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      posts_processed: result.totalStored + result.totalDuplicates,
      posts_stored: result.totalStored,
      duplicates: result.totalDuplicates,
      filtered: result.filtered,
      completed: result.completed,
      duration_ms: duration,
      duration_readable: `${Math.round(duration / 1000)}s`,
      message: `Successfully processed ${
        result.totalStored + result.totalDuplicates
      } Reddit posts in ${Math.round(duration / 1000)}s (${result.totalStored} stored, ${result.totalDuplicates} duplicates)`,
      platform_info: {
        name: "railway",
        service: "reddit-ingest",
        version: "1.0.0",
      },
    });
  } catch (error) {
    console.error("Ingestion error:", error);

    const duration = Date.now() - startTime;

    res.status(500).json({
      success: false,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "railway",
        service: "reddit-ingest",
        version: "1.0.0",
      },
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Reddit Ingest Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  // console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  // console.log(`📥 Ingest endpoint: http://localhost:${PORT}/ingest-reddit`);
});

export default app;
