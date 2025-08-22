// Quora RSS ingestion - "Why doesn't X exist?" questions for SaaS opportunities
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

// SaaS-focused Quora topics that generate good opportunities
const QUORA_TOPICS = [
  'Software', 'Startups', 'Business-Software', 'Productivity',
  'Small-Business', 'Entrepreneurship', 'SaaS', 'Technology',
  'Web-Development', 'Mobile-Apps', 'Automation', 'Remote-Work',
  'Freelancing', 'E-commerce', 'Digital-Marketing', 'CRM'
];

// Keywords that indicate SaaS opportunities
const OPPORTUNITY_KEYWORDS = [
  'why doesn\'t', 'why isn\'t there', 'wish there was', 'need a tool',
  'looking for software', 'is there an app', 'missing feature',
  'would pay for', 'frustrating', 'manual process', 'time consuming'
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

function isSaaSOpportunity(title: string, description: string): boolean {
  const content = `${title} ${description}`.toLowerCase();
  
  // Look for opportunity signals
  return OPPORTUNITY_KEYWORDS.some(keyword => content.includes(keyword));
}

async function fetchQuoraRSS(topic: string): Promise<PostData[]> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  
  try {
    console.log(`Fetching Quora RSS for topic: ${topic}`);
    
    const rssUrl = `https://www.quora.com/topic/${topic}.rss`;
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'SaaS-Opportunity-Scanner/1.0'
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Quora RSS for ${topic}: ${response.status}`);
      return posts;
    }
    
    const rssText = await response.text();
    
    // Parse RSS XML - basic parsing for demonstration
    // In production, you'd use a proper XML parser
    const items = rssText.split('<item>').slice(1);
    
    for (const item of items) {
      try {
        // Extract basic RSS fields using regex (simplified approach)
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        
        if (!titleMatch || !linkMatch) continue;
        
        const title = titleMatch[1].trim();
        const url = linkMatch[1].trim();
        const description = descMatch ? descMatch[1].trim() : '';
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : nowISO;
        
        // Skip if not a SaaS opportunity
        if (!isSaaSOpportunity(title, description)) continue;
        
        // Create post ID from URL
        const postId = url.split('/').pop() || `quora_${Date.now()}`;
        
        // Parse date
        let createdAt = nowISO;
        try {
          createdAt = new Date(pubDate).toISOString();
        } catch {
          createdAt = nowISO;
        }
        
        const hash = await makeHash("quora", postId, title + description, createdAt);
        
        posts.push({
          platform: "quora",
          platform_post_id: postId,
          author: null, // RSS doesn't include author in basic format
          url: url,
          created_at: createdAt,
          fetched_at: nowISO,
          title: title,
          body: description,
          hash: hash
        });
        
      } catch (itemError) {
        console.warn(`Error parsing RSS item:`, itemError);
      }
    }
    
    console.log(`Found ${posts.length} SaaS opportunities from Quora topic ${topic}`);
    return posts;
    
  } catch (error) {
    console.error(`Error fetching Quora RSS for ${topic}:`, error);
    return posts;
  }
}

async function ingestQuoraData(maxTopics: number = 5): Promise<{
  posts: PostData[];
  filtered: number;
  completed: boolean;
}> {
  const allPosts: PostData[] = [];
  let filteredCount = 0;
  
  try {
    console.log(`Starting Quora ingestion for ${maxTopics} topics...`);
    
    // Process topics with rate limiting
    for (let i = 0; i < Math.min(maxTopics, QUORA_TOPICS.length); i++) {
      const topic = QUORA_TOPICS[i];
      
      const topicPosts = await fetchQuoraRSS(topic);
      allPosts.push(...topicPosts);
      
      // Rate limiting between topics
      if (i < maxTopics - 1) {
        await sleep(1000); // 1 second between topics
      }
    }
    
    console.log(`Quora ingestion complete: ${allPosts.length} posts collected from ${maxTopics} topics`);
    
    return {
      posts: allPosts,
      filtered: filteredCount,
      completed: true
    };
    
  } catch (error) {
    console.error("Quora ingestion failed:", error);
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
          filtered: 0,
          error: "Only POST requests are supported",
        }),
        {
          status: 405,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const maxTopics = Math.min(body.max_topics || 5, 10); // Limit to 10 topics max

    console.log(`Quora: Processing up to ${maxTopics} topics for SaaS opportunities`);

    const result = await ingestQuoraData(maxTopics);

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

      console.log(`Stored ${inserted} new Quora posts, ${duplicates} duplicates`);

      const duration = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          success: true,
          posts: result.posts.length,
          inserted: inserted,
          duplicates: duplicates,
          filtered: result.filtered,
          topics_processed: maxTopics,
          message: `Successfully collected ${result.posts.length} Quora SaaS opportunities from ${maxTopics} topics`,
          duration_ms: duration,
          platform_info: {
            name: "quora",
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
          filtered: result.filtered,
          message: "No SaaS opportunities found in current Quora topics",
          duration_ms: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Quora function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        posts: 0,
        filtered: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "quora",
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