// Reddit Comments-Only Ingest - High-volume comment processing
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
const USER_AGENT = "complaint-scanner-comments/0.1";

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}

async function makeHash(
  platform: string,
  postId: string,
  text: string,
  createdAt: string
): Promise<string> {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, " ");
  const data = `${platform}:${postId}:${normalizedText.substring(0, 500)}:${createdAt}`;
  const buf = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSoftwareFocused(title: string, body: string): boolean {
  const content = `${title} ${body}`.toLowerCase();

  // Filter out physical products
  const physicalKeywords = [
    "shipping", "delivery", "restaurant", "food", "clothing", "furniture", "hardware"
  ];
  if (physicalKeywords.some((keyword) => content.includes(keyword))) {
    return false;
  }

  // Look for software indicators
  const softwareKeywords = [
    "app", "software", "platform", "api", "saas", "web", "tool", "system"
  ];
  const techTerms = /\b(code|programming|developer|tech|digital|startup|business|productivity|crm)\b/i.test(content);

  return softwareKeywords.some((keyword) => content.includes(keyword)) || techTerms;
}

async function getRedditToken(): Promise<string> {
  const basic = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
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

async function fetchTopPostsForComments(
  accessToken: string,
  subreddit: string,
  limit: number = 25
): Promise<Array<{ id: string; score: number; num_comments: number }>> {
  try {
    const url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch posts from r/${subreddit}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const posts = data?.data?.children || [];
    
    // Return posts sorted by engagement (score + comments)
    return posts
      .map((child: any) => ({
        id: child.data.id,
        score: child.data.score || 0,
        num_comments: child.data.num_comments || 0
      }))
      .filter((post: any) => post.score > 10 || post.num_comments > 5) // Only high-engagement posts
      .sort((a: any, b: any) => (b.score + b.num_comments) - (a.score + a.num_comments));
  } catch (error) {
    console.error(`Error fetching posts from r/${subreddit}:`, error);
    return [];
  }
}

async function fetchRedditComments(
  accessToken: string,
  postId: string,
  subreddit: string,
  maxComments: number = 50
): Promise<PostData[]> {
  const comments: PostData[] = [];
  const nowISO = new Date().toISOString();
  
  try {
    const url = `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?depth=3&limit=200`;
    
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
    const commentListing = data[1];
    if (!commentListing?.data?.children) return comments;

    // Enhanced complaint terms for better filtering
    const complaintTerms = [
      // Frustration expressions
      "frustrating", "annoying", "hate", "terrible", "awful", "broken",
      "doesn't work", "slow", "buggy", "crashes", "freezes", "laggy",
      
      // Needs and wants
      "wish there was", "need a tool", "looking for", "why isn't there",
      "should make", "would pay for", "someone build", "missing feature",
      
      // Time/efficiency complaints
      "takes forever", "time consuming", "manual", "tedious", "repetitive",
      "wasting time", "inefficient", "pain in the ass", "nightmare",
      
      // Quality complaints
      "ridiculous", "stupid", "useless", "pointless", "horrible", "worst"
    ];

    function extractComments(commentChildren: any[], depth: number = 0): void {
      if (depth > 3 || comments.length >= maxComments) return;
      
      for (const commentChild of commentChildren) {
        if (comments.length >= maxComments) break;
        
        const comment = commentChild.data;
        if (!comment || !comment.body || 
            comment.body === '[deleted]' || 
            comment.body === '[removed]' ||
            comment.body.length < 20) continue; // Skip very short comments
        
        const commentText = comment.body.toLowerCase();
        
        // Check for complaint terms
        const hasComplaintTerms = complaintTerms.some(term => commentText.includes(term));
        if (!hasComplaintTerms) {
          // Process replies even if parent doesn't match
          if (comment.replies && comment.replies.data && comment.replies.data.children) {
            extractComments(comment.replies.data.children, depth + 1);
          }
          continue;
        }
        
        // Check if software-focused
        if (!isSoftwareFocused("", comment.body)) {
          if (comment.replies && comment.replies.data && comment.replies.data.children) {
            extractComments(comment.replies.data.children, depth + 1);
          }
          continue;
        }

        const createdISO = new Date((comment.created_utc ?? comment.created) * 1000).toISOString();
        const hash = await makeHash("reddit", comment.id, comment.body, createdISO);

        comments.push({
          platform: "reddit",
          platform_post_id: String(comment.id),
          author: comment.author ? String(comment.author) : null,
          url: comment.permalink ? `https://www.reddit.com${comment.permalink}` : null,
          created_at: createdISO,
          fetched_at: nowISO,
          title: `Comment on r/${subreddit} (score: ${comment.score || 0})`,
          body: comment.body,
          hash: hash,
        });
        
        // Process replies
        if (comment.replies && comment.replies.data && comment.replies.data.children) {
          extractComments(comment.replies.data.children, depth + 1);
        }
      }
    }

    extractComments(commentListing.data.children);
    console.log(`Extracted ${comments.length} complaint comments from post ${postId}`);
    return comments;
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    return comments;
  }
}

async function fetchRedditCommentsFromSubreddits(
  maxComments: number = 500
): Promise<{ comments: PostData[]; filtered: number; timeoutReached: boolean; postsProcessed: number }> {
  const allComments: PostData[] = [];
  let filteredCount = 0;
  let postsProcessed = 0;
  
  // Timeout protection
  const startTime = Date.now();
  const MAX_PROCESSING_TIME = 8 * 60 * 1000; // 8 minutes
  let timeoutReached = false;

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error("Reddit credentials not configured");
  }

  // High-engagement subreddits for comment mining
  const commentTargetSubreddits = [
    // Business subreddits with high activity
    "smallbusiness", "Entrepreneur", "startups", "SaaS", "freelance",
    
    // Tech subreddits with lots of complaints
    "programming", "webdev", "sysadmin", "devops", "aws",
    
    // Productivity and workflow subreddits
    "productivity", "getorganized", "NotionSo", "projectmanagement",
    
    // General complaint subreddits
    "mildlyinfuriating", "antiwork", "jobs", "work"
  ];

  try {
    console.log("Getting Reddit token for comment ingestion...");
    const accessToken = await getRedditToken();
    console.log("Token obtained successfully");

    for (const subreddit of commentTargetSubreddits) {
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log(`Timeout reached at subreddit ${subreddit}`);
        timeoutReached = true;
        break;
      }
      
      try {
        console.log(`Fetching top posts from r/${subreddit} for comment mining...`);
        
        // Get top posts from subreddit
        const topPosts = await fetchTopPostsForComments(accessToken, subreddit, 10);
        console.log(`Found ${topPosts.length} high-engagement posts in r/${subreddit}`);
        
        for (const post of topPosts) {
          if (Date.now() - startTime > MAX_PROCESSING_TIME) {
            timeoutReached = true;
            break;
          }
          
          if (allComments.length >= maxComments) break;
          
          try {
            const postComments = await fetchRedditComments(accessToken, post.id, subreddit, 25);
            allComments.push(...postComments);
            postsProcessed++;
            
            console.log(`Processed post ${post.id}: ${postComments.length} comments (${allComments.length} total)`);
            
            await sleep(100); // Rate limiting between posts
          } catch (postError) {
            console.warn(`Error processing post ${post.id}:`, postError);
            filteredCount++;
          }
        }
        
        if (timeoutReached) break;
        await sleep(500); // Rate limiting between subreddits
      } catch (subredditError) {
        console.error(`Error processing subreddit ${subreddit}:`, subredditError);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `Comment ingestion ${timeoutReached ? 'stopped early due to timeout' : 'complete'}: ${allComments.length} comments from ${postsProcessed} posts, ${Math.round(elapsed/1000)}s elapsed`
    );
    
    return { 
      comments: allComments, 
      filtered: filteredCount, 
      timeoutReached,
      postsProcessed
    };
  } catch (error) {
    console.error("Reddit comment ingestion failed:", error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const startTime = Date.now();

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          comments: [],
          filtered: 0,
          error: "Only POST requests are supported",
        }),
        {
          status: 405,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const maxComments = Math.min(body.max_comments || 500, 2000);

    console.log(`Reddit Comments: Processing up to ${maxComments} comments from high-engagement posts`);

    const result = await fetchRedditCommentsFromSubreddits(maxComments);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        comments: result.comments,
        posts_processed: result.postsProcessed,
        filtered: result.filtered,
        timeout_reached: result.timeoutReached,
        message: result.timeoutReached 
          ? `Fetched ${result.comments.length} comments before timeout (${Math.round(duration/1000)}s)`
          : `Successfully fetched ${result.comments.length} Reddit comments from ${result.postsProcessed} posts`,
        duration_ms: duration,
        platform_info: {
          name: "reddit-comments",
          version: "1.0.0",
          last_updated: "2025-01-22T12:00:00Z",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Reddit comments function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        comments: [],
        filtered: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "reddit-comments",
          version: "1.0.0",
          last_updated: "2025-01-22T12:00:00Z",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});