// Enhanced ingest function with Reddit, Twitter/X, and Hacker News support
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
const USER_AGENT = Deno.env.get("REDDIT_USER_AGENT") ?? "complaint-scanner/0.1";

// Twitter/X API credentials
const TWITTER_BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN");
const TWITTER_API_TIER = Deno.env.get("TWITTER_API_TIER") || "free"; // free, basic, pro

// Hacker News API configuration
const HN_API_BASE = "https://hacker-news.firebaseio.com/v0/";
const HN_MAX_STORIES = 50; // Limit to avoid too many API calls

// GitHub API configuration
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_MAX_ISSUES = 100; // Limit per search to avoid rate limits

// Product Hunt API configuration
const PRODUCT_HUNT_TOKEN = Deno.env.get("PRODUCT_HUNT_TOKEN");
const PRODUCT_HUNT_API_BASE = "https://api.producthunt.com/v2/api/graphql";
const PH_MAX_POSTS = 20; // Limit to avoid GraphQL complexity limits

// Stack Overflow API configuration
const STACKOVERFLOW_API_BASE = "https://api.stackexchange.com/2.3";
const SO_MAX_QUESTIONS = 100; // Limit to avoid rate limits
const SO_API_KEY = Deno.env.get("STACKOVERFLOW_API_KEY"); // Optional, increases rate limits

// Function version and last updated timestamp  
const FUNCTION_VERSION = "6.1.0";
const LAST_UPDATED = "2025-01-17T10:00:00Z";

// Security configuration
const INGEST_API_KEY = Deno.env.get("INGEST_API_KEY"); // Optional API key for protection
const MAX_SUBREDDITS = 100; // Hard limit to prevent abuse
const MAX_PHRASES = 20; // Hard limit to prevent abuse
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 requests per minute

// Simple in-memory rate limiting (for basic protection)
const rateLimitMap = new Map<string, { count: number, windowStart: number }>();

// Enhanced search phrases
const phrases = [
  "annoying", "frustrated", "i hate", "wish there was", "why is it so hard",
  "broken", "useless", "terrible", "nightmare", "pain in the ass",
  "doesn't work", "so slow", "buggy", "awful", "worst", "horrible"
];

// Priority subreddit list - optimized for Supabase Pro execution limits
const subreddits = [
  // Core Business & SaaS Communities (highest priority)
  "smallbusiness", "Entrepreneur", "startups", "SaaS", "freelance", "ecommerce", 
  "business", "sidehustle", "solopreneur", "digitalnomad",
  
  // Technology & Development (high complaint volume)
  "programming", "webdev", "devops", "sysadmin", "learnprogramming",
  "ITCareerQuestions", "cscareerquestions", "aws", "selfhosted",
  
  // Productivity & Workflow (common pain points)
  "productivity", "getorganized", "automation", "projectmanagement",
  "NotionSo", "todoist", "GTD", "organization",
  
  // Finance & Operations (business needs)
  "accounting", "bookkeeping", "personalfinance", "customerservice",
  "taxes", "financialindependence", "investing",
  
  // General Frustration Sources (rich complaint data)
  "mildlyinfuriating", "antiwork", "jobs", "work", "firstworldproblems"
];

// Hacker News search terms adapted for professional/technical community language
const hnSearchTerms = [
  "problem", "issue", "challenge", "difficult", "pain", "struggle",
  "why doesn't", "wish there was", "need a tool", "looking for", "need a solution",
  "anyone know", "alternatives to", "problems with", "issues with",
  "lacking", "missing", "gaps in", "shortcomings", "limitations",
  "inefficient", "cumbersome", "tedious", "time-consuming", "manual",
  "better way", "improve", "optimize", "solve", "fix"
];

// GitHub search terms for finding developer pain points and complaints
const githubSearchTerms = [
  "frustrating", "annoying", "broken", "bug", "issue", "problem",
  "doesn't work", "not working", "failing", "error", "crash",
  "slow", "performance", "inefficient", "difficult", "hard to use",
  "confusing", "unclear", "missing feature", "lack of", "need",
  "wish there was", "would be nice", "feature request", "enhancement",
  "painful", "tedious", "cumbersome", "workaround", "hack"
];

// Product Hunt search terms for finding product feedback and gaps
const productHuntSearchTerms = [
  "missing", "lacking", "wish", "need", "should have", "would be great",
  "annoying", "frustrating", "difficult", "confusing", "complicated",
  "broken", "buggy", "slow", "clunky", "hard to use", "unintuitive",
  "disappointed", "expected", "hoping for", "looking for", "alternative",
  "better", "improve", "enhancement", "feature request", "suggestion",
  "problem", "issue", "complaint", "feedback", "criticism"
];

// Stack Overflow search terms for finding developer frustrations and pain points
const stackOverflowSearchTerms = [
  "frustrating", "annoying", "difficult", "confusing", "complicated",
  "broken", "doesn't work", "not working", "failing", "error",
  "slow", "performance", "inefficient", "tedious", "painful",
  "why is", "how to avoid", "better way", "alternative",
  "hate", "terrible", "awful", "horrible", "worst",
  "problem with", "issue with", "trouble with", "struggle",
  "wish there was", "need a tool", "looking for", "missing",
  "limitation", "drawback", "downside", "weakness"
];

// Extended subreddit list for batch processing (when time allows)
const extendedSubreddits = [
  ...subreddits, // Include priority subreddits first
  
  // Additional communities
  "marketing", "remotework", "consulting", "retail", "sales", "logistics",
  "medicine", "nursing", "pharmacy", "dentistry", "mentalhealth", "therapy",
  "Teachers", "education", "homeschool", "students", "teaching",
  "graphic_design", "webdesign", "photography", "writing", "copywriting",
  "realestate", "landlord", "construction", "humanresources", "management",
  "fitness", "travel", "lifehacks", "linux", "excel"
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

// Physical product keywords to filter out (focus on SaaS/software only)
const physicalProductKeywords = [
  'shipping', 'delivery', 'warehouse', 'inventory', 'manufacturing', 'factory',
  'physical product', 'printed', 'printing', 'packaging', 'retail store',
  'brick and mortar', 'restaurant', 'food', 'kitchen', 'clothing', 'apparel',
  'jewelry', 'furniture', 'hardware', 'device', 'gadget', 'machine',
  'equipment', 'vehicle', 'car', 'truck', 'real estate', 'property',
  'construction', 'building', 'plumbing', 'electrical', 'hvac',
  'cleaning service', 'lawn care', 'landscaping', 'moving', 'storage unit'
];

// SaaS/Software positive keywords
const softwareKeywords = [
  'app', 'software', 'platform', 'dashboard', 'api', 'saas', 'web',
  'mobile', 'automation', 'integration', 'analytics', 'tool',
  'system', 'service', 'online', 'digital', 'cloud', 'database',
  'algorithm', 'ai', 'machine learning', 'workflow', 'crm', 'cms'
];

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
  };
}

function getClientIP(req: Request): string {
  // Try to get real IP from various headers (considering proxies/load balancers)
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  
  return "unknown";
}

function checkRateLimit(clientIP: string): { allowed: boolean, remainingRequests: number } {
  const now = Date.now();
  const key = clientIP;
  
  // Clean up old entries (basic cleanup)
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
  
  const clientData = rateLimitMap.get(key);
  
  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window or first request
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remainingRequests: MAX_REQUESTS_PER_WINDOW - 1 };
  }
  
  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remainingRequests: 0 };
  }
  
  clientData.count++;
  return { allowed: true, remainingRequests: MAX_REQUESTS_PER_WINDOW - clientData.count };
}

function validateParameters(url: URL): { valid: boolean, error?: string } {
  const maxSubreddits = parseInt(url.searchParams.get("max_subreddits") || "35");
  const maxPhrases = parseInt(url.searchParams.get("max_phrases") || "12");
  
  if (isNaN(maxSubreddits) || maxSubreddits < 1 || maxSubreddits > MAX_SUBREDDITS) {
    return { valid: false, error: `max_subreddits must be between 1 and ${MAX_SUBREDDITS}` };
  }
  
  if (isNaN(maxPhrases) || maxPhrases < 1 || maxPhrases > MAX_PHRASES) {
    return { valid: false, error: `max_phrases must be between 1 and ${MAX_PHRASES}` };
  }
  
  return { valid: true };
}

function isSoftwareFocused(title: string, body: string): boolean {
  const content = `${title} ${body}`.toLowerCase();
  
  // Strong physical product indicators - immediate filter out
  const hasPhysicalKeywords = physicalProductKeywords.some(keyword => 
    content.includes(keyword.toLowerCase())
  );
  
  if (hasPhysicalKeywords) {
    return false;
  }
  
  // Check for software/digital indicators
  const hasSoftwareKeywords = softwareKeywords.some(keyword => 
    content.includes(keyword.toLowerCase())
  );
  
  // Additional heuristics for software focus
  const hasUrlsOrTech = /\b(\.com|\.net|\.io|github|api|webhook|json|xml|sql|database|server|cloud|code|programming|developer|tech|digital)\b/i.test(content);
  const hasProductivityTerms = /\b(productivity|efficiency|automate|streamline|organize|manage|track|analyze|report|dashboard)\b/i.test(content);
  const hasBusinessTerms = /\b(crm|erp|saas|subscription|recurring|billing|invoice|payment|customer|client|user|account)\b/i.test(content);
  
  // Return true if we have software keywords OR multiple supporting indicators
  return hasSoftwareKeywords || (hasUrlsOrTech && hasProductivityTerms) || (hasBusinessTerms && hasProductivityTerms);
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

// PLATFORM FETCH FUNCTIONS (Run in Parallel)

async function fetchRedditPosts(
  selectedSubreddits: string[], 
  selectedPhrases: string[], 
  extended: boolean
): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    console.warn("Reddit credentials not configured, skipping Reddit ingestion");
    return { posts: [], filtered: 0 };
  }

  try {
    console.log("Getting Reddit token...");
    const accessToken = await getRedditToken();
    console.log("Reddit token obtained successfully");

    // Process Reddit subreddits with rate limiting
    for (let subIndex = 0; subIndex < selectedSubreddits.length; subIndex++) {
      const subreddit = selectedSubreddits[subIndex];
      console.log(`Processing subreddit ${subIndex + 1}/${selectedSubreddits.length}: ${subreddit}`);
      
      // Process phrases in smaller batches with longer delays
      for (let i = 0; i < selectedPhrases.length; i += 3) {
        const phraseBatch = selectedPhrases.slice(i, i + 3);
        
        for (const phrase of phraseBatch) {
          try {
            const url = `https://oauth.reddit.com/r/${subreddit}/search?limit=5&sort=new&restrict_sr=1&t=week&q=${encodeURIComponent(`"${phrase}"`)}`;
            
            const response = await fetch(url, {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "User-Agent": USER_AGENT
              }
            });

            if (!response.ok) {
              if (response.status === 429) {
                console.warn(`Rate limited for ${subreddit}/"${phrase}": waiting 10 seconds...`);
                await sleep(10000); // Wait 10 seconds for rate limit
                continue;
              } else if (response.status === 403) {
                console.warn(`Access forbidden for ${subreddit}/"${phrase}": private/restricted subreddit`);
                continue;
              } else if (response.status === 404) {
                console.warn(`Subreddit not found: ${subreddit}/"${phrase}"`);
                continue;
              }
              console.warn(`Reddit API error for ${subreddit}/"${phrase}": ${response.status}`);
              continue;
            }

            const data = await response.json();
            
            for (const child of data?.data?.children ?? []) {
              const p = child.data;
              const body = `${p.title ?? ""}\n\n${p.selftext ?? ""}`.trim();
              
              // Filter out physical product posts - focus on SaaS/software only
              if (!isSoftwareFocused(p.title ?? "", p.selftext ?? "")) {
                filteredCount++;
                continue;
              }
              
              const createdISO = new Date((p.created_utc ?? p.created) * 1000).toISOString();
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
                hash: hash
              });
            }

            // Pro version - optimized delays for better throughput
            await sleep(extended ? 400 : 150);
          } catch (error) {
            console.error(`Error fetching ${subreddit}/"${phrase}":`, error);
          }
        }
        
        // Pause between phrase batches - reduced for Pro
        await sleep(extended ? 800 : 200);
      }
      
      // Pause between subreddits - reduced for Pro
      await sleep(extended ? 1500 : 300);
    }
    
    console.log(`Reddit ingestion complete: ${posts.length} posts fetched`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Reddit ingestion failed:", error);
    return { posts: [], filtered: 0 };
  }
}

async function fetchHackerNewsPosts(searchTerms: string[], maxStories: number = 50): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  try {
    console.log("Fetching latest Hacker News stories...");
    
    // Get latest story IDs from "new" stories (more likely to contain complaints)
    const newStoriesResponse = await fetch(`${HN_API_BASE}newstories.json`);
    if (!newStoriesResponse.ok) {
      console.warn("Failed to fetch HN new stories");
      return { posts: [], filtered: 0 };
    }
    
    const storyIds = await newStoriesResponse.json();
    const recentStoryIds = storyIds.slice(0, maxStories);
    
    console.log(`Processing ${recentStoryIds.length} recent HN stories...`);
    
    // Fetch story details in batches to avoid overwhelming the API
    for (const storyId of recentStoryIds) {
      try {
        const storyResponse = await fetch(`${HN_API_BASE}item/${storyId}.json`);
        if (!storyResponse.ok) continue;
        
        const story = await storyResponse.json();
        if (!story || story.deleted || story.dead) continue;
        
        // Process the main story
        const title = story.title || "";
        const text = story.text || "";
        const storyContent = `${title} ${text}`.toLowerCase();
        
        // Check if story contains complaint-related terms
        const storyHasComplaintTerms = searchTerms.some(term => 
          storyContent.includes(term.toLowerCase())
        );
        
        // For HN, apply lighter software filtering since it's inherently tech-focused
        const hasPhysicalKeywords = physicalProductKeywords.some(keyword => 
          storyContent.includes(keyword.toLowerCase())
        );
        
        if (storyHasComplaintTerms && !hasPhysicalKeywords) {
          const createdAt = story.time ? new Date(story.time * 1000).toISOString() : nowISO;
          const hash = await makeHash("hackernews", String(story.id), `${title} ${text}`, createdAt);
          
          posts.push({
            platform: "hackernews",
            platform_post_id: String(story.id),
            author: story.by || null,
            url: `https://news.ycombinator.com/item?id=${story.id}`,
            created_at: createdAt,
            fetched_at: nowISO,
            title: title || null,
            body: text || title, // Use title as body if no text
            hash: hash
          });
        } else {
          filteredCount++;
        }
        
        // Also check top-level comments for complaints (but limit to avoid too many API calls)
        if (story.kids && story.kids.length > 0) {
          const topComments = story.kids.slice(0, 5); // Only check first 5 comments
          
          for (const commentId of topComments) {
            try {
              await sleep(50); // Shorter delay for comments
              const commentResponse = await fetch(`${HN_API_BASE}item/${commentId}.json`);
              if (!commentResponse.ok) continue;
              
              const comment = await commentResponse.json();
              if (!comment || comment.deleted || comment.dead || !comment.text) continue;
              
              const commentText = comment.text || "";
              const commentContent = commentText.toLowerCase();
              
              // Check if comment contains complaint-related terms
              const commentHasComplaintTerms = searchTerms.some(term => 
                commentContent.includes(term.toLowerCase())
              );
              
              const commentHasPhysicalKeywords = physicalProductKeywords.some(keyword => 
                commentContent.includes(keyword.toLowerCase())
              );
              
              if (commentHasComplaintTerms && !commentHasPhysicalKeywords) {
                const commentCreatedAt = comment.time ? new Date(comment.time * 1000).toISOString() : nowISO;
                const commentHash = await makeHash("hackernews", String(comment.id), commentText, commentCreatedAt);
                
                posts.push({
                  platform: "hackernews",
                  platform_post_id: String(comment.id),
                  author: comment.by || null,
                  url: `https://news.ycombinator.com/item?id=${comment.id}`,
                  created_at: commentCreatedAt,
                  fetched_at: nowISO,
                  title: `Comment on: ${title}`,
                  body: commentText,
                  hash: commentHash
                });
              } else {
                filteredCount++;
              }
            } catch (commentError) {
              console.error(`Error fetching HN comment ${commentId}:`, commentError);
            }
          }
        }
        
        // Small delay to be respectful to HN API
        await sleep(100);
        
      } catch (error) {
        console.error(`Error fetching HN story ${storyId}:`, error);
      }
    }
    
    console.log(`HN: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Error fetching Hacker News posts:", error);
    return { posts: [], filtered: 0 };
  }
}

async function fetchGitHubIssues(searchTerms: string[], maxIssues: number = 100): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;
  const seenTitles = new Set<string>(); // Track duplicates by title

  if (!GITHUB_TOKEN) {
    console.warn("GitHub token not configured, skipping GitHub ingestion");
    return { posts: [], filtered: 0 };
  }

  // List of bot authors to filter out
  const botAuthors = [
    "github-actions[bot]",
    "dependabot[bot]", 
    "renovate[bot]",
    "greenkeeper[bot]",
    "codecov[bot]",
    "sonarcloud[bot]",
    "snyk-bot",
    "whitesource-bolt[bot]",
    "imgbot[bot]",
    "allcontributors[bot]",
    "semantic-release-bot",
    "netlify[bot]",
    "vercel[bot]"
  ];

  try {
    console.log("Fetching GitHub issues and discussions...");
    
    // Search for recent issues across popular repositories
    const searchQueries = [
      // General software complaints (exclude automated stuff)
      "frustrating OR annoying OR broken OR \"doesn't work\" -author:dependabot -author:github-actions",
      "\"missing feature\" OR \"lack of\" OR \"wish there was\" OR \"would be nice\" -label:dependencies",
      "slow OR performance OR inefficient OR difficult OR \"hard to use\" -is:pull_request",
      "confusing OR unclear OR \"feature request\" OR enhancement -label:bot"
    ];

    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries to avoid rate limits
      try {
        // Search for issues (including discussions)
        const searchUrl = `${GITHUB_API_BASE}/search/issues?q=${encodeURIComponent(query)} type:issue created:>=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=created&order=desc&per_page=${Math.min(maxIssues / 3, 33)}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": USER_AGENT
          }
        });

        if (!response.ok) {
          console.warn(`GitHub API error: ${response.status} - ${response.statusText}`);
          await sleep(1000); // Rate limit backoff
          continue;
        }

        const data = await response.json();
        const issues = data.items || [];
        
        console.log(`GitHub: Processing ${issues.length} issues for query: ${query.substring(0, 50)}...`);

        for (const issue of issues) {
          try {
            const title = issue.title || "";
            const body = issue.body || "";
            const author = issue.user?.login || "";
            const content = `${title} ${body}`.toLowerCase();
            
            // Filter out bot authors
            if (botAuthors.includes(author)) {
              filteredCount++;
              continue;
            }
            
            // Filter out additional bot patterns
            if (author.toLowerCase().includes('bot') || author.endsWith('[bot]')) {
              filteredCount++;
              continue;
            }
            
            // Check for duplicate titles (normalize for comparison)
            const normalizedTitle = title.toLowerCase().trim();
            if (seenTitles.has(normalizedTitle)) {
              filteredCount++;
              continue;
            }
            seenTitles.add(normalizedTitle);
            
            // Check if content contains our search terms
            const hasComplaintTerms = searchTerms.some(term => 
              content.includes(term.toLowerCase())
            );
            
            if (!hasComplaintTerms) {
              filteredCount++;
              continue;
            }
            
            // Filter out obvious spam/irrelevant content
            const isSpam = /\b(crypto|bitcoin|nft|casino|gambling|forex|trading|investment)\b/i.test(content);
            if (isSpam) {
              filteredCount++;
              continue;
            }
            
            // Filter out automated/template issues
            const isAutomated = /\b(automated|template|workflow|ci\/cd|deploy|build|test)\b/i.test(content) && body.length < 200;
            if (isAutomated) {
              filteredCount++;
              continue;
            }
            
            // Focus on software/development related issues
            const isDevelopmentRelated = /\b(code|software|app|tool|library|framework|api|bug|feature|development|programming|developer|tech|digital|platform)\b/i.test(content);
            if (!isDevelopmentRelated && body.length < 100) { // Allow longer posts even if not explicitly dev-related
              filteredCount++;
              continue;
            }
            
            const createdAt = issue.created_at ? new Date(issue.created_at).toISOString() : nowISO;
            const hash = await makeHash("github", String(issue.id), `${title} ${body}`, createdAt);
            
            posts.push({
              platform: "github",
              platform_post_id: String(issue.id),
              author: issue.user?.login || null,
              url: issue.html_url,
              created_at: createdAt,
              fetched_at: nowISO,
              title: title || null,
              body: body || title, // Use title as body if no body
              hash: hash
            });
            
            // Small delay to be respectful to GitHub API
            await sleep(50);
            
          } catch (issueError) {
            console.error(`Error processing GitHub issue ${issue.id}:`, issueError);
          }
        }
        
        // Rate limiting - GitHub allows 5000 requests per hour for authenticated requests
        await sleep(200);
        
      } catch (queryError) {
        console.error(`Error fetching GitHub issues for query "${query}":`, queryError);
      }
    }
    
    console.log(`GitHub: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Error fetching GitHub issues:", error);
    return { posts: [], filtered: 0 };
  }
}

async function fetchProductHuntPosts(searchTerms: string[], maxPosts: number = 50): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!PRODUCT_HUNT_TOKEN) {
    console.warn("Product Hunt token not configured, skipping Product Hunt ingestion");
    return { posts: [], filtered: 0 };
  }

  try {
    console.log("Fetching Product Hunt posts and comments...");

    // Simplified GraphQL query to avoid complexity limits
    const query = `
      query GetPosts {
        posts(first: ${Math.min(maxPosts, 10)}, order: RANKING) {
          edges {
            node {
              id
              name
              tagline
              description
              createdAt
              url
              user {
                username
              }
            }
          }
        }
      }
    `;

    const response = await fetch(PRODUCT_HUNT_API_BASE, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PRODUCT_HUNT_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      console.warn(`Product Hunt API error: ${response.status} - ${response.statusText}`);
      return { posts: [], filtered: 0 };
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error("Product Hunt GraphQL errors:", data.errors);
      return { posts: [], filtered: 0 };
    }

    const productPosts = data.data?.posts?.edges || [];
    console.log(`Product Hunt: Processing ${productPosts.length} posts...`);

    for (const edge of productPosts) {
      try {
        const post = edge.node;
        const postId = post.id;
        const postName = post.name || "";
        const postTagline = post.tagline || "";
        const postDescription = post.description || "";
        
        // Process the main post - focus on product descriptions that might contain pain points
        const postContent = `${postName} ${postTagline} ${postDescription}`.toLowerCase();
        
        // Look for posts that mention problems, solutions, or alternatives
        const hasProblemContext = searchTerms.some(term => 
          postContent.includes(term.toLowerCase())
        ) || /\b(solves?|fixes?|alternative|better|replaces?|improves?)\b/i.test(postContent);

        if (hasProblemContext) {
          const createdAt = post.createdAt ? new Date(post.createdAt).toISOString() : nowISO;
          const hash = await makeHash("producthunt", postId, `${postName} ${postDescription}`, createdAt);
          
          posts.push({
            platform: "producthunt",
            platform_post_id: postId,
            author: post.user?.username || null,
            url: post.url || `https://www.producthunt.com/posts/${postId}`,
            created_at: createdAt,
            fetched_at: nowISO,
            title: postName,
            body: `${postTagline}. ${postDescription}`,
            hash: hash
          });
        } else {
          filteredCount++;
        }
        
        // Small delay to be respectful
        await sleep(100);
        
      } catch (postError) {
        console.error(`Error processing Product Hunt post:`, postError);
      }
    }
    
    console.log(`Product Hunt: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Error fetching Product Hunt posts:", error);
    return { posts: [], filtered: 0 };
  }
}

async function fetchStackOverflowQuestions(searchTerms: string[], maxQuestions: number = 100): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  try {
    console.log("Fetching Stack Overflow questions...");

    // Stack Overflow API parameters
    const baseParams = new URLSearchParams({
      site: 'stackoverflow',
      order: 'desc',
      sort: 'creation',
      pagesize: Math.min(maxQuestions, 100).toString(),
      filter: 'withbody', // Include question body
      fromdate: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000).toString() // Last 7 days
    });

    // Add API key if available (increases rate limits)
    if (SO_API_KEY) {
      baseParams.set('key', SO_API_KEY);
    }

    // Search for questions with frustration/complaint terms
    const searchQueries = [
      "frustrating OR annoying OR \"doesn't work\" OR broken",
      "\"why is\" OR \"how to avoid\" OR \"better way\" OR alternative", 
      "\"problem with\" OR \"issue with\" OR limitation OR drawback",
      "slow OR performance OR inefficient OR tedious"
    ];

    for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries to avoid rate limits
      try {
        const params = new URLSearchParams(baseParams);
        params.set('intitle', query);
        
        const url = `${STACKOVERFLOW_API_BASE}/questions?${params.toString()}`;
        
        const response = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/json"
          }
        });

        if (!response.ok) {
          console.warn(`Stack Overflow API error: ${response.status} - ${response.statusText}`);
          await sleep(2000); // Back off on error
          continue;
        }

        const data = await response.json();
        
        if (data.error_id) {
          console.error("Stack Overflow API error:", data.error_message);
          continue;
        }

        const questions = data.items || [];
        console.log(`Stack Overflow: Processing ${questions.length} questions for query: ${query.substring(0, 30)}...`);

        for (const question of questions) {
          try {
            const title = question.title || "";
            const body = question.body || "";
            const content = `${title} ${body}`.toLowerCase();
            
            // Check if content contains our search terms
            const hasComplaintTerms = searchTerms.some(term => 
              content.includes(term.toLowerCase())
            );
            
            if (!hasComplaintTerms) {
              filteredCount++;
              continue;
            }
            
            // Filter out obvious spam or off-topic
            const isSpam = /\b(crypto|bitcoin|nft|casino|gambling|promotion)\b/i.test(content);
            if (isSpam) {
              filteredCount++;
              continue;
            }
            
            // Filter out very basic questions (focus on complaints/pain points)
            const isBasicQuestion = body.length < 100 && !/(frustrat|annoy|problem|issue|difficult|slow|broken|terrible|awful|hate)/i.test(content);
            if (isBasicQuestion) {
              filteredCount++;
              continue;
            }
            
            // Focus on questions with negative sentiment or pain points
            const hasNegativeSentiment = /(frustrat|annoy|problem|issue|difficult|slow|broken|terrible|awful|hate|why.*so.*hard|doesn.*work|not.*work|fail|error)/i.test(content);
            if (!hasNegativeSentiment && body.length < 200) {
              filteredCount++;
              continue;
            }
            
            const createdAt = question.creation_date ? new Date(question.creation_date * 1000).toISOString() : nowISO;
            const hash = await makeHash("stackoverflow", String(question.question_id), `${title} ${body}`, createdAt);
            
            // Clean up HTML from body
            const cleanBody = body.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
            
            posts.push({
              platform: "stackoverflow",
              platform_post_id: String(question.question_id),
              author: question.owner?.display_name || null,
              url: question.link,
              created_at: createdAt,
              fetched_at: nowISO,
              title: title,
              body: cleanBody.substring(0, 1000), // Limit body length
              hash: hash
            });
            
            // Small delay to be respectful to API
            await sleep(50);
            
          } catch (questionError) {
            console.error(`Error processing Stack Overflow question ${question.question_id}:`, questionError);
          }
        }
        
        // Rate limiting - Stack Overflow allows 300 requests per day without key, 10,000 with key
        await sleep(1000);
        
      } catch (queryError) {
        console.error(`Error fetching Stack Overflow questions for query "${query}":`, queryError);
      }
    }
    
    console.log(`Stack Overflow: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Error fetching Stack Overflow questions:", error);
    return { posts: [], filtered: 0 };
  }
}

async function getTwitterQuotaUsage(supabase: any): Promise<{ daily: number, monthly: number }> {
  try {
    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyData, error: dailyError } = await supabase
      .from("posts")
      .select("id", { count: "exact" })
      .eq("platform", "twitter")
      .gte("fetched_at", `${today}T00:00:00Z`);

    if (dailyError) {
      console.warn("Error getting daily Twitter usage:", dailyError);
    }

    // Get this month's usage
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: monthlyData, error: monthlyError } = await supabase
      .from("posts")
      .select("id", { count: "exact" })
      .eq("platform", "twitter")
      .gte("fetched_at", monthStart);

    if (monthlyError) {
      console.warn("Error getting monthly Twitter usage:", monthlyError);
    }

    return {
      daily: Array.isArray(dailyData) ? dailyData.length : 0,
      monthly: Array.isArray(monthlyData) ? monthlyData.length : 0
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

async function fetchTwitterPosts(query: string, maxResults: number = 10): Promise<{posts: PostData[], filtered: number}> {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn("Twitter Bearer Token not configured, skipping Twitter ingestion");
    return { posts: [], filtered: 0 };
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
      return { posts: [], filtered: 0 };
    }

    const data = await response.json();
    const tweets = data.data || [];
    const users = data.includes?.users || [];
    
    const posts: PostData[] = [];
    const nowISO = new Date().toISOString();
    let filteredCount = 0;

    for (const tweet of tweets) {
      const author = users.find((u: any) => u.id === tweet.author_id);
      const tweetText = tweet.text || "";
      
      // Filter out physical product tweets - focus on SaaS/software only
      if (!isSoftwareFocused("", tweetText)) {
        filteredCount++;
        continue;
      }
      
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

    return { posts, filtered: filteredCount };
  } catch (error) {
    console.error(`Error fetching Twitter posts for query "${query}":`, error);
    return { posts: [], filtered: 0 };
  }
}

async function fetchAllTwitterPosts(
  supabase: any, 
  selectedPhrases: string[], 
  extended: boolean
): Promise<{posts: PostData[], filtered: number}> {
  const allPosts: PostData[] = [];
  let totalFiltered = 0;

  if (!TWITTER_BEARER_TOKEN) {
    console.warn("Twitter Bearer Token not configured, skipping Twitter ingestion");
    return { posts: [], filtered: 0 };
  }

  try {
    // Check Twitter quota before proceeding
    const quotaCheck = await checkTwitterQuota(supabase, TWITTER_API_TIER);
    const limits = TWITTER_LIMITS[TWITTER_API_TIER as keyof typeof TWITTER_LIMITS];
    console.log(`Twitter quota check - Tier: ${TWITTER_API_TIER}, Usage: ${quotaCheck.usage?.monthly || 0}/${limits?.monthly_posts || 'unknown'}`);

    if (!quotaCheck.canProceed) {
      console.warn(`Twitter ingestion skipped: ${quotaCheck.reason}`);
      return { posts: [], filtered: 0 };
    } else if (!limits) {
      console.warn(`Unknown Twitter API tier: ${TWITTER_API_TIER}, skipping Twitter ingestion`);
      return { posts: [], filtered: 0 };
    }

    // Calculate safe query limit based on remaining quota
    const remaining = limits.monthly_posts - (quotaCheck.usage?.monthly || 0);
    const maxQueriesForTier = Math.min(limits.queries_per_day, Math.floor(remaining / 5)); // ~5 posts per query average
    
    // Search for complaint phrases combined with business terms
    const twitterQueries = selectedPhrases.slice(0, Math.min(5, maxQueriesForTier)).map(phrase => 
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
        allPosts.push(...twitterResults.posts);
        totalFiltered += twitterResults.filtered;
        
        // Longer delay for free tier to be extra cautious
        const delayMs = TWITTER_API_TIER === 'free' ? 2000 : 1000;
        await sleep(delayMs);
      } catch (error) {
        console.error(`Error with Twitter query "${query}":`, error);
      }
    }

    console.log(`Twitter ingestion complete: ${allPosts.length} posts fetched`);
    return { posts: allPosts, filtered: totalFiltered };

  } catch (error) {
    console.error("Twitter ingestion failed:", error);
    return { posts: [], filtered: 0 };
  }
}

// Job status interface
interface IngestJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: {
    current_step: string;
    total_steps: number;
    completed_steps: number;
    platforms_status: {
      reddit: 'pending' | 'running' | 'completed' | 'failed';
      twitter: 'pending' | 'running' | 'completed' | 'failed';
      hackernews: 'pending' | 'running' | 'completed' | 'failed';
      github: 'pending' | 'running' | 'completed' | 'failed';
      producthunt: 'pending' | 'running' | 'completed' | 'failed';
      stackoverflow: 'pending' | 'running' | 'completed' | 'failed';
    };
  };
  result?: any;
  error?: string;
  parameters: any;
}

function generateJobId(): string {
  return `ingest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function getJob(jobId: string): Promise<IngestJob | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from("ingest_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
    
  if (error || !data) {
    return null;
  }
  
  return {
    id: data.id,
    status: data.status,
    created_at: data.created_at,
    started_at: data.started_at,
    completed_at: data.completed_at,
    progress: data.progress,
    result: data.result,
    error: data.error,
    parameters: data.parameters
  };
}

async function createJob(job: IngestJob): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { error } = await supabase
    .from("ingest_jobs")
    .insert({
      id: job.id,
      status: job.status,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      progress: job.progress,
      result: job.result,
      error: job.error,
      parameters: job.parameters
    });
    
  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }
}

async function updateJobStatus(jobId: string, updates: Partial<IngestJob>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { error } = await supabase
    .from("ingest_jobs")
    .update(updates)
    .eq("id", jobId);
    
  if (error) {
    console.error(`Failed to update job ${jobId}:`, error);
  }
}

async function executeIngestJob(jobId: string, parameters: any): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;

  try {
    await updateJobStatus(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: {
        current_step: 'Initializing',
        total_steps: 4,
        completed_steps: 0,
        platforms_status: {
          reddit: 'pending',
          twitter: 'pending',
          hackernews: 'pending',
          github: 'pending',
          producthunt: 'pending',
          stackoverflow: 'pending'
        }
      }
    });

    const startTime = Date.now();
    const { selectedSubreddits, selectedPhrases, extended } = parameters;

    console.log(`Job ${jobId}: Starting parallel ingestion from all platforms...`);
    
    // Validate required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Fetching from all platforms',
        total_steps: 4,
        completed_steps: 1,
        platforms_status: {
          reddit: 'running',
          twitter: 'running',
          hackernews: 'running',
          github: 'running',
          producthunt: 'running',
          stackoverflow: 'running'
        }
      }
    });

    const [redditResults, twitterResults, hnResults, githubResults, productHuntResults, stackOverflowResults] = await Promise.all([
      fetchRedditPosts(selectedSubreddits, selectedPhrases, extended),
      fetchAllTwitterPosts(supabase, selectedPhrases, extended),
      fetchHackerNewsPosts(hnSearchTerms, HN_MAX_STORIES),
      fetchGitHubIssues(githubSearchTerms, GITHUB_MAX_ISSUES),
      fetchProductHuntPosts(productHuntSearchTerms, PH_MAX_POSTS),
      fetchStackOverflowQuestions(stackOverflowSearchTerms, SO_MAX_QUESTIONS)
    ]);

    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Processing and deduplicating data',
        total_steps: 4,
        completed_steps: 2,
        platforms_status: {
          reddit: 'completed',
          twitter: 'completed',
          hackernews: 'completed',
          github: 'completed',
          producthunt: 'completed',
          stackoverflow: 'completed'
        }
      }
    });

    // Combine results from all platforms
    const allPosts: PostData[] = [
      ...redditResults.posts,
      ...twitterResults.posts,
      ...hnResults.posts,
      ...githubResults.posts,
      ...productHuntResults.posts,
      ...stackOverflowResults.posts
    ];
    const redditPosts = redditResults.posts.length;
    const twitterPosts = twitterResults.posts.length;
    const hackerNewsPosts = hnResults.posts.length;
    const githubPosts = githubResults.posts.length;
    const productHuntPosts = productHuntResults.posts.length;
    const stackOverflowPosts = stackOverflowResults.posts.length;
    const filteredOutPosts = redditResults.filtered + twitterResults.filtered + hnResults.filtered + githubResults.filtered + productHuntResults.filtered + stackOverflowResults.filtered;

    console.log(`Job ${jobId}: Parallel ingestion complete: ${allPosts.length} total posts (Reddit: ${redditPosts}, Twitter: ${twitterPosts}, HackerNews: ${hackerNewsPosts}, GitHub: ${githubPosts}, ProductHunt: ${productHuntPosts}, StackOverflow: ${stackOverflowPosts}, Filtered out: ${filteredOutPosts})`);

    // Remove duplicates based on platform + platform_post_id
    const uniquePosts = allPosts.filter((post, index, self) => 
      index === self.findIndex(p => p.platform === post.platform && p.platform_post_id === post.platform_post_id)
    );
    console.log(`Job ${jobId}: Unique posts after deduplication: ${uniquePosts.length}`);

    await updateJobStatus(jobId, {
      progress: {
        current_step: 'Inserting data into database',
        total_steps: 4,
        completed_steps: 3,
        platforms_status: {
          reddit: 'completed',
          twitter: 'completed',
          hackernews: 'completed',
          github: 'completed',
          producthunt: 'completed',
          stackoverflow: 'completed'
        }
      }
    });

    let insertedCount = 0;
    if (uniquePosts.length > 0) {
      // Insert in smaller batches
      const batchSize = 50;
      for (let i = 0; i < uniquePosts.length; i += batchSize) {
        const batch = uniquePosts.slice(i, i + batchSize);
        console.log(`Job ${jobId}: Inserting batch ${Math.floor(i/batchSize) + 1}, size: ${batch.length}`);
        const { error, count } = await supabase
          .from("posts")
          .upsert(batch, {
            onConflict: "platform,platform_post_id",
            ignoreDuplicates: true,
            count: 'exact'
          });

        if (error) {
          console.error(`Job ${jobId}: Upsert error:`, error);
          throw new Error(`Database upsert failed: ${error.message}`);
        }

        console.log(`Job ${jobId}: Batch inserted successfully, count: ${count}`);
        insertedCount += count || 0;
      }
    } else {
      console.log(`Job ${jobId}: No posts to insert`);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Get final Twitter quota usage for reporting
    let twitterQuotaInfo: any = null;
    if (TWITTER_BEARER_TOKEN) {
      try {
        const finalQuota = await getTwitterQuotaUsage(supabase);
        const limits = TWITTER_LIMITS[TWITTER_API_TIER as keyof typeof TWITTER_LIMITS];
        if (limits) {
          twitterQuotaInfo = {
            tier: TWITTER_API_TIER,
            daily_usage: `${finalQuota.daily}/${limits.daily_posts}`,
            monthly_usage: `${finalQuota.monthly}/${limits.monthly_posts}`,
            daily_remaining: Math.max(0, limits.daily_posts - finalQuota.daily),
            monthly_remaining: Math.max(0, limits.monthly_posts - finalQuota.monthly)
          };
        }
      } catch (error) {
        console.warn(`Job ${jobId}: Error getting final Twitter quota:`, error);
        twitterQuotaInfo = null;
      }
    }

    const result = {
      status: "success",
      duration_ms: duration,
      total_fetched: allPosts.length,
      reddit_posts: redditPosts,
      twitter_posts: twitterPosts,
      hackernews_posts: hackerNewsPosts,
      github_posts: githubPosts,
      producthunt_posts: productHuntPosts,
      stackoverflow_posts: stackOverflowPosts,
      filtered_out_posts: filteredOutPosts,
      unique_posts: uniquePosts.length,
      inserted: insertedCount,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        parallel_execution: true
      },
      platform_results: {
        reddit: { posts: redditPosts, filtered: redditResults.filtered },
        twitter: { posts: twitterPosts, filtered: twitterResults.filtered },
        hackernews: { posts: hackerNewsPosts, filtered: hnResults.filtered },
        github: { posts: githubPosts, filtered: githubResults.filtered },
        producthunt: { posts: productHuntPosts, filtered: productHuntResults.filtered },
        stackoverflow: { posts: stackOverflowPosts, filtered: stackOverflowResults.filtered }
      },
      twitter_quota: twitterQuotaInfo
    };

    await updateJobStatus(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: {
        current_step: 'Completed',
        total_steps: 4,
        completed_steps: 4,
        platforms_status: {
          reddit: 'completed',
          twitter: 'completed',
          hackernews: 'completed',
          github: 'completed',
          producthunt: 'completed',
          stackoverflow: 'completed'
        }
      },
      result
    });

    console.log(`Job ${jobId}: Enhanced Multi-Platform Ingest completed successfully:`, result);

  } catch (error) {
    console.error(`Job ${jobId}: Enhanced Multi-Platform Ingest error:`, error);
    
    await updateJobStatus(jobId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: String(error)
    });
  }
}

// MAIN FUNCTION
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const url = new URL(req.url);

  try {
    // Handle job trigger requests (POST only)
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Only POST requests are supported for triggering jobs. Use /functions/v1/job-status for status checking."
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    // Security checks
    const clientIP = getClientIP(req);
    console.log(`Request from IP: ${clientIP}`);
    
    // Check rate limiting
    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({
        error: "Rate limit exceeded. Maximum 5 requests per minute.",
        retryAfter: 60
      }), {
        status: 429,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
          "Retry-After": "60"
        }
      });
    }
    
    // Optional API key check
    if (INGEST_API_KEY) {
      const providedKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== INGEST_API_KEY) {
        console.warn(`Invalid API key from IP: ${clientIP}`);
        return new Response(JSON.stringify({
          error: "Invalid or missing API key"
        }), {
          status: 401,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json"
          }
        });
      }
    }
    
    // Validate URL parameters
    const paramValidation = validateParameters(url);
    if (!paramValidation.valid) {
      console.warn(`Invalid parameters from IP: ${clientIP} - ${paramValidation.error}`);
      return new Response(JSON.stringify({
        error: paramValidation.error
      }), {
        status: 400,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json"
        }
      });
    }

    // Create new job
    const jobId = generateJobId();
    const nowISO = new Date().toISOString();
    
    // Parse URL parameters for execution control (already validated)
    const extended = url.searchParams.get("extended") === "true";
    const maxSubreddits = Math.min(
      parseInt(url.searchParams.get("max_subreddits") || (extended ? "57" : "35")),
      MAX_SUBREDDITS
    );
    const maxPhrases = Math.min(
      parseInt(url.searchParams.get("max_phrases") || "12"),
      MAX_PHRASES
    );
    
    // Select subreddit list based on parameters
    const selectedSubreddits = (extended ? extendedSubreddits : subreddits).slice(0, maxSubreddits);
    const selectedPhrases = phrases.slice(0, maxPhrases);
    
    const jobParameters = {
      selectedSubreddits,
      selectedPhrases,
      extended,
      maxSubreddits,
      maxPhrases
    };

    // Create and store job
    const job: IngestJob = {
      id: jobId,
      status: 'pending',
      created_at: nowISO,
      parameters: jobParameters
    };
    
    await createJob(job);
    
    console.log(`Created job ${jobId} with parameters:`, {
      execution_mode: extended ? 'extended' : 'priority',
      subreddits: selectedSubreddits.length,
      phrases: selectedPhrases.length
    });

    // Start job execution in background (don't await)
    executeIngestJob(jobId, jobParameters).catch(error => {
      console.error(`Background job ${jobId} failed:`, error);
    });

    // Return immediately with job ID
    return new Response(JSON.stringify({
      status: "triggered",
      message: "Ingest job has been triggered successfully",
      job_id: jobId,
      created_at: nowISO,
      parameters: {
        execution_mode: extended ? 'extended' : 'priority',
        subreddits_count: selectedSubreddits.length,
        phrases_count: selectedPhrases.length,
        max_subreddits: maxSubreddits,
        max_phrases: maxPhrases
      },
      status_url: `${url.origin}/functions/v1/job-status?job_id=${jobId}`,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        async_execution: true
      }
    }), {
      status: 202, // Accepted
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Async ingest trigger error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: "Failed to trigger ingest job",
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
