// Twitch platform ingest function - Edge Function compatible
const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");
const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET");

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

async function getTwitchAccessToken(): Promise<string> {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID!,
      client_secret: TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error(`Twitch auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function twitchApiRequest(endpoint: string, accessToken: string, params: URLSearchParams = new URLSearchParams()): Promise<any> {
  const url = `https://api.twitch.tv/helix${endpoint}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID!,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Twitch API error: ${response.status}`);
  }

  return await response.json();
}

function isComplaintContent(title: string, description?: string): boolean {
  const content = `${title} ${description || ''}`.toLowerCase();
  
  const complaintPatterns = [
    /(struggling|stuck|can't|cannot|failing|broken|issues?|problems?|bugs?|crashes?)/i,
    /(hate|annoying|frustrating|terrible|awful|worst|painful)/i,
    /(help|fix|solve|debug|troubleshoot)/i,
    /(why (?:is|does|won't|can't|doesn't))/i,
  ];

  const techKeywords = [
    'code', 'api', 'database', 'server', 'deploy', 'git', 'npm', 'node',
    'react', 'javascript', 'python', 'docker', 'kubernetes', 'aws',
    'tool', 'framework', 'library', 'package', 'dependency', 'workflow'
  ];

  const hasComplaint = complaintPatterns.some(pattern => pattern.test(content));
  const hasTechContext = techKeywords.some(keyword => content.includes(keyword));
  
  return hasComplaint && hasTechContext;
}

async function fetchTwitchContent(maxPosts: number = 30): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Twitch credentials not configured");
  }

  const techCategories = [
    { name: 'Software and Game Development', id: '1469308723' },
    { name: 'Science & Technology', id: '509670' },
  ];

  const techStreamers = [
    'theprimeagen', 'teej_dv', 'bashbunni', 'DevChatter', 'noopkat',
    'CodeWithAntonio', 'tldraw', 'beginbot', 'MelkeyDev', 'codedamn'
  ];

  try {
    console.log("Getting Twitch access token...");
    const accessToken = await getTwitchAccessToken();
    console.log("Twitch token obtained successfully");

    // Get streams by category
    for (const category of techCategories) {
      try {
        const params = new URLSearchParams({
          game_id: category.id,
          first: '10',
          language: 'en',
        });

        const data = await twitchApiRequest('/streams', accessToken, params);
        const streams = data.data || [];

        for (const stream of streams) {
          if (isComplaintContent(stream.title)) {
            const createdISO = stream.started_at;
            const body = `${stream.user_name} streaming ${stream.game_name}: ${stream.title}`;
            const hash = await makeHash("twitch", stream.id, body, createdISO);

            posts.push({
              platform: "twitch",
              platform_post_id: stream.id,
              author: stream.user_name || null,
              url: `https://www.twitch.tv/${stream.user_login}`,
              created_at: createdISO,
              fetched_at: nowISO,
              title: `Twitch Stream: ${stream.title}`,
              body: body,
              hash: hash
            });
          } else {
            filteredCount++;
          }

          if (posts.length >= maxPosts) break;
        }

        if (posts.length >= maxPosts) break;
        await sleep(100); // Rate limiting
      } catch (error) {
        console.error(`Error fetching streams for category ${category.name}:`, error);
      }
    }

    // Get clips from tech streamers
    for (const streamer of techStreamers.slice(0, 5)) {
      if (posts.length >= maxPosts) break;

      try {
        // Get user ID first
        const userParams = new URLSearchParams({ login: streamer });
        const userData = await twitchApiRequest('/users', accessToken, userParams);
        
        if (!userData.data?.[0]) continue;
        const userId = userData.data[0].id;

        // Get clips for this user
        const clipParams = new URLSearchParams({
          broadcaster_id: userId,
          started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last week
          ended_at: new Date().toISOString(),
          first: '5',
        });

        const clipData = await twitchApiRequest('/clips', accessToken, clipParams);
        const clips = clipData.data || [];

        for (const clip of clips) {
          if (isComplaintContent(clip.title)) {
            const createdISO = clip.created_at;
            const body = `Clip from ${clip.broadcaster_name}: ${clip.title}`;
            const hash = await makeHash("twitch", `clip-${clip.id}`, body, createdISO);

            posts.push({
              platform: "twitch",
              platform_post_id: `clip-${clip.id}`,
              author: clip.broadcaster_name || null,
              url: clip.url,
              created_at: createdISO,
              fetched_at: nowISO,
              title: `Twitch Clip: ${clip.title}`,
              body: body,
              hash: hash
            });
          } else {
            filteredCount++;
          }

          if (posts.length >= maxPosts) break;
        }

        await sleep(500); // Rate limiting between streamers
      } catch (error) {
        console.error(`Error fetching clips for ${streamer}:`, error);
      }
    }

    console.log(`Twitch ingestion complete: ${posts.length} posts fetched, ${filteredCount} filtered`);
    return { posts, filtered: filteredCount };

  } catch (error) {
    console.error("Twitch ingestion failed:", error);
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
    const maxPosts = Math.min(body.max_posts || 30, 50);
    
    console.log(`Twitch: Processing up to ${maxPosts} posts`);

    const result = await fetchTwitchContent(maxPosts);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} Twitch content, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "twitch",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Twitch platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "twitch",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});