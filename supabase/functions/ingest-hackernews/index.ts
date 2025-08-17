// Hacker News platform ingest function - simplified and self-contained for Edge Functions
const HN_API_BASE = "https://hacker-news.firebaseio.com/v0/";

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

function hasComplaintTerms(content: string): boolean {
  // Complete Hacker News search terms from original
  const complaintTerms = [
    "problem", "issue", "challenge", "difficult", "pain", "struggle",
    "why doesn't", "wish there was", "need a tool", "looking for", "need a solution",
    "anyone know", "alternatives to", "problems with", "issues with",
    "lacking", "missing", "gaps in", "shortcomings", "limitations",
    "inefficient", "cumbersome", "tedious", "time-consuming", "manual",
    "better way", "improve", "optimize", "solve", "fix"
  ];
  
  const lowerContent = content.toLowerCase();
  return complaintTerms.some(term => lowerContent.includes(term));
}

async function fetchHackerNewsPosts(maxStories: number = 30): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  try {
    console.log("Fetching latest Hacker News stories...");
    
    // Get latest story IDs
    const newStoriesResponse = await fetch(`${HN_API_BASE}newstories.json`);
    if (!newStoriesResponse.ok) {
      throw new Error("Failed to fetch HN new stories");
    }
    
    const storyIds = await newStoriesResponse.json();
    const recentStoryIds = storyIds.slice(0, maxStories);
    
    console.log(`Processing ${recentStoryIds.length} recent HN stories...`);
    
    // Fetch story details
    for (const storyId of recentStoryIds) {
      try {
        const storyResponse = await fetch(`${HN_API_BASE}item/${storyId}.json`);
        if (!storyResponse.ok) continue;
        
        const story = await storyResponse.json();
        if (!story || story.deleted || story.dead) continue;
        
        const title = story.title || "";
        const text = story.text || "";
        const storyContent = `${title} ${text}`;
        
        // Check if story contains complaint-related terms
        if (!hasComplaintTerms(storyContent)) {
          filteredCount++;
          continue;
        }
        
        // Filter out physical product mentions
        if (/\b(shipping|delivery|restaurant|food|clothing|furniture)\b/i.test(storyContent)) {
          filteredCount++;
          continue;
        }
        
        const createdAt = story.time ? new Date(story.time * 1000).toISOString() : nowISO;
        const hash = await makeHash("hackernews", String(story.id), storyContent, createdAt);
        
        posts.push({
          platform: "hackernews",
          platform_post_id: String(story.id),
          author: story.by || null,
          url: `https://news.ycombinator.com/item?id=${story.id}`,
          created_at: createdAt,
          fetched_at: nowISO,
          title: title || null,
          body: text || title,
          hash: hash
        });
        
        // Check top comments for additional complaints
        if (story.kids && story.kids.length > 0 && posts.length < maxStories) {
          const topComments = story.kids.slice(0, 2); // Only check first 2 comments
          
          for (const commentId of topComments) {
            try {
              await sleep(50);
              const commentResponse = await fetch(`${HN_API_BASE}item/${commentId}.json`);
              if (!commentResponse.ok) continue;
              
              const comment = await commentResponse.json();
              if (!comment || comment.deleted || comment.dead || !comment.text) continue;
              
              const commentText = comment.text;
              
              if (hasComplaintTerms(commentText) && 
                  !/\b(shipping|delivery|restaurant|food)\b/i.test(commentText)) {
                
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
        
        await sleep(100); // Be respectful to HN API
        
      } catch (error) {
        console.error(`Error fetching HN story ${storyId}:`, error);
      }
    }
    
    console.log(`HN: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Error fetching Hacker News posts:", error);
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
    const maxStories = Math.min(body.max_stories || 30, 50);
    
    console.log(`Hacker News: Processing up to ${maxStories} stories`);

    const result = await fetchHackerNewsPosts(maxStories);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} Hacker News posts, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "hackernews",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Hacker News platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "hackernews",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});