// Indie Hackers RSS ingestion - Direct entrepreneur problems and SaaS opportunities
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

// Indie Hackers RSS endpoints - they have different sections
const INDIEHACKERS_FEEDS = [
  { url: 'https://www.indiehackers.com/feed.xml', name: 'main' },
  { url: 'https://www.indiehackers.com/posts/newest.rss', name: 'newest' },
  // Note: Some feeds may require checking their actual RSS structure
];

// Keywords indicating entrepreneur problems and SaaS opportunities
const ENTREPRENEUR_KEYWORDS = [
  // Direct problems
  'struggling with', 'problem with', 'challenge', 'difficulty', 
  'frustrating', 'annoying', 'hate', 'broken', 'doesn\'t work',
  
  // Tool/solution needs
  'need a tool', 'looking for', 'search for', 'recommend', 
  'alternative to', 'better than', 'wish there was', 'missing',
  
  // Business pain points
  'time consuming', 'manual', 'tedious', 'inefficient', 'complex',
  'overwhelming', 'expensive', 'lack of', 'no good solution',
  
  // Opportunity signals
  'market gap', 'would pay for', 'should exist', 'opportunity',
  'build this', 'create a', 'startup idea', 'business idea',
  
  // Business contexts
  'revenue', 'customers', 'users', 'growth', 'marketing', 'sales',
  'analytics', 'conversion', 'automation', 'workflow', 'productivity'
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

function isEntrepreneurOpportunity(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  
  // Must have entrepreneur/business context indicators
  const hasBusinessContext = text.includes('business') || text.includes('startup') ||
                             text.includes('entrepreneur') || text.includes('saas') ||
                             text.includes('revenue') || text.includes('customers') ||
                             text.includes('marketing') || text.includes('growth') ||
                             text.includes('product') || text.includes('indie');
  
  // Must have opportunity/problem signals
  const hasOpportunitySignal = ENTREPRENEUR_KEYWORDS.some(keyword => text.includes(keyword));
  
  return hasBusinessContext && hasOpportunitySignal;
}

async function fetchIndieHackersRSS(feed: { url: string; name: string }): Promise<PostData[]> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  
  try {
    console.log(`Fetching Indie Hackers RSS: ${feed.name} (${feed.url})`);
    
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'SaaS-Opportunity-Scanner/1.0'
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Indie Hackers RSS ${feed.name}: ${response.status}`);
      return posts;
    }
    
    const rssText = await response.text();
    
    // Parse RSS XML - Handle both standard RSS and Atom feeds
    let items: string[] = [];
    if (rssText.includes('<item>')) {
      items = rssText.split('<item>').slice(1);
    } else if (rssText.includes('<entry>')) {
      items = rssText.split('<entry>').slice(1);
    }
    
    for (const item of items.slice(0, 25)) { // Limit to 25 items per feed
      try {
        let title = '', url = '', description = '', pubDate = nowISO, author = null;
        
        // Handle RSS format
        const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s);
        const linkMatch = item.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/) || 
                          item.match(/<link[^>]*href=['"]([^'"]+)['"]/);
        const descMatch = item.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s) ||
                          item.match(/<content[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/content>/s) ||
                          item.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/s);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/) ||
                             item.match(/<published>(.*?)<\/published>/) ||
                             item.match(/<updated>(.*?)<\/updated>/);
        const authorMatch = item.match(/<dc:creator[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/dc:creator>/) ||
                           item.match(/<author[^>]*><name>(.*?)<\/name><\/author>/);
        
        if (titleMatch) title = titleMatch[1].trim();
        if (linkMatch) url = (linkMatch[1] || linkMatch[2] || '').trim();
        if (descMatch) description = descMatch[1].trim();
        if (pubDateMatch) pubDate = pubDateMatch[1].trim();
        if (authorMatch) author = authorMatch[1].trim();
        
        if (!title || !url) continue;
        
        // Skip if not an entrepreneur opportunity
        if (!isEntrepreneurOpportunity(title, description)) continue;
        
        // Extract post ID from URL
        let postId = '';
        const urlMatch = url.match(/\/post\/([^\/]+)/) || url.match(/\/([^\/]+)\/?$/);
        if (urlMatch) {
          postId = urlMatch[1];
        } else {
          postId = url.split('/').filter(Boolean).pop() || `ih_${Date.now()}`;
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
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
          .substring(0, 1200); // Limit length
        
        const hash = await makeHash("indiehackers", postId, title + cleanDescription, createdAt);
        
        posts.push({
          platform: "indiehackers",
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
        console.warn(`Error parsing Indie Hackers RSS item:`, itemError);
      }
    }
    
    console.log(`Found ${posts.length} entrepreneur opportunities from Indie Hackers ${feed.name}`);
    return posts;
    
  } catch (error) {
    console.error(`Error fetching Indie Hackers RSS ${feed.name}:`, error);
    return posts;
  }
}

async function ingestIndieHackersData(maxFeeds: number = 2): Promise<{
  posts: PostData[];
  filtered: number;
  completed: boolean;
}> {
  const allPosts: PostData[] = [];
  let filteredCount = 0;
  
  try {
    console.log(`Starting Indie Hackers ingestion for up to ${maxFeeds} feeds...`);
    
    // Process feeds with rate limiting
    for (let i = 0; i < Math.min(maxFeeds, INDIEHACKERS_FEEDS.length); i++) {
      const feed = INDIEHACKERS_FEEDS[i];
      
      const feedPosts = await fetchIndieHackersRSS(feed);
      allPosts.push(...feedPosts);
      
      // Rate limiting between feeds
      if (i < maxFeeds - 1) {
        await sleep(2500); // 2.5 seconds between feeds
      }
    }
    
    // Remove duplicates by URL
    const uniquePosts = allPosts.filter((post, index, arr) => 
      arr.findIndex(p => p.url === post.url) === index
    );
    
    console.log(`Indie Hackers ingestion complete: ${uniquePosts.length} unique entrepreneur opportunities from ${maxFeeds} feeds`);
    
    return {
      posts: uniquePosts,
      filtered: filteredCount,
      completed: true
    };
    
  } catch (error) {
    console.error("Indie Hackers ingestion failed:", error);
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
    const maxFeeds = Math.min(body.max_feeds || 2, 3); // Limit to 3 feeds max

    console.log(`Indie Hackers: Processing up to ${maxFeeds} feeds for entrepreneur opportunities`);

    const result = await ingestIndieHackersData(maxFeeds);

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

      console.log(`Stored ${inserted} new Indie Hackers posts, ${duplicates} duplicates`);

      const duration = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          success: true,
          posts: result.posts.length,
          inserted: inserted,
          duplicates: duplicates,
          filtered: result.filtered,
          feeds_processed: maxFeeds,
          message: `Successfully collected ${result.posts.length} entrepreneur opportunities from ${maxFeeds} Indie Hackers feeds`,
          duration_ms: duration,
          platform_info: {
            name: "indiehackers",
            version: "1.0.0",
            data_source: "RSS feeds",
            cost: "free",
            focus: "entrepreneur_problems_and_business_opportunities"
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
          message: "No entrepreneur opportunities found in current Indie Hackers feeds",
          duration_ms: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Indie Hackers function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        posts: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "indiehackers",
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