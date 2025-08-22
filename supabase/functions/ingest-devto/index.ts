// Dev.to RSS ingestion - Developer pain points and tool requests
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

// Dev.to tags focused on developer pain points and tool needs
const DEVTO_TAGS = [
  'productivity', 'tools', 'workflow', 'debugging', 'testing',
  'devops', 'deployment', 'monitoring', 'automation', 'cicd',
  'docker', 'kubernetes', 'aws', 'cloud', 'database',
  'api', 'microservices', 'security', 'performance', 'startup',
  'indie', 'saas', 'beginners', 'help', 'career'
];

// Keywords indicating developer frustrations and tool needs
const OPPORTUNITY_KEYWORDS = [
  // Pain points
  'frustrating', 'annoying', 'hate', 'difficult', 'struggle',
  'confusing', 'complex', 'overwhelming', 'time consuming',
  
  // Tool requests
  'need a tool', 'looking for', 'recommend', 'alternative to',
  'better way', 'how to', 'wish there was', 'missing feature',
  
  // Problem indicators
  'problem with', 'issue with', 'doesn\'t work', 'broken',
  'slow', 'buggy', 'unreliable', 'pain point'
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

function isDeveloperOpportunity(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  
  // Look for developer pain points and tool requests
  return OPPORTUNITY_KEYWORDS.some(keyword => text.includes(keyword)) &&
         // Must be developer-focused (avoid generic content)
         (text.includes('dev') || text.includes('code') || text.includes('programming') ||
          text.includes('software') || text.includes('tool') || text.includes('api') ||
          text.includes('framework') || text.includes('library') || text.includes('database'));
}

async function fetchDevToRSS(tag?: string): Promise<PostData[]> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  
  try {
    const rssUrl = tag 
      ? `https://dev.to/feed/tag/${tag}`
      : `https://dev.to/feed`;
      
    console.log(`Fetching Dev.to RSS: ${rssUrl}`);
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'SaaS-Opportunity-Scanner/1.0'
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Dev.to RSS for ${tag || 'main'}: ${response.status}`);
      return posts;
    }
    
    const rssText = await response.text();
    
    // Parse RSS XML - basic parsing
    const items = rssText.split('<item>').slice(1);
    
    for (const item of items.slice(0, 15)) { // Limit to 15 items per tag
      try {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const authorMatch = item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/);
        const guidMatch = item.match(/<guid[^>]*>(.*?)<\/guid>/);
        
        if (!titleMatch || !linkMatch) continue;
        
        const title = titleMatch[1].trim();
        const url = linkMatch[1].trim();
        const description = descMatch ? descMatch[1].trim() : '';
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : nowISO;
        const author = authorMatch ? authorMatch[1].trim() : null;
        
        // Skip if not a developer opportunity
        if (!isDeveloperOpportunity(title, description)) continue;
        
        // Extract post ID from guid or URL
        let postId = '';
        if (guidMatch) {
          postId = guidMatch[1].split('/').pop()?.split('-').pop() || '';
        }
        if (!postId) {
          postId = url.split('/').pop()?.split('-').pop() || `devto_${Date.now()}`;
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
          .substring(0, 1000); // Limit length
        
        const hash = await makeHash("devto", postId, title + cleanDescription, createdAt);
        
        posts.push({
          platform: "devto",
          platform_post_id: postId,
          author: author,
          url: url,
          created_at: createdAt,
          fetched_at: nowISO,
          title: title,
          body: cleanDescription,
          hash: hash
        });
        
      } catch (itemError) {
        console.warn(`Error parsing Dev.to RSS item:`, itemError);
      }
    }
    
    console.log(`Found ${posts.length} developer opportunities from Dev.to${tag ? ` #${tag}` : ''}`);
    return posts;
    
  } catch (error) {
    console.error(`Error fetching Dev.to RSS${tag ? ` for ${tag}` : ''}:`, error);
    return posts;
  }
}

async function ingestDevToData(maxTags: number = 5): Promise<{
  posts: PostData[];
  filtered: number;
  completed: boolean;
}> {
  const allPosts: PostData[] = [];
  let filteredCount = 0;
  
  try {
    console.log(`Starting Dev.to ingestion for up to ${maxTags} tags...`);
    
    // First get main feed
    const mainPosts = await fetchDevToRSS();
    allPosts.push(...mainPosts);
    await sleep(1000);
    
    // Then process specific tags
    for (let i = 0; i < Math.min(maxTags - 1, DEVTO_TAGS.length); i++) {
      const tag = DEVTO_TAGS[i];
      
      const tagPosts = await fetchDevToRSS(tag);
      allPosts.push(...tagPosts);
      
      // Rate limiting
      await sleep(1500); // 1.5 seconds between requests
    }
    
    // Remove duplicates by URL
    const uniquePosts = allPosts.filter((post, index, arr) => 
      arr.findIndex(p => p.url === post.url) === index
    );
    
    console.log(`Dev.to ingestion complete: ${uniquePosts.length} unique developer opportunities`);
    
    return {
      posts: uniquePosts,
      filtered: filteredCount,
      completed: true
    };
    
  } catch (error) {
    console.error("Dev.to ingestion failed:", error);
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
    const maxTags = Math.min(body.max_tags || 5, 8); // Limit to 8 tags max

    console.log(`Dev.to: Processing up to ${maxTags} tags for developer opportunities`);

    const result = await ingestDevToData(maxTags);

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

      console.log(`Stored ${inserted} new Dev.to posts, ${duplicates} duplicates`);

      const duration = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          success: true,
          posts: result.posts.length,
          inserted: inserted,
          duplicates: duplicates,
          filtered: result.filtered,
          tags_processed: maxTags,
          message: `Successfully collected ${result.posts.length} developer opportunities from ${maxTags} Dev.to sources`,
          duration_ms: duration,
          platform_info: {
            name: "devto",
            version: "1.0.0",
            data_source: "RSS feeds",
            cost: "free",
            focus: "developer_tools_and_pain_points"
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
          message: "No developer opportunities found in current Dev.to sources",
          duration_ms: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Dev.to function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        posts: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "devto",
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