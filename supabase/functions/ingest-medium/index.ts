// Medium RSS ingestion - Technical problem discussions for SaaS opportunities
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

// Medium tags focused on SaaS opportunities and technical problems
const MEDIUM_TAGS = [
  'software-development', 'startup', 'productivity', 'saas',
  'entrepreneurship', 'business-strategy', 'remote-work', 'freelancing',
  'web-development', 'mobile-development', 'automation', 'no-code',
  'api', 'microservices', 'developer-tools', 'workflow'
];

// Additional high-value Medium publications
const MEDIUM_PUBLICATIONS = [
  '@hackernoon', '@towardsdatascience', '@freecodecamp', 
  '@the-startup', '@better-programming', '@javascript-scene'
];

// Keywords indicating SaaS opportunities
const OPPORTUNITY_KEYWORDS = [
  'problem with', 'frustrating', 'inefficient', 'manual process',
  'wish there was', 'need a better', 'looking for a tool',
  'building a solution', 'solving the problem', 'pain point'
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

function isSaaSOpportunity(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  
  // Look for technical problems and solution discussions
  return OPPORTUNITY_KEYWORDS.some(keyword => text.includes(keyword)) ||
         text.includes('startup') && (text.includes('problem') || text.includes('solution'));
}

async function fetchMediumRSS(source: string, isTag: boolean = true): Promise<PostData[]> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  
  try {
    const rssUrl = isTag 
      ? `https://medium.com/feed/tag/${source}`
      : `https://medium.com/feed/${source}`;
      
    console.log(`Fetching Medium RSS: ${rssUrl}`);
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'SaaS-Opportunity-Scanner/1.0'
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Medium RSS for ${source}: ${response.status}`);
      return posts;
    }
    
    const rssText = await response.text();
    
    // Parse RSS XML - basic parsing
    const items = rssText.split('<item>').slice(1);
    
    for (const item of items.slice(0, 10)) { // Limit to 10 items per source
      try {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const contentMatch = item.match(/<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const authorMatch = item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/);
        
        if (!titleMatch || !linkMatch) continue;
        
        const title = titleMatch[1].trim();
        const url = linkMatch[1].trim();
        const content = contentMatch ? contentMatch[1].trim() : '';
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : nowISO;
        const author = authorMatch ? authorMatch[1].trim() : null;
        
        // Skip if not a SaaS opportunity
        if (!isSaaSOpportunity(title, content)) continue;
        
        // Extract post ID from URL
        const postId = url.split('-').pop()?.split('?')[0] || `medium_${Date.now()}`;
        
        // Parse date
        let createdAt = nowISO;
        try {
          createdAt = new Date(pubDate).toISOString();
        } catch {
          createdAt = nowISO;
        }
        
        // Clean content (remove HTML tags for body text)
        const cleanContent = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&[^;]+;/g, ' ') // Remove HTML entities
          .trim()
          .substring(0, 1000); // Limit length
        
        const hash = await makeHash("medium", postId, title + cleanContent, createdAt);
        
        posts.push({
          platform: "medium",
          platform_post_id: postId,
          author: author,
          url: url,
          created_at: createdAt,
          fetched_at: nowISO,
          title: title,
          body: cleanContent,
          hash: hash
        });
        
      } catch (itemError) {
        console.warn(`Error parsing Medium RSS item:`, itemError);
      }
    }
    
    console.log(`Found ${posts.length} SaaS opportunities from Medium source: ${source}`);
    return posts;
    
  } catch (error) {
    console.error(`Error fetching Medium RSS for ${source}:`, error);
    return posts;
  }
}

async function ingestMediumData(maxSources: number = 5): Promise<{
  posts: PostData[];
  filtered: number;
  completed: boolean;
}> {
  const allPosts: PostData[] = [];
  let filteredCount = 0;
  let sourcesProcessed = 0;
  
  try {
    console.log(`Starting Medium ingestion for up to ${maxSources} sources...`);
    
    // Process tags first
    for (const tag of MEDIUM_TAGS) {
      if (sourcesProcessed >= maxSources) break;
      
      const tagPosts = await fetchMediumRSS(tag, true);
      allPosts.push(...tagPosts);
      sourcesProcessed++;
      
      // Rate limiting
      await sleep(1500); // 1.5 seconds between requests
    }
    
    // Then process publications if we have room
    for (const publication of MEDIUM_PUBLICATIONS) {
      if (sourcesProcessed >= maxSources) break;
      
      const pubPosts = await fetchMediumRSS(publication, false);
      allPosts.push(...pubPosts);
      sourcesProcessed++;
      
      // Rate limiting
      await sleep(1500);
    }
    
    // Remove duplicates by URL
    const uniquePosts = allPosts.filter((post, index, arr) => 
      arr.findIndex(p => p.url === post.url) === index
    );
    
    console.log(`Medium ingestion complete: ${uniquePosts.length} unique posts from ${sourcesProcessed} sources`);
    
    return {
      posts: uniquePosts,
      filtered: filteredCount,
      completed: true
    };
    
  } catch (error) {
    console.error("Medium ingestion failed:", error);
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
    const maxSources = Math.min(body.max_sources || 5, 8); // Limit to 8 sources max

    console.log(`Medium: Processing up to ${maxSources} sources for SaaS opportunities`);

    const result = await ingestMediumData(maxSources);

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

      console.log(`Stored ${inserted} new Medium posts, ${duplicates} duplicates`);

      const duration = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          success: true,
          posts: result.posts.length,
          inserted: inserted,
          duplicates: duplicates,
          filtered: result.filtered,
          sources_processed: maxSources,
          message: `Successfully collected ${result.posts.length} Medium SaaS opportunities from ${maxSources} sources`,
          duration_ms: duration,
          platform_info: {
            name: "medium",
            version: "1.0.0",
            data_source: "RSS feeds",
            cost: "free"
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
          message: "No SaaS opportunities found in current Medium sources",
          duration_ms: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Medium function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        posts: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "medium",
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