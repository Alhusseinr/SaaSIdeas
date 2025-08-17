// Twitter/X platform ingest function - simplified and self-contained for Edge Functions
const TWITTER_BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN");
const TWITTER_API_TIER = Deno.env.get("TWITTER_API_TIER") || "free";

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

async function makeHash(platform: string, postId: string, text: string, createdAt: string): Promise<string> {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const data = `${platform}:${postId}:${normalizedText.substring(0, 500)}:${createdAt}`;
  const buf = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isSoftwareFocused(text: string): boolean {
  const content = text.toLowerCase();
  
  // Complete physical product keywords from original
  const physicalKeywords = [
    'shipping', 'delivery', 'warehouse', 'inventory', 'manufacturing', 'factory',
    'physical product', 'printed', 'printing', 'packaging', 'retail store',
    'brick and mortar', 'restaurant', 'food', 'kitchen', 'clothing', 'apparel',
    'jewelry', 'furniture', 'hardware', 'device', 'gadget', 'machine',
    'equipment', 'vehicle', 'car', 'truck', 'real estate', 'property',
    'construction', 'building', 'plumbing', 'electrical', 'hvac',
    'cleaning service', 'lawn care', 'landscaping', 'moving', 'storage unit'
  ];
  
  if (physicalKeywords.some(keyword => content.includes(keyword))) {
    return false;
  }
  
  // Complete software keywords from original
  const softwareKeywords = [
    'app', 'software', 'platform', 'dashboard', 'api', 'saas', 'web',
    'mobile', 'automation', 'integration', 'analytics', 'tool',
    'system', 'service', 'online', 'digital', 'cloud', 'database',
    'algorithm', 'ai', 'machine learning', 'workflow', 'crm', 'cms'
  ];
  
  const hasUrlsOrTech = /\b(\.com|\.net|\.io|github|api|webhook|json|xml|sql|database|server|cloud|code|programming|developer|tech|digital)\b/i.test(content);
  const hasProductivityTerms = /\b(productivity|efficiency|automate|streamline|organize|manage|track|analyze|report|dashboard)\b/i.test(content);
  const hasBusinessTerms = /\b(crm|erp|saas|subscription|recurring|billing|invoice|payment|customer|client|user|account)\b/i.test(content);
  
  return softwareKeywords.some(keyword => content.includes(keyword)) || 
         (hasUrlsOrTech && hasProductivityTerms) || 
         (hasBusinessTerms && hasProductivityTerms);
}

async function fetchTwitterPosts(maxPosts: number = 20): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!TWITTER_BEARER_TOKEN) {
    throw new Error("Twitter Bearer Token not configured");
  }

  // Complete Twitter hashtags and accounts from original
  const twitterHashtags = [
    "#startup", "#SaaS", "#entrepreneur", "#smallbusiness", "#productivity",
    "#freelance", "#webdev", "#marketing", "#ecommerce", "#digitalnomad"
  ];

  const twitterAccounts = [
    "IndieHackers", "ProductHunt", "ycombinator", "VentureHacks", "Patio11",
    "paulg", "pmarca", "garyvee", "naval", "dhh"
  ];

  // Build queries using complete approach from original
  const complaintPhrases = ["frustrating", "annoying", "broken"];
  const queries = [];
  
  // Add phrase-based queries
  queries.push(...complaintPhrases.map(phrase => 
    `"${phrase}" (startup OR SaaS OR business OR entrepreneur OR freelance)`
  ));
  
  // Add hashtag searches if quota allows
  if (queries.length < 5) {
    queries.push(...twitterHashtags.slice(0, 2).map(tag => 
      `${tag} (frustrating OR annoying OR broken OR "doesn't work")`
    ));
  }

  const queryLimit = TWITTER_API_TIER === 'free' ? 1 : Math.min(queries.length, 3);
  
  for (const query of queries.slice(0, queryLimit)) {
    try {
      const url = new URL("https://api.twitter.com/2/tweets/search/recent");
      url.searchParams.set("query", `${query} -is:retweet lang:en`);
      url.searchParams.set("max_results", String(Math.min(maxPosts / queryLimit, 10)));
      url.searchParams.set("tweet.fields", "created_at,author_id");
      url.searchParams.set("user.fields", "username");
      url.searchParams.set("expansions", "author_id");

      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${TWITTER_BEARER_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        console.warn(`Twitter API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const tweets = data.data || [];
      const users = data.includes?.users || [];

      for (const tweet of tweets) {
        const tweetText = tweet.text || "";
        
        // Filter out non-software tweets
        if (!isSoftwareFocused(tweetText)) {
          filteredCount++;
          continue;
        }
        
        const author = users.find((u: any) => u.id === tweet.author_id);
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

      // Rate limiting based on tier
      const delayMs = TWITTER_API_TIER === 'free' ? 3000 : 1000;
      await sleep(delayMs);
      
    } catch (error) {
      console.error(`Error with Twitter query "${query}":`, error);
    }
  }

  console.log(`Twitter: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
  return { posts, filtered: filteredCount };
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
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        success: false,
        posts: [],
        filtered: 0,
        error: "Only POST requests are supported"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));
    const maxPosts = Math.min(body.max_posts || 20, 50);
    
    console.log(`Twitter: Processing up to ${maxPosts} posts with ${TWITTER_API_TIER} tier`);

    const result = await fetchTwitterPosts(maxPosts);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} Twitter posts, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "twitter",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Twitter platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "twitter",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});