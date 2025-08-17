// Product Hunt platform ingest function - simplified and self-contained for Edge Functions
const PRODUCT_HUNT_TOKEN = Deno.env.get("PRODUCT_HUNT_TOKEN");
const PRODUCT_HUNT_API_BASE = "https://api.producthunt.com/v2/api/graphql";

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

function hasProblemContext(content: string): boolean {
  // Complete Product Hunt search terms from original
  const problemTerms = [
    "missing", "lacking", "wish", "need", "should have", "would be great",
    "annoying", "frustrating", "difficult", "confusing", "complicated",
    "broken", "buggy", "slow", "clunky", "hard to use", "unintuitive",
    "disappointed", "expected", "hoping for", "looking for", "alternative",
    "better", "improve", "enhancement", "feature request", "suggestion",
    "problem", "issue", "complaint", "feedback", "criticism",
    "solves", "fixes", "alternative", "replaces", "improves"
  ];
  
  const lowerContent = content.toLowerCase();
  return problemTerms.some(term => lowerContent.includes(term));
}

async function fetchProductHuntPosts(maxPosts: number = 15): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!PRODUCT_HUNT_TOKEN) {
    throw new Error("Product Hunt token not configured");
  }

  try {
    console.log("Fetching Product Hunt posts...");

    // Simple GraphQL query to avoid complexity limits
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
        "User-Agent": "complaint-scanner/0.1"
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Product Hunt API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`Product Hunt GraphQL errors: ${JSON.stringify(data.errors)}`);
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
        
        const postContent = `${postName} ${postTagline} ${postDescription}`;
        
        // Look for posts that mention problems, solutions, or alternatives
        if (!hasProblemContext(postContent)) {
          filteredCount++;
          continue;
        }

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
        
        await sleep(100); // Be respectful
        
      } catch (postError) {
        console.error(`Error processing Product Hunt post:`, postError);
      }
    }
    
    console.log(`Product Hunt: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Error fetching Product Hunt posts:", error);
    throw error;
  }
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
    const maxPosts = Math.min(body.max_posts || 15, 25); // Keep low for GraphQL limits
    
    console.log(`Product Hunt: Processing up to ${maxPosts} posts`);

    const result = await fetchProductHuntPosts(maxPosts);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} Product Hunt posts, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "producthunt",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Product Hunt platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "producthunt",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});