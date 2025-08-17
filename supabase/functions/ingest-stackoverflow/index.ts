// Stack Overflow platform ingest function - simplified and self-contained for Edge Functions
const STACKOVERFLOW_API_BASE = "https://api.stackexchange.com/2.3";
const SO_API_KEY = Deno.env.get("STACKOVERFLOW_API_KEY");

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
  // Complete Stack Overflow search terms from original
  const complaintTerms = [
    "frustrating", "annoying", "difficult", "confusing", "complicated",
    "broken", "doesn't work", "not working", "failing", "error",
    "slow", "performance", "inefficient", "tedious", "painful",
    "why is", "how to avoid", "better way", "alternative",
    "hate", "terrible", "awful", "horrible", "worst",
    "problem with", "issue with", "trouble with", "struggle",
    "wish there was", "need a tool", "looking for", "missing",
    "limitation", "drawback", "downside", "weakness"
  ];
  
  const lowerContent = content.toLowerCase();
  return complaintTerms.some(term => lowerContent.includes(term));
}

function hasNegativeSentiment(content: string): boolean {
  const negativeTerms = /\b(frustrat|annoy|problem|issue|difficult|slow|broken|terrible|awful|hate|why.*so.*hard|doesn.*work|not.*work|fail|error)\b/i;
  return negativeTerms.test(content);
}

async function fetchStackOverflowQuestions(maxQuestions: number = 50): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  try {
    console.log("Fetching Stack Overflow questions...");

    // Base API parameters
    const baseParams = new URLSearchParams({
      site: 'stackoverflow',
      order: 'desc',
      sort: 'creation',
      pagesize: Math.min(maxQuestions, 50).toString(),
      filter: 'withbody',
      fromdate: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000).toString() // Last 7 days
    });

    if (SO_API_KEY) {
      baseParams.set('key', SO_API_KEY);
    }

    // Complete search queries from original
    const searchQueries = [
      "frustrating OR annoying OR \"doesn't work\" OR broken",
      "\"why is\" OR \"how to avoid\" OR \"better way\" OR alternative", 
      "\"problem with\" OR \"issue with\" OR limitation OR drawback",
      "slow OR performance OR inefficient OR tedious"
    ];

    for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries
      try {
        const params = new URLSearchParams(baseParams);
        params.set('intitle', query);
        
        const url = `${STACKOVERFLOW_API_BASE}/questions?${params.toString()}`;
        
        const response = await fetch(url, {
          headers: {
            "User-Agent": "complaint-scanner/0.1",
            "Accept": "application/json"
          }
        });

        if (!response.ok) {
          console.warn(`Stack Overflow API error: ${response.status}`);
          await sleep(2000);
          continue;
        }

        const data = await response.json();
        
        if (data.error_id) {
          console.error("Stack Overflow API error:", data.error_message);
          continue;
        }

        const questions = data.items || [];
        console.log(`Stack Overflow: Processing ${questions.length} questions for query: ${query.substring(0, 30)}...`);

        for (const question of questions) {
          try {
            const title = question.title || "";
            const body = question.body || "";
            const content = `${title} ${body}`;
            
            // Check if content contains our search terms
            if (!hasComplaintTerms(content)) {
              filteredCount++;
              continue;
            }
            
            // Filter out spam
            if (/\b(crypto|bitcoin|nft|casino|gambling)\b/i.test(content)) {
              filteredCount++;
              continue;
            }
            
            // Filter out very basic questions (focus on complaints/pain points)
            if (body.length < 100 && !hasNegativeSentiment(content)) {
              filteredCount++;
              continue;
            }
            
            // Focus on questions with negative sentiment or substantial content
            if (!hasNegativeSentiment(content) && body.length < 200) {
              filteredCount++;
              continue;
            }
            
            const createdAt = question.creation_date ? new Date(question.creation_date * 1000).toISOString() : nowISO;
            const hash = await makeHash("stackoverflow", String(question.question_id), `${title} ${body}`, createdAt);
            
            // Clean up HTML from body
            const cleanBody = body.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
            
            posts.push({
              platform: "stackoverflow",
              platform_post_id: String(question.question_id),
              author: question.owner?.display_name || null,
              url: question.link,
              created_at: createdAt,
              fetched_at: nowISO,
              title: title,
              body: cleanBody.substring(0, 1000), // Limit body length
              hash: hash
            });
            
            await sleep(50); // Be respectful to API
            
          } catch (questionError) {
            console.error(`Error processing Stack Overflow question ${question.question_id}:`, questionError);
          }
        }
        
        // Rate limiting
        await sleep(1000);
        
      } catch (queryError) {
        console.error(`Error fetching Stack Overflow questions for query "${query}":`, queryError);
      }
    }
    
    console.log(`Stack Overflow: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
    return { posts, filtered: filteredCount };
    
  } catch (error) {
    console.error("Error fetching Stack Overflow questions:", error);
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
    const maxQuestions = Math.min(body.max_questions || 50, 100);
    
    console.log(`Stack Overflow: Processing up to ${maxQuestions} questions`);

    const result = await fetchStackOverflowQuestions(maxQuestions);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} Stack Overflow questions, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "stackoverflow",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Stack Overflow platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "stackoverflow",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});