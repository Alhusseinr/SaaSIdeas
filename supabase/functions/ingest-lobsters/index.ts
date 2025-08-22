// Lobsters (lobste.rs) RSS ingestion - High-quality tech community discussions
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

// Lobsters RSS endpoints - they have different feeds
const LOBSTERS_FEEDS = [
  { url: 'https://lobste.rs/rss', name: 'main' },
  { url: 'https://lobste.rs/t/web.rss', name: 'web' },
  { url: 'https://lobste.rs/t/programming.rss', name: 'programming' },
  { url: 'https://lobste.rs/t/security.rss', name: 'security' },
  { url: 'https://lobste.rs/t/devops.rss', name: 'devops' },
  { url: 'https://lobste.rs/t/databases.rss', name: 'databases' },
  { url: 'https://lobste.rs/t/mobile.rss', name: 'mobile' }
];

// Keywords indicating SaaS opportunities in tech discussions
const OPPORTUNITY_KEYWORDS = [
  // Problem expressions
  'problem with', 'issue with', 'broken', 'doesn\'t work', 'buggy',
  'slow', 'inefficient', 'frustrating', 'annoying', 'hate',
  
  // Tool/solution needs  
  'need a tool', 'looking for', 'alternative to', 'better than',
  'wish there was', 'missing', 'lack of', 'no good',
  
  // Pain points
  'difficult', 'hard to', 'complex', 'confusing', 'overwhelming',
  'time consuming', 'manual', 'repetitive', 'tedious',
  
  // Opportunity signals
  'should exist', 'would pay for', 'market gap', 'opportunity'
];

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

function isTechOpportunity(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  
  // Must have opportunity signals
  const hasOpportunityKeyword = OPPORTUNITY_KEYWORDS.some(keyword => text.includes(keyword));
  
  // Must be tech-related (Lobsters is already tech-focused but let's be specific)
  const isTechRelated = text.includes('software') || text.includes('tool') || 
                        text.includes('app') || text.includes('api') || 
                        text.includes('service') || text.includes('platform') ||
                        text.includes('dev') || text.includes('programming') ||
                        text.includes('database') || text.includes('web');
  
  return hasOpportunityKeyword && isTechRelated;
}

async function fetchLobstersRSS(feed: { url: string; name: string }): Promise<PostData[]> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  
  try {
    console.log(`Fetching Lobsters RSS: ${feed.name} (${feed.url})`);
    
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'SaaS-Opportunity-Scanner/1.0'
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Lobsters RSS ${feed.name}: ${response.status}`);
      return posts;
    }
    
    const rssText = await response.text();
    
    // Parse RSS XML - Lobsters uses standard RSS format
    const items = rssText.split('<item>').slice(1);
    
    for (const item of items.slice(0, 20)) { // Limit to 20 items per feed
      try {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const guidMatch = item.match(/<guid[^>]*>(.*?)<\/guid>/);
        
        if (!titleMatch || !linkMatch) continue;
        
        const title = titleMatch[1].trim();
        const url = linkMatch[1].trim();
        const description = descMatch ? descMatch[1].trim() : '';
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : nowISO;
        
        // Skip if not a tech opportunity
        if (!isTechOpportunity(title, description)) continue;
        
        // Extract post ID from URL (Lobsters URLs are like https://lobste.rs/s/abc123/title)
        let postId = '';
        const urlMatch = url.match(/\/s\/([^\/]+)\//);
        if (urlMatch) {
          postId = urlMatch[1];
        } else {
          postId = url.split('/').pop() || `lobsters_${Date.now()}`;
        }
        
        // Parse date
        let createdAt = nowISO;
        try {
          createdAt = new Date(pubDate).toISOString();
        } catch {
          createdAt = nowISO;
        }
        
        // Clean description (remove HTML tags)
        const cleanDescription = description
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&[^;]+;/g, ' ') // Remove HTML entities
          .trim()
          .substring(0, 800); // Limit length
        
        const hash = await makeHash("lobsters", postId, title + cleanDescription, createdAt);
        
        posts.push({
          platform: "lobsters",
          platform_post_id: postId,
          author: null, // Lobsters RSS doesn't include author in basic format
          url: url,
          created_at: createdAt,
          fetched_at: nowISO,
          title: title,
          body: cleanDescription,
          hash: hash
        });
        
      } catch (itemError) {
        console.warn(`Error parsing Lobsters RSS item:`, itemError);
      }
    }
    
    console.log(`Found ${posts.length} tech opportunities from Lobsters ${feed.name}`);
    return posts;
    
  } catch (error) {
    console.error(`Error fetching Lobsters RSS ${feed.name}:`, error);
    return posts;
  }
}

async function ingestLobstersData(maxFeeds: number = 4): Promise<{
  posts: PostData[];
  filtered: number;
  completed: boolean;
}> {
  const allPosts: PostData[] = [];
  let filteredCount = 0;
  
  try {
    console.log(`Starting Lobsters ingestion for up to ${maxFeeds} feeds...`);
    
    // Process feeds with rate limiting
    for (let i = 0; i < Math.min(maxFeeds, LOBSTERS_FEEDS.length); i++) {
      const feed = LOBSTERS_FEEDS[i];
      
      const feedPosts = await fetchLobstersRSS(feed);
      allPosts.push(...feedPosts);
      
      // Rate limiting between feeds
      if (i < maxFeeds - 1) {
        await sleep(2000); // 2 seconds between feeds
      }
    }
    
    // Remove duplicates by URL
    const uniquePosts = allPosts.filter((post, index, arr) => 
      arr.findIndex(p => p.url === post.url) === index
    );
    
    console.log(`Lobsters ingestion complete: ${uniquePosts.length} unique tech opportunities from ${maxFeeds} feeds`);
    
    return {
      posts: uniquePosts,
      filtered: filteredCount,
      completed: true
    };
    
  } catch (error) {
    console.error("Lobsters ingestion failed:", error);
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
          error: "Only POST requests are supported",
        }),
        {
          status: 405,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const maxFeeds = Math.min(body.max_feeds || 4, 6); // Limit to 6 feeds max

    console.log(`Lobsters: Processing up to ${maxFeeds} feeds for tech opportunities`);

    const result = await ingestLobstersData(maxFeeds);

    // Store posts in database
    if (result.posts.length > 0) {
      const { data, error } = await supabase
        .from("posts")
        .upsert(result.posts, {
          onConflict: "platform,platform_post_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        console.error("Database storage error:", error);
        throw error;
      }

      const inserted = data?.length || 0;
      const duplicates = result.posts.length - inserted;

      console.log(`Stored ${inserted} new Lobsters posts, ${duplicates} duplicates`);

      const duration = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          success: true,
          posts: result.posts.length,
          inserted: inserted,
          duplicates: duplicates,
          filtered: result.filtered,
          feeds_processed: maxFeeds,
          message: `Successfully collected ${result.posts.length} tech opportunities from ${maxFeeds} Lobsters feeds`,
          duration_ms: duration,
          platform_info: {
            name: "lobsters",
            version: "1.0.0",
            data_source: "RSS feeds",
            cost: "free",
            focus: "high_quality_tech_discussions"
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          posts: 0,
          inserted: 0,
          duplicates: 0,
          message: "No tech opportunities found in current Lobsters feeds",
          duration_ms: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Lobsters function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        posts: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "lobsters",
          version: "1.0.0"
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});