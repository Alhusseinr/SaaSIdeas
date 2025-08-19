// Notion platform ingest function - Edge Function compatible
const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");

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

async function notionRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `https://api.notion.com/v1${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Notion API error: ${response.status}`);
  }

  return await response.json();
}

function extractPageTitle(page: any): string {
  if (page.properties?.Name?.title?.[0]?.plain_text) {
    return page.properties.Name.title[0].plain_text;
  }
  if (page.properties?.Title?.title?.[0]?.plain_text) {
    return page.properties.Title.title[0].plain_text;
  }
  // Try to get title from any title property
  for (const prop of Object.values(page.properties || {})) {
    if ((prop as any)?.title?.[0]?.plain_text) {
      return (prop as any).title[0].plain_text;
    }
  }
  return 'Untitled';
}

function extractBlockText(block: any): string {
  const textTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'quote'];
  
  for (const type of textTypes) {
    if (block.type === type && block[type]?.rich_text) {
      return block[type].rich_text.map((text: any) => text.plain_text || '').join('');
    }
  }
  
  return '';
}

async function getPageContent(pageId: string): Promise<string> {
  try {
    const response = await notionRequest(`/blocks/${pageId}/children`);
    
    let content = '';
    response.results?.forEach((block: any) => {
      content += extractBlockText(block) + '\n';
    });

    return content.trim();
  } catch (error) {
    console.error(`Error getting page content for ${pageId}:`, error);
    return '';
  }
}

function extractComplaintsFromContent(content: string, title: string = ''): {
  isComplaint: boolean;
  confidence: number;
  extractedText: string;
} {
  const fullText = `${title} ${content}`.toLowerCase();
  
  const complaintPatterns = [
    /(frustrated|annoying|terrible|awful|broken|issues?|problems?|bugs?)/i,
    /(struggling|stuck|can't|cannot|failing|difficult|complicated)/i,
    /(hate|dislike|worst|painful|nightmare|disaster)/i,
    /(need (?:help|fix|solution)|how (?:to|do) (?:fix|solve))/i,
    /(missing|lacking|wish (?:we|i) had|would be nice)/i,
  ];

  const productivityKeywords = [
    'workflow', 'process', 'productivity', 'efficiency', 'automation', 'integration',
    'collaboration', 'team', 'project', 'task', 'deadline', 'management',
    'dashboard', 'reporting', 'analytics', 'tracking', 'monitoring'
  ];

  let confidence = 0;
  const matches: string[] = [];

  // Check for complaint patterns
  complaintPatterns.forEach(pattern => {
    const match = fullText.match(pattern);
    if (match) {
      confidence += 0.25;
      matches.push(match[0]);
    }
  });

  // Check for productivity/business keywords
  const hasProductivityContext = productivityKeywords.some(keyword => fullText.includes(keyword));
  if (hasProductivityContext) {
    confidence += 0.2;
  }

  const isComplaint = confidence > 0.3 && hasProductivityContext && content.length > 20;

  return {
    isComplaint,
    confidence: Math.min(confidence, 1.0),
    extractedText: matches.join(' ')
  };
}

async function fetchNotionContent(maxPosts: number = 25): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!NOTION_API_KEY) {
    throw new Error("Notion API key not configured");
  }

  const searchQueries = [
    'problem', 'issue', 'challenge', 'frustration', 'difficulty',
    'workflow', 'process', 'automation', 'integration', 'productivity'
  ];

  try {
    console.log("Starting Notion content ingestion...");

    for (const query of searchQueries.slice(0, 5)) { // Limit queries to avoid timeouts
      if (posts.length >= maxPosts) break;

      try {
        console.log(`Searching Notion for: ${query}`);
        
        const response = await notionRequest('/search', {
          method: 'POST',
          body: JSON.stringify({
            query: query,
            filter: {
              value: 'page',
              property: 'object'
            },
            sort: {
              direction: 'descending',
              timestamp: 'last_edited_time'
            },
            page_size: 10
          }),
        });

        const pages = response.results || [];

        for (const page of pages) {
          if (posts.length >= maxPosts) break;

          try {
            const title = extractPageTitle(page);
            const content = await getPageContent(page.id);
            const analysis = extractComplaintsFromContent(content, title);
            
            if (analysis.isComplaint) {
              const createdISO = page.created_time;
              const body = content.slice(0, 1000); // Limit body length
              const hash = await makeHash("notion", page.id, body, createdISO);

              posts.push({
                platform: "notion",
                platform_post_id: page.id,
                author: "Notion User",
                url: page.url,
                created_at: createdISO,
                fetched_at: nowISO,
                title: `Notion: ${title}`,
                body: body,
                hash: hash
              });
            } else {
              filteredCount++;
            }

            // Check comments on the page
            try {
              const commentsResponse = await notionRequest(`/comments?block_id=${page.id}`);
              const comments = commentsResponse.results || [];

              for (const comment of comments) {
                if (posts.length >= maxPosts) break;

                const commentText = comment.rich_text?.map((text: any) => text.text?.content || '').join('') || '';
                const commentAnalysis = extractComplaintsFromContent(commentText);
                
                if (commentAnalysis.isComplaint && commentText.length > 20) {
                  const commentDate = comment.created_time;
                  const commentId = `comment-${comment.id}`;
                  const hash = await makeHash("notion", commentId, commentText, commentDate);

                  posts.push({
                    platform: "notion",
                    platform_post_id: commentId,
                    author: comment.created_by.name || "Notion User",
                    url: page.url,
                    created_at: commentDate,
                    fetched_at: nowISO,
                    title: `Notion Comment on: ${title}`,
                    body: commentText,
                    hash: hash
                  });
                } else {
                  filteredCount++;
                }
              }
            } catch (error) {
              // Comments endpoint might not be accessible for all pages
              console.log(`No comments access for page ${page.id}`);
            }

            await sleep(500); // Rate limiting between pages
          } catch (error) {
            console.error(`Error processing page ${page.id}:`, error);
          }
        }

        await sleep(2000); // Rate limiting between searches
      } catch (error) {
        console.error(`Error processing Notion search "${query}":`, error);
      }
    }

    console.log(`Notion ingestion complete: ${posts.length} posts fetched, ${filteredCount} filtered`);
    return { posts, filtered: filteredCount };

  } catch (error) {
    console.error("Notion ingestion failed:", error);
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
    const maxPosts = Math.min(body.max_posts || 25, 40);
    
    console.log(`Notion: Processing up to ${maxPosts} posts`);

    const result = await fetchNotionContent(maxPosts);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} Notion content, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "notion",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Notion platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "notion",
        version: "1.0.0",
        last_updated: "2025-01-19T00:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});