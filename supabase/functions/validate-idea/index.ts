// supabase/functions/validate-idea/index.ts
// Edge Function to validate user-submitted SaaS ideas against market data
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Function version and configuration
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-15T00:00:00Z";

// Configuration
const MODEL = "gpt-4o-mini";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 45000;
const MAX_POSTS_TO_ANALYZE = 100;
const MAX_SUMMARIES_TO_ANALYZE = 50;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

interface IdeaInput {
  name: string;
  description: string;
  target_user?: string;
  core_features?: string;
  pricing_model?: string;
}

interface ValidationResult {
  score: number;
  rationale: string;
  market_evidence: string[];
  competition_level: string;
  recommendations: string[];
  similar_complaints: number;
  keyword_matches: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAIWithRetry(system: string, user: string): Promise<any> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      }, TIMEOUT_MS);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "{}";
        return JSON.parse(content);
      }

      const errorText = await response.text();
      lastError = new Error(`OpenAI error ${response.status}: ${errorText}`);
      
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.warn(`OpenAI transient error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      break;
    } catch (error) {
      lastError = error;
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`OpenAI network error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function extractKeywords(text: string): string[] {
  const commonWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", 
    "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy", 
    "did", "its", "let", "put", "say", "she", "too", "use", "this", "that", "with", "have", "from", "they", 
    "will", "been", "each", "which", "their", "time", "would", "there", "what", "were", "said", "than", "only"
  ]);
  
  return Array.from(new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
  ));
}

function findKeywordMatches(ideaKeywords: string[], posts: any[]): { matches: string[], count: number } {
  const matches = new Set<string>();
  let totalMatches = 0;
  
  for (const post of posts) {
    const postText = `${post.title || ""} ${post.body || ""}`.toLowerCase();
    const postKeywords = post.keywords || [];
    
    for (const keyword of ideaKeywords) {
      if (postText.includes(keyword) || postKeywords.includes(keyword)) {
        matches.add(keyword);
        totalMatches++;
      }
    }
  }
  
  return { matches: Array.from(matches), count: totalMatches };
}

function buildValidationPrompt(idea: IdeaInput, marketData: any): { system: string, user: string } {
  const system = `You are an expert SaaS market analyst. Analyze a user's SaaS idea against real market data and complaints.

SCORING CRITERIA (0-100):
- Market Pain Evidence (0-30): How much evidence exists of this problem in complaints?
- Market Size & Demand (0-25): Size of target market and willingness to pay?
- Competition Analysis (0-20): How saturated is this market?
- Solution Fit (0-15): How well does the idea solve the identified problems?
- Execution Feasibility (0-10): How realistic is implementation?

COMPETITION LEVELS:
- "low": Few existing solutions, clear opportunity
- "medium": Some competition but room for differentiation  
- "high": Saturated market with many solutions

Return STRICT JSON:
{
  "score": 75,
  "rationale": "Brief explanation of the score",
  "market_evidence": ["Evidence point 1", "Evidence point 2"],
  "competition_level": "medium",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "similar_complaints": 15,
  "keyword_matches": ["keyword1", "keyword2"]
}

IMPORTANT: 
- similar_complaints should be your estimate of truly relevant complaint posts (not the total provided)
- Base this on the quality and relevance of matches, not just quantity
- Consider semantic similarity, not just keyword matches`;

  const user = `IDEA TO VALIDATE:
Name: ${idea.name}
Description: ${idea.description}
Target User: ${idea.target_user || "Not specified"}
Core Features: ${idea.core_features || "Not specified"}
Pricing Model: ${idea.pricing_model || "Not specified"}

MARKET DATA:
Similar Complaints Found: ${marketData.complaintCount}
Related Posts: ${marketData.posts.length}
Keyword Matches: ${marketData.keywordMatches.matches.join(", ")}

RECENT COMPLAINT SUMMARIES:
${marketData.summaries.map((s: any, i: number) => `${i + 1}. ${s.summary || s.text}`).join("\n")}

SAMPLE RELATED POSTS:
${marketData.posts.slice(0, 10).map((p: any, i: number) => 
  `${i + 1}. [${p.sentiment?.toFixed(2) || "N/A"}] ${p.title || "No title"}: ${(p.body || "").slice(0, 200)}...`
).join("\n")}

Validate this idea against the market data above.`;

  return { system, user };
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
    console.log("Starting SaaS idea validation...");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required Supabase environment variables");
    }

    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    // Parse request body
    const body = await req.json();
    const idea: IdeaInput = body.idea;

    if (!idea?.name || !idea?.description) {
      return new Response(JSON.stringify({
        status: "error",
        error: "Missing required fields: name and description"
      }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    console.log(`Validating idea: ${idea.name}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Extract keywords from the idea
    const ideaText = `${idea.name} ${idea.description} ${idea.target_user || ""} ${idea.core_features || ""}`;
    const ideaKeywords = extractKeywords(ideaText);
    
    console.log(`Extracted keywords: ${ideaKeywords.join(", ")}`);

    // Find related posts and complaints
    const keywordFilter = ideaKeywords.length > 0 
      ? ideaKeywords.map(k => `keywords.cs.{"${k}"}`).join(",")
      : null;

    // Get related complaint posts
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, title, body, sentiment, keywords, is_complaint, created_at, url")
      .eq("is_complaint", true)
      .lt("sentiment", 0)
      .or(keywordFilter || "sentiment.lt.0")
      .order("sentiment", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(MAX_POSTS_TO_ANALYZE);

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    const complaintPosts = posts || [];
    console.log(`Found ${complaintPosts.length} related complaint posts`);

    // Get recent summaries for context
    const { data: summaries, error: summariesError } = await supabase
      .from("posts")
      .select("id, summary, sentiment, created_at")
      .eq("is_complaint", true)
      .not("summary", "is", null)
      .lt("sentiment", -0.2)
      .order("sentiment", { ascending: true })
      .limit(MAX_SUMMARIES_TO_ANALYZE);

    if (summariesError) {
      console.warn("Failed to fetch summaries:", summariesError.message);
    }

    const complaintSummaries = summaries || [];
    console.log(`Found ${complaintSummaries.length} complaint summaries`);

    // Analyze keyword matches
    const keywordMatches = findKeywordMatches(ideaKeywords, complaintPosts);
    console.log(`Keyword matches: ${keywordMatches.count} total, ${keywordMatches.matches.length} unique`);

    // Prepare market data for AI analysis
    const marketData = {
      posts: complaintPosts,
      summaries: complaintSummaries,
      complaintCount: complaintPosts.length,
      keywordMatches
    };

    // Get AI validation
    const { system, user } = buildValidationPrompt(idea, marketData);
    const aiResult = await callOpenAIWithRetry(system, user);

    // Prepare final validation result
    const validation: ValidationResult = {
      score: Math.min(100, Math.max(0, Math.round(Number(aiResult.score) || 0))),
      rationale: String(aiResult.rationale || "No analysis available"),
      market_evidence: Array.isArray(aiResult.market_evidence) 
        ? aiResult.market_evidence.map(String) 
        : [],
      competition_level: String(aiResult.competition_level || "unknown"),
      recommendations: Array.isArray(aiResult.recommendations) 
        ? aiResult.recommendations.map(String) 
        : [],
      similar_complaints: (() => {
        // If AI provided a valid number, use it
        const aiCount = Number(aiResult.similar_complaints);
        if (!isNaN(aiCount) && aiCount > 0) {
          return Math.round(aiCount);
        }
        
        // Otherwise, use keyword match count as a more realistic fallback
        // This represents posts that actually relate to the idea
        return Math.max(1, keywordMatches.count);
      })(),
      keyword_matches: keywordMatches.matches
    };

    const duration = Date.now() - startTime;
    const result = {
      status: "success",
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      },
      validation,
      meta: {
        posts_analyzed: complaintPosts.length,
        summaries_analyzed: complaintSummaries.length,
        keywords_extracted: ideaKeywords.length,
        duration_ms: duration
      }
    };

    console.log(`Validation complete: Score ${validation.score}/100 in ${duration}ms`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Validation error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      },
      duration_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});