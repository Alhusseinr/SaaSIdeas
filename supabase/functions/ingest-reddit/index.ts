// Reddit platform ingest function - simplified and self-contained for Edge Functions
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
const USER_AGENT = "complaint-scanner/0.1";

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
  const data = `${platform}:${postId}:${normalizedText.substring(
    0,
    500
  )}:${createdAt}`;
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
    "shipping",
    "delivery",
    "restaurant",
    "food",
    "clothing",
    "furniture",
    "hardware",
  ];
  if (physicalKeywords.some((keyword) => content.includes(keyword))) {
    return false;
  }

  // Look for software indicators
  const softwareKeywords = [
    "app",
    "software",
    "platform",
    "api",
    "saas",
    "web",
    "tool",
    "system",
  ];
  const techTerms =
    /\b(code|programming|developer|tech|digital|startup|business|productivity|crm)\b/i.test(
      content
    );

  return (
    softwareKeywords.some((keyword) => content.includes(keyword)) || techTerms
  );
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

async function fetchRedditComments(
  accessToken: string,
  postId: string,
  subreddit: string,
  maxComments: number = 10
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

    let commentCount = 0;
    for (const commentChild of commentListing.data.children) {
      if (commentCount >= maxComments) break;
      
      const comment = commentChild.data;
      if (!comment || !comment.body || comment.body === '[deleted]' || comment.body === '[removed]') continue;
      
      // Filter for complaint/problem-related comments
      const commentText = comment.body.toLowerCase();
      const hasComplaintTerms = [
        "frustrating", "annoying", "hate", "terrible", "awful", "broken", 
        "doesn't work", "slow", "buggy", "wish there was", "need a tool",
        "why isn't there", "should make", "would pay for"
      ].some(term => commentText.includes(term));
      
      if (!hasComplaintTerms) continue;
      
      // Check if software-focused
      if (!isSoftwareFocused("", comment.body)) continue;

      const createdISO = new Date((comment.created_utc ?? comment.created) * 1000).toISOString();
      const hash = await makeHash("reddit", comment.id, comment.body, createdISO);

      comments.push({
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
      
      commentCount++;
    }
    
    console.log(`Fetched ${comments.length} relevant comments from post ${postId}`);
    return comments;
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    return comments;
  }
}

async function fetchRedditPosts(
  maxPosts: number = 30,
  useAllReddit: boolean = false,
  includeComments: boolean = false
): Promise<{ posts: PostData[]; filtered: number; timeoutReached: boolean }> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;
  
  // Timeout protection - Supabase Edge Functions have ~10 minute limit
  const startTime = Date.now();
  const MAX_PROCESSING_TIME = 8 * 60 * 1000; // 8 minutes to be safe
  let timeoutReached = false;

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error("Reddit credentials not configured");
  }

  // Complete subreddit list from original (priority subreddits)
  const subreddits = useAllReddit ? ["all"] : [
    // Core Business & SaaS Communities (highest priority)
    "smallbusiness",
    "Entrepreneur",
    "startups",
    "SaaS",
    "freelance",
    "ecommerce",
    "business",
    "sidehustle",
    "solopreneur",
    "digitalnomad",
    "SideProject",
    "IndieHackers",

    // Technology & Development (high complaint volume)
    "programming",
    "webdev",
    "devops",
    "sysadmin",
    "learnprogramming",
    "ITCareerQuestions",
    "cscareerquestions",
    "aws",
    "selfhosted",
    "dataengineering",
    "MachineLearning",
    "digitalmarketing",

    // Productivity & Workflow (common pain points)
    "productivity",
    "getorganized",
    "automation",
    "projectmanagement",
    "NotionSo",
    "todoist",
    "GTD",
    "organization",

    // Finance & Operations (business needs)
    "accounting",
    "bookkeeping",
    "personalfinance",
    "customerservice",
    "taxes",
    "financialindependence",
    "investing",
    "realestateinvesting",

    // General Frustration Sources (rich complaint data)
    "mildlyinfuriating",
    "antiwork",
    "jobs",
    "work",
    "firstworldproblems",

    // Random
    "UnpopularOpinion",
    "notinteresting",
    "DoesAnybodyElse",
    "TrueOffMyChest",
    "offmychest",
    "venting",
    "Vent",
    "Rants",
    "rant",
    "complaints",
    "NoStupidQuestions",
    "worldnews",
    "Wellthatsucks",
    "whatdoIdo",
    "space",
    "mildlyinteresting",
    "law",
    "Gamingcirclejerk",
    "politics",
    "AskReddit",
    "news",
    "EntrepreneurRideAlong",
    "ProductManagement",
    "growthhacking",
    
    // Additional high-traffic subreddits (if not using USE_ALL_REDDIT)
    "AskReddit", "LifeProTips", "unpopularopinion", "YouShouldKnow", 
    "explainlikeimfive", "todayilearned", "personalfinance", "relationship_advice",
    "legaladvice", "careerguidance", "findareddit", "tipofmytongue"
  ];

  // Complete phrase list from original
  const phrases = [
    // Frustration / Annoyance
    "annoying",
    "frustrated",
    "i hate",
    "so annoying",
    "drives me crazy",
    "makes no sense",
    "hate dealing with",
    "such a mess",
    "ridiculous",
    "headache",
    "can't stand",
    "annoyed with",

    // Broken / Doesn’t Work
    "wish there was",
    "why is it so hard",
    "broken",
    "useless",
    "terrible",
    "nightmare",
    "pain in the ass",
    "doesn't work",
    "never works",
    "so slow",
    "buggy",
    "awful",
    "worst",
    "horrible",
    "keeps crashing",
    "always down",
    "glitchy",
    "doesn't load",
    "won't connect",
    "stopped working",
    "fails constantly",

    // Time & Productivity Pain
    "takes forever",
    "time-consuming",
    "wasting hours",
    "manual process",
    "inefficient",
    "repetitive",
    "too complicated",
    "overly complex",
    "can't keep up",

    // Unmet Needs / Gaps
    "wish there was a way",
    "wish someone built",
    "need a tool for",
    "looking for software",
    "no good solution",
    "nothing works well",
    "missing feature",
    "lack of options",

    // Emotional Reactions
    "drives me nuts",
    "so stressful",
    "exhausting",
    "overwhelming",
    "i'm stuck",
    "hate using this",
    "makes me want to quit",

    // Cost & Value Complaints
    "too expensive",
    "not worth it",
    "rip off",
    "overpriced",
    "costs too much",
    "bad value",
  ];

  try {
    console.log("Getting Reddit token...");
    const accessToken = await getRedditToken();
    console.log("Reddit token obtained successfully");

    // Use all subreddits and phrases for maximum coverage
    const selectedSubreddits = useAllReddit ? ["all"] : subreddits; // Use all subreddits or just "all"
    const selectedPhrases = phrases; // Use all phrases for maximum coverage

    console.log(`Processing up to ${maxPosts} total posts from ${selectedSubreddits.length} subreddits with ${selectedPhrases.length} phrases`);

    subredditLoop: for (const subreddit of selectedSubreddits) {
      // Check timeout before each subreddit
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log(`Timeout reached at subreddit ${subreddit}, collected ${posts.length} posts`);
        timeoutReached = true;
        break;
      }
      
      for (const phrase of selectedPhrases) {
        // Check both timeout and posts limit before each phrase
        if (Date.now() - startTime > MAX_PROCESSING_TIME) {
          console.log(`Timeout reached at phrase "${phrase}", collected ${posts.length} posts`);
          timeoutReached = true;
          break;
        }
        
        if (posts.length >= maxPosts) {
          console.log(`Reached maxPosts limit of ${maxPosts}, stopping at phrase "${phrase}"`);
          break subredditLoop;
        }
        
        try {
          // Calculate dynamic limit based on remaining posts needed
          const remainingPosts = maxPosts - posts.length;
          const postsPerSearch = Math.min(25, remainingPosts);
          
          const url = `https://oauth.reddit.com/r/${subreddit}/search?limit=${postsPerSearch}&sort=new&restrict_sr=1&t=week&q=${encodeURIComponent(
            `"${phrase}"`
          )}`;

          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": USER_AGENT,
            },
          });

          if (!response.ok) {
            if (response.status === 429) {
              console.warn(
                `Rate limited for ${subreddit}/"${phrase}": waiting...`
              );
              await sleep(5000);
              continue;
            }
            console.warn(
              `Reddit API error for ${subreddit}/"${phrase}": ${response.status}`
            );
            continue;
          }

          const data = await response.json();

          for (const child of data?.data?.children ?? []) {
            // Check posts limit inside the loop
            if (posts.length >= maxPosts) {
              console.log(`Reached maxPosts limit of ${maxPosts} while processing posts`);
              break subredditLoop;
            }
            
            const p = child.data;
            const body = `${p.title ?? ""}\n\n${p.selftext ?? ""}`.trim();

            // Filter out physical product posts
            if (!isSoftwareFocused(p.title ?? "", p.selftext ?? "")) {
              filteredCount++;
              continue;
            }

            const createdISO = new Date(
              (p.created_utc ?? p.created) * 1000
            ).toISOString();
            const hash = await makeHash("reddit", p.id, body, createdISO);

            posts.push({
              platform: "reddit",
              platform_post_id: String(p.id),
              author: p.author ? String(p.author) : null,
              url: p.permalink ? `https://www.reddit.com${p.permalink}` : null,
              created_at: createdISO,
              fetched_at: nowISO,
              title: p.title ?? null,
              body: body,
              hash: hash,
            });

            // Fetch comments if enabled and post has engagement (score > 10 or num_comments > 5)
            if (includeComments && (p.score > 10 || p.num_comments > 5)) {
              try {
                const postComments = await fetchRedditComments(accessToken, p.id, subreddit, 5); // Limit to 5 comments per post for edge functions
                posts.push(...postComments);
                await sleep(100); // Small delay for comment fetching
              } catch (commentError) {
                console.warn(`Failed to fetch comments for post ${p.id}:`, commentError);
              }
            }

            // Stop if we have enough posts (including comments)
            if (posts.length >= maxPosts) break;
          }

          if (posts.length >= maxPosts) break;
          await sleep(200); // Rate limiting
        } catch (error) {
          console.error(`Error fetching ${subreddit}/"${phrase}":`, error);
        }
      }
      
      if (timeoutReached) break;
      if (posts.length >= maxPosts) break;
      await sleep(500); // Pause between subreddits
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `Reddit ingestion ${timeoutReached ? 'stopped early due to timeout' : 'complete'}: ${posts.length} posts fetched, ${filteredCount} filtered, ${Math.round(elapsed/1000)}s elapsed`
    );
    return { posts, filtered: filteredCount, timeoutReached };
  } catch (error) {
    console.error("Reddit ingestion failed:", error);
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
          posts: [],
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
    const maxPosts = Math.min(body.max_posts || 500, 2000); // Allow up to 2000 posts
    const useAllReddit = body.use_all_reddit || false;
    const includeComments = body.include_comments || false;

    console.log(`Reddit: Processing up to ${maxPosts} posts${useAllReddit ? ' from ALL of Reddit' : ' from specific subreddits'}${includeComments ? ' WITH comments' : ''}`);

    const result = await fetchRedditPosts(maxPosts, useAllReddit, includeComments);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        posts: result.posts,
        filtered: result.filtered,
        timeout_reached: result.timeoutReached,
        message: result.timeoutReached 
          ? `Fetched ${result.posts.length} posts before timeout (${Math.round(duration/1000)}s), consider smaller batches`
          : `Successfully fetched ${result.posts.length} Reddit posts, filtered ${result.filtered}`,
        duration_ms: duration,
        platform_info: {
          name: "reddit",
          version: "1.0.0",
          last_updated: "2025-01-17T11:00:00Z",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Reddit platform function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        posts: [],
        filtered: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "reddit",
          version: "1.0.0",
          last_updated: "2025-01-17T11:00:00Z",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});
