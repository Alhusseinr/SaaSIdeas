// Podcast platform ingest function - Edge Function compatible
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

// Simple XML parser for RSS feeds (Edge Function compatible)
function parseRSSFeed(xmlText: string): any {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  
  const channel = doc.querySelector('channel');
  if (!channel) return null;

  const items = Array.from(channel.querySelectorAll('item'));
  
  return {
    title: channel.querySelector('title')?.textContent || 'Unknown Podcast',
    description: channel.querySelector('description')?.textContent || '',
    link: channel.querySelector('link')?.textContent || '',
    items: items.map(item => ({
      title: item.querySelector('title')?.textContent || 'Untitled Episode',
      description: cleanDescription(item.querySelector('description')?.textContent || ''),
      pubDate: item.querySelector('pubDate')?.textContent || new Date().toISOString(),
      link: item.querySelector('link')?.textContent || '',
      guid: item.querySelector('guid')?.textContent || `${Date.now()}-${Math.random()}`,
      author: item.querySelector('author')?.textContent || 
             channel.querySelector('author')?.textContent || 
             channel.querySelector('managingEditor')?.textContent || 'Unknown'
    }))
  };
}

function cleanDescription(description: string): string {
  return description
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 2000); // Limit length
}

function extractComplaintsFromText(title: string, description: string): Array<{
  text: string;
  confidence: number;
}> {
  const complaintPatterns = [
    /(?:hate|dislike|frustrated|annoying|terrible|awful|worst|broken|sucks) (?:about |with |when |how )?([^.!?]{10,100})/gi,
    /(?:problem|issue|challenge|struggle|difficulty) (?:with |in |of |when )?([^.!?]{10,100})/gi,
    /(?:wish|need|want|missing|lacking) (?:a |an |some |better |more )?([^.!?]{10,100})/gi,
    /(can't|cannot|unable to|impossible to) ([^.!?]{10,100})/gi,
    /(?:pain|headache|nightmare|disaster) (?:of |with |when )?([^.!?]{10,100})/gi,
  ];

  const complaints: Array<{ text: string; confidence: number }> = [];
  const fullText = `${title} ${description}`.toLowerCase();

  complaintPatterns.forEach(pattern => {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      if (match[0] && match[0].length > 15) {
        complaints.push({
          text: match[0].trim(),
          confidence: calculateComplaintConfidence(match[0]),
        });
      }
    }
  });

  return complaints
    .filter(c => c.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3); // Top 3 complaints per episode
}

function calculateComplaintConfidence(text: string): number {
  const negativeWords = ['hate', 'sucks', 'terrible', 'awful', 'broken', 'frustrated', 'annoying'];
  const problemWords = ['problem', 'issue', 'challenge', 'struggle', 'difficulty', 'pain'];
  const techKeywords = [
    'api', 'database', 'server', 'deployment', 'integration', 'automation',
    'workflow', 'dashboard', 'analytics', 'security', 'performance', 'scalability',
    'saas', 'software', 'tool', 'platform', 'service', 'management', 'monitoring',
    'collaboration', 'productivity', 'efficiency', 'process', 'system'
  ];
  
  let score = 0.1; // Base score
  
  negativeWords.forEach(word => {
    if (text.toLowerCase().includes(word)) score += 0.2;
  });
  
  problemWords.forEach(word => {
    if (text.toLowerCase().includes(word)) score += 0.15;
  });
  
  const techCount = techKeywords.filter(keyword => text.toLowerCase().includes(keyword)).length;
  score += techCount * 0.1;
  
  return Math.min(score, 1.0);
}

async function fetchPodcastContent(maxPosts: number = 40): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  const techPodcasts = [
    {
      name: 'Syntax - Tasty Web Development Treats',
      url: 'https://feeds.simplecast.com/LpAGSLnY',
    },
    {
      name: 'The Changelog',
      url: 'https://changelog.com/podcast/feed',
    },
    {
      name: 'Software Engineering Daily',
      url: 'https://softwareengineeringdaily.com/feed/podcast/',
    },
    {
      name: 'Indie Hackers Podcast',
      url: 'https://feeds.transistor.fm/indie-hackers-podcast',
    },
    {
      name: 'The SaaS Podcast',
      url: 'https://feeds.buzzsprout.com/1326340.rss',
    },
    {
      name: 'Developer Tea',
      url: 'https://feeds.simplecast.com/dLRotFGk',
    },
    {
      name: 'Full Stack Radio',
      url: 'https://feeds.simplecast.com/wjQvYtld',
    }
  ];

  try {
    console.log("Starting podcast RSS ingestion...");

    for (const podcast of techPodcasts.slice(0, 5)) { // Limit to avoid timeouts
      if (posts.length >= maxPosts) break;

      try {
        console.log(`Fetching podcast feed: ${podcast.name}`);
        
        const response = await fetch(podcast.url, {
          headers: {
            'User-Agent': 'SaaS-Ideas-Bot/1.0 (Educational Research)',
          },
        });

        if (!response.ok) {
          console.warn(`Failed to fetch ${podcast.name}: ${response.status}`);
          continue;
        }

        const xmlText = await response.text();
        const feed = parseRSSFeed(xmlText);
        
        if (!feed) {
          console.warn(`Invalid RSS feed for ${podcast.name}`);
          continue;
        }

        // Process recent episodes (last 5)
        const recentEpisodes = feed.items.slice(0, 5);
        
        for (const episode of recentEpisodes) {
          const complaints = extractComplaintsFromText(episode.title, episode.description);
          
          if (complaints.length === 0) {
            filteredCount++;
            continue;
          }

          // Create posts for each complaint found
          for (const [index, complaint] of complaints.entries()) {
            const episodeDate = new Date(episode.pubDate).toISOString();
            const postId = `${episode.guid}-complaint-${index}`;
            const hash = await makeHash("podcast", postId, complaint.text, episodeDate);

            posts.push({
              platform: "podcast",
              platform_post_id: postId,
              author: episode.author || null,
              url: episode.link || podcast.url,
              created_at: episodeDate,
              fetched_at: nowISO,
              title: `${podcast.name}: ${episode.title}`,
              body: complaint.text,
              hash: hash
            });

            if (posts.length >= maxPosts) break;
          }

          if (posts.length >= maxPosts) break;
          await sleep(500); // Rate limiting between episodes
        }

        await sleep(2000); // Rate limiting between podcasts
      } catch (error) {
        console.error(`Error processing podcast ${podcast.name}:`, error);
      }
    }

    console.log(`Podcast ingestion complete: ${posts.length} posts fetched, ${filteredCount} filtered`);
    return { posts, filtered: filteredCount };

  } catch (error) {
    console.error("Podcast ingestion failed:", error);
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
    const maxPosts = Math.min(body.max_posts || 40, 60);
    
    console.log(`Podcast: Processing up to ${maxPosts} posts`);

    const result = await fetchPodcastContent(maxPosts);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} podcast complaints, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "podcast",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Podcast platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "podcast",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});