// YouTube platform ingest function - Edge Function compatible
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

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

function isComplaintComment(comment: string): boolean {
  const text = comment.toLowerCase();
  const complaintKeywords = [
    'hate', 'sucks', 'terrible', 'awful', 'worst', 'broken', 'bug', 'issue',
    'problem', 'frustrating', 'annoying', 'difficult', 'complicated', 'confusing',
    'slow', 'crash', 'error', 'fail', 'disappointed', 'waste', 'useless',
    'nightmare', 'pain', 'struggle', 'stuck', 'help', 'fix', 'solution'
  ];

  const techKeywords = [
    'software', 'app', 'tool', 'platform', 'service', 'api', 'saas',
    'productivity', 'workflow', 'automation', 'integration', 'dashboard'
  ];

  const hasComplaint = complaintKeywords.some(keyword => text.includes(keyword));
  const hasTechContext = techKeywords.some(keyword => text.includes(keyword));
  
  return hasComplaint && hasTechContext && comment.length > 20;
}

async function fetchYouTubeComments(maxPosts: number = 50): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  const baseUrl = 'https://www.googleapis.com/youtube/v3';
  const techQueries = [
    'SaaS tutorial problems',
    'software development frustration',
    'productivity tools review',
    'project management issues',
    'API integration problems',
    'developer tools comparison',
    'startup tech stack',
    'business automation challenges',
    'team collaboration tools',
    'workflow optimization'
  ];

  try {
    console.log("Starting YouTube comment ingestion...");

    for (const query of techQueries.slice(0, 5)) { // Limit queries to avoid quota issues
      try {
        // Search for videos
        const searchUrl = `${baseUrl}/search`;
        const searchParams = new URLSearchParams({
          part: 'snippet',
          q: query,
          type: 'video',
          order: 'relevance',
          maxResults: '5',
          key: YOUTUBE_API_KEY,
          publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const searchResponse = await fetch(`${searchUrl}?${searchParams}`);
        if (!searchResponse.ok) {
          console.warn(`YouTube search failed for "${query}": ${searchResponse.status}`);
          continue;
        }

        const searchData = await searchResponse.json();
        const videos = searchData.items || [];

        for (const video of videos) {
          try {
            // Get comments for this video
            const commentsUrl = `${baseUrl}/commentThreads`;
            const commentParams = new URLSearchParams({
              part: 'snippet,replies',
              videoId: video.id.videoId,
              order: 'relevance',
              maxResults: '20',
              key: YOUTUBE_API_KEY,
            });

            const commentsResponse = await fetch(`${commentsUrl}?${commentParams}`);
            if (!commentsResponse.ok) {
              console.warn(`Comments failed for video ${video.id.videoId}: ${commentsResponse.status}`);
              continue;
            }

            const commentsData = await commentsResponse.json();
            const commentThreads = commentsData.items || [];

            for (const thread of commentThreads) {
              const topComment = thread.snippet.topLevelComment.snippet;
              
              // Check main comment
              if (isComplaintComment(topComment.textDisplay)) {
                const createdISO = topComment.publishedAt;
                const body = topComment.textDisplay;
                const hash = await makeHash("youtube", topComment.id || thread.id, body, createdISO);

                posts.push({
                  platform: "youtube",
                  platform_post_id: topComment.id || thread.id,
                  author: topComment.authorDisplayName || null,
                  url: `https://www.youtube.com/watch?v=${video.id.videoId}&lc=${topComment.id || thread.id}`,
                  created_at: createdISO,
                  fetched_at: nowISO,
                  title: `Comment on: ${video.snippet.title}`,
                  body: body,
                  hash: hash
                });
              } else {
                filteredCount++;
              }

              // Check replies if any
              if (thread.replies?.comments) {
                for (const reply of thread.replies.comments) {
                  if (isComplaintComment(reply.snippet.textDisplay)) {
                    const createdISO = reply.snippet.publishedAt;
                    const body = reply.snippet.textDisplay;
                    const hash = await makeHash("youtube", reply.id, body, createdISO);

                    posts.push({
                      platform: "youtube",
                      platform_post_id: reply.id,
                      author: reply.snippet.authorDisplayName || null,
                      url: `https://www.youtube.com/watch?v=${video.id.videoId}&lc=${reply.id}`,
                      created_at: createdISO,
                      fetched_at: nowISO,
                      title: `Reply on: ${video.snippet.title}`,
                      body: body,
                      hash: hash
                    });
                  } else {
                    filteredCount++;
                  }
                }
              }

              if (posts.length >= maxPosts) break;
            }

            if (posts.length >= maxPosts) break;
            await sleep(1000); // Rate limiting between videos
          } catch (error) {
            console.error(`Error processing video ${video.id.videoId}:`, error);
          }
        }

        if (posts.length >= maxPosts) break;
        await sleep(2000); // Rate limiting between queries
      } catch (error) {
        console.error(`Error processing query "${query}":`, error);
      }
    }

    console.log(`YouTube ingestion complete: ${posts.length} posts fetched, ${filteredCount} filtered`);
    return { posts, filtered: filteredCount };

  } catch (error) {
    console.error("YouTube ingestion failed:", error);
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
    const maxPosts = Math.min(body.max_posts || 50, 100);
    
    console.log(`YouTube: Processing up to ${maxPosts} posts`);

    const result = await fetchYouTubeComments(maxPosts);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} YouTube comments, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "youtube",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("YouTube platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "youtube",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});