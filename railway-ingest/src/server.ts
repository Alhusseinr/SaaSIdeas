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

// Initialize Supabase client with longer timeout
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  db: {
    schema: 'public'
  },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        // Increase timeout to 30 seconds
        signal: AbortSignal.timeout(30000)
      });
    }
  }
});

// Circuit breaker for Supabase operations
let circuitBreakerOpen = false;
let circuitBreakerTimer: NodeJS.Timeout | null = null;
const CIRCUIT_BREAKER_TIMEOUT = 180000; // 3 minutes - longer recovery time
let consecutiveFailures = 0;

function openCircuitBreaker() {
  consecutiveFailures++;
  console.log(`🚨 Circuit breaker OPEN (failure #${consecutiveFailures}) - stopping Supabase operations`);
  circuitBreakerOpen = true;
  
  if (circuitBreakerTimer) clearTimeout(circuitBreakerTimer);
  circuitBreakerTimer = setTimeout(() => {
    console.log('🔄 Circuit breaker RESET - resuming operations');
    circuitBreakerOpen = false;
    consecutiveFailures = 0; // Reset failure counter
  }, CIRCUIT_BREAKER_TIMEOUT);
}

// Emergency bypass - just log posts when Supabase is completely down
function logPostsToConsole(posts: PostData[]) {
  console.log('\n📝 EMERGENCY MODE - Logging posts to console (Supabase unavailable):');
  posts.slice(0, 3).forEach((post, index) => {
    console.log(`${index + 1}. [${post.platform_post_id}] ${post.title?.substring(0, 100)}...`);
  });
  console.log(`... and ${posts.length - 3} more posts\n`);
}

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

async function fetchRedditComments(
  accessToken: string,
  postId: string,
  subreddit: string,
  maxComments: number = 20
): Promise<PostData[]> {
  const comments: PostData[] = [];
  const nowISO = new Date().toISOString();
  
  try {
    // Fetch comments for a specific post
    const url = `https://oauth.reddit.com/r/${subreddit}/comments/${postId}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch comments for post ${postId}: ${response.status}`);
      return comments;
    }

    const data = await response.json();
    
    // Reddit returns an array with 2 elements: [post, comments]
    const commentListing = data[1];
    if (!commentListing?.data?.children) return comments;

    // Recursive function to extract comments and replies
    async function extractComments(commentChildren: any[], depth: number = 0, maxDepth: number = 2): Promise<PostData[]> {
      const extractedComments: PostData[] = [];
      if (depth > maxDepth || extractedComments.length >= maxComments) return extractedComments;
      
      for (const commentChild of commentChildren) {
        if (extractedComments.length >= maxComments) break;
        
        const comment = commentChild.data;
        if (!comment || !comment.body || comment.body === '[deleted]' || comment.body === '[removed]') continue;
        
        // Filter for complaint/problem-related comments
        const commentText = comment.body.toLowerCase();
        const hasComplaintTerms = [
          "frustrating", "annoying", "hate", "terrible", "awful", "broken", 
          "doesn't work", "slow", "buggy", "wish there was", "need a tool",
          "why isn't there", "should make", "would pay for", "pain in the ass",
          "time consuming", "manual", "tedious", "nightmare", "ridiculous"
        ].some(term => commentText.includes(term));
        
        if (hasComplaintTerms && isSoftwareFocused("", comment.body)) {
          const createdISO = new Date((comment.created_utc ?? comment.created) * 1000).toISOString();
          const hash = await makeHash("reddit", comment.id, comment.body, createdISO);

          extractedComments.push({
            platform: "reddit",
            platform_post_id: String(comment.id),
            author: comment.author ? String(comment.author) : null,
            url: comment.permalink ? `https://www.reddit.com${comment.permalink}` : null,
            created_at: createdISO,
            fetched_at: nowISO,
            title: `Comment on r/${subreddit}`,
            body: comment.body,
            hash: hash,
          });
        }
        
        // Process replies recursively
        if (comment.replies && comment.replies.data && comment.replies.data.children) {
          const replyComments = await extractComments(comment.replies.data.children, depth + 1, maxDepth);
          extractedComments.push(...replyComments);
        }
      }
      
      return extractedComments;
    }

    const extractedComments = await extractComments(commentListing.data.children);
    console.log(`Fetched ${extractedComments.length} relevant comments from post ${postId}`);
    return extractedComments;
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    return comments;
  }
}

async function fetchRedditPosts(
  maxPosts: number = 500,
  useAllReddit: boolean = false,
  includeComments: boolean = false
): Promise<{ posts: PostData[]; filtered: number; completed: boolean; totalStored: number; totalDuplicates: number }> {
  const streamingBatch: PostData[] = []; // Small batch for immediate storage
  const seenPostIds = new Set<string>(); // Track unique post IDs to prevent duplicates
  const nowISO = new Date().toISOString();
  let filteredCount = 0;
  let totalStoredPosts = 0;
  let totalDuplicates = 0;
  const STREAMING_BATCH_SIZE = 25; // Store every 25 posts immediately to avoid timeouts

  console.log(
    `Starting Reddit ingestion: ${maxPosts} posts, useAllReddit: ${useAllReddit}`
  );

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error("Reddit credentials not configured");
  }

  // Get subreddits from config with intelligent prioritization
  let subreddits;
  if (useAllReddit) {
    subreddits = ["all"];
  } else {
    const allSubreddits = configLoader.getAllSubreddits();
    // Prioritize high-quality subreddits for better results with less volume
    const prioritySubreddits = [
      "SaaS", "startups", "Entrepreneur", "smallbusiness",
      "programming", "webdev", "productivity", "mildlyinfuriating"
    ];
    
    // If maxPosts is small, use only priority subreddits
    if (maxPosts <= 1000) {
      subreddits = prioritySubreddits.filter(sub => allSubreddits.includes(sub));
      console.log(`Using ${subreddits.length} priority subreddits for small batch (${maxPosts} posts)`);
    } else {
      subreddits = allSubreddits;
    }
  }

  // Get phrases from config with optimization for smaller batches
  let phrases = configLoader.getAllPhrases();
  if (maxPosts <= 500) {
    // Use only the most effective phrases for small batches
    phrases = phrases.slice(0, 8); // Top 8 most effective phrases
    console.log(`Using ${phrases.length} high-impact phrases for small batch`);
  }

  try {
    console.log("Getting Reddit token...");
    const accessToken = await getRedditToken();
    console.log("Reddit token obtained successfully");

    const selectedSubreddits = subreddits;
    const selectedPhrases = phrases;

    console.log(
      `Processing ${selectedSubreddits.length} subreddits with ${selectedPhrases.length} phrases (max ${maxPosts} total posts)`
    );

    // Add global counters for maxPosts enforcement and quality tracking
    let totalPostsProcessed = 0;
    let emptySearchCount = 0;
    const maxEmptySearches = 5; // Stop if we get 5 consecutive empty results
    
    subredditLoop: for (const subreddit of selectedSubreddits) {
      if (totalPostsProcessed >= maxPosts) {
        console.log(`Reached maxPosts limit of ${maxPosts}, stopping ingestion`);
        break;
      }
      
      if (emptySearchCount >= maxEmptySearches) {
        console.log(`Too many empty searches (${emptySearchCount}), stopping ingestion to avoid waste`);
        break;
      }
      
      for (const phrase of selectedPhrases) {
        if (totalPostsProcessed >= maxPosts) {
          console.log(`Reached maxPosts limit of ${maxPosts} during phrase processing`);
          break subredditLoop;
        }
        try {
          // Get settings from config
          const config = configLoader.getRedditConfig();
          const postsPerSearch = config.settings.default_posts_per_search;
          const timeRange = config.settings.default_time_range;
          const sorted = config.settings.sorted_by;

          console.log("sorted: ", config.settings.sorted_by)

          for (const sortby of sorted) {
            if (totalPostsProcessed >= maxPosts) {
              console.log(`Reached maxPosts limit of ${maxPosts} during sort processing`);
              break subredditLoop;
            }
            
            const url = `https://oauth.reddit.com/r/${subreddit}/search?limit=${postsPerSearch}&sort=${sortby}&restrict_sr=1&t=${timeRange}&q=${encodeURIComponent(
              `"${phrase}"`
            )}`;

            console.log(
              `Fetching from r/${subreddit} with phrase "${phrase}" (limit: ${postsPerSearch}, processed so far: ${totalPostsProcessed}/${maxPosts})`
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
            
            // Track empty searches
            if (redditPosts.length === 0) {
              emptySearchCount++;
              console.log(`Empty search result for r/${subreddit}/"${phrase}" (${emptySearchCount}/${maxEmptySearches})`);
              continue;
            } else {
              emptySearchCount = 0; // Reset counter on successful search
            }

            for (const child of redditPosts) {
              // Check limit before processing each post
              if (totalPostsProcessed >= maxPosts) {
                console.log(`Reached maxPosts limit of ${maxPosts} while processing posts`);
                break subredditLoop;
              }
              
              const post = child.data;
              const title = post.title || "";
              const body = post.selftext || "";

              totalPostsProcessed++; // Increment counter for each post processed
              
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

              // Comment fetching disabled for now to reduce load

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
      `Reddit ingestion complete: ${totalPostsProcessed} posts processed, ${totalStoredPosts} stored, ${totalDuplicates} duplicates, ${filteredCount} filtered (limit was ${maxPosts})`
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

  // Check circuit breaker
  if (circuitBreakerOpen) {
    console.log('⚠️ Circuit breaker is open - using emergency logging mode');
    logPostsToConsole(posts);
    return { inserted: 0, duplicates: posts.length };
  }

  console.log(`Storing ${posts.length} posts in Supabase using batch processing...`);

  const BATCH_SIZE = 30; // Balanced between performance and reliability
  let totalInserted = 0;
  let totalDuplicates = 0;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(posts.length / BATCH_SIZE);
    
    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} posts)`);

    try {
      // Retry logic for Supabase timeouts
      let retryCount = 0;
      const maxRetries = 3;
      let data: any = null;
      let error: any = null;
      
      while (retryCount < maxRetries) {
        try {
          const result = await supabase
            .from("posts")
            .upsert(batch, {
              onConflict: "platform,platform_post_id",
              ignoreDuplicates: true,
            })
            .select("id");
          
          data = result.data;
          error = result.error;
          
          if (!error) break; // Success, exit retry loop
          
        } catch (supabaseError: any) {
          console.error(`Batch ${batchNumber} attempt ${retryCount + 1} failed:`, {
            message: supabaseError.message,
            code: supabaseError.code,
            status: supabaseError.status,
            details: supabaseError.details || 'No details available'
          });
          
          // Check if this is a timeout/connection error - if so, open circuit breaker immediately
          if (supabaseError.message?.includes('timeout') || 
              supabaseError.message?.includes('TimeoutError') ||
              supabaseError.message?.includes('522') || 
              supabaseError.message?.includes('Connection timed out') ||
              supabaseError.message?.includes('operation was aborted due to timeout') ||
              supabaseError.code === 'ECONNABORTED' ||
              supabaseError.code === 'TIMEOUT' ||
              supabaseError.code === '23' ||
              retryCount >= 1) { // Open circuit breaker after 2 failures
            console.warn('🚨 Timeout/connection error detected - opening circuit breaker immediately');
            openCircuitBreaker();
            // Log remaining posts instead of losing them
            if (i + BATCH_SIZE < posts.length) {
              const remainingPosts = posts.slice(i + BATCH_SIZE);
              logPostsToConsole(remainingPosts);
            }
            return { inserted: totalInserted, duplicates: totalDuplicates + (posts.length - i) };
          }
          
          if (retryCount === maxRetries - 1) {
            error = supabaseError;
            break;
          }
        }
        
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`Retrying batch ${batchNumber} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (error) {
        console.error(`Batch ${batchNumber} insert error after ${retryCount + 1} attempts:`, error);
        throw error;
      }

      const batchInserted = data?.length || 0;
      const batchDuplicates = batch.length - batchInserted;
      
      totalInserted += batchInserted;
      totalDuplicates += batchDuplicates;

      console.log(`Batch ${batchNumber} complete: ${batchInserted} inserted, ${batchDuplicates} duplicates`);
      
      // Delay between batches to avoid overwhelming the database
      if (i + BATCH_SIZE < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 800)); // Balanced delay
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
    const { max_posts = 500, use_all_reddit = false, include_comments = false } = req.body;

    console.log(
      `Starting Reddit ingestion: ${max_posts} posts, useAllReddit: ${use_all_reddit}, includeComments: ${include_comments}`
    );

    // Fetch and stream posts from Reddit (posts are stored automatically during fetching)
    const result = await fetchRedditPosts(max_posts, use_all_reddit, include_comments);

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
