// supabase/functions/ideas-from-summaries/index.ts
// Enhanced pattern-based SaaS idea generation from cross-post analysis
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Function version and configuration
const FUNCTION_VERSION = "3.0.0";
const LAST_UPDATED = "2025-01-16T12:00:00Z";

// Configuration
const MODEL = "gpt-4o-mini";
const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT = 300;
const CHUNK_SIZE = 80; // Larger chunks to identify cross-post patterns
const SUMMARY_TRUNC = 200;
const MAX_RETRIES = 3;
const DEDUPE_LOOKBACK_DAYS = 60;
const MIN_SCORE_THRESHOLD = 30; // Only keep ideas with score >= 30

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSummaryText(summary: any): string {
  if (!summary) return "";
  if (typeof summary === "object") {
    return String(summary.text || summary.summary || "");
  }
  return String(summary);
}

function buildEnhancedPrompt(items: string[], existingIdeas: string[]): { system: string, user: string } {
  const system = `You are an innovative SaaS strategist and product visionary.

CRITICAL REQUIREMENTS:
1. Identify COMMON PATTERNS across multiple complaints (not individual post solutions)
2. Generate 3-7 DIVERSE SaaS ideas that solve problems affecting MULTIPLE users
3. Each idea should address similar pain points mentioned across DIFFERENT posts
4. Focus on solutions that can serve many customers with the same underlying problem
5. Prioritize B2B SaaS opportunities with clear revenue potential

PATTERN IDENTIFICATION FOCUS:
- Look for the SAME problem mentioned by different users/companies
- Identify repeated workflow inefficiencies across industries
- Find common integration or automation needs
- Spot recurring compliance, reporting, or data management issues
- Notice shared user experience frustrations

SCORING CRITERIA (0-100):
- Cross-Post Pattern Strength (0-30): How many posts mention similar problems?
- Market Pain Intensity & Frequency (0-25): How urgent and widespread?
- Market Size & Revenue Potential (0-20): Clear willingness to pay?
- Solution Feasibility & Differentiation (0-15): Buildable competitive advantage?
- Market Timing & Opportunity (0-10): Why now?

AVOID SINGLE-POST SOLUTIONS:
- Ideas that only solve one person's specific problem
- Highly customized or niche one-off solutions
- Generic "productivity tools" without specific pain points
- Solutions that don't scale across multiple customers

FOCUS ON SCALABLE PATTERNS:
- Industry-agnostic workflow problems
- Cross-functional communication gaps
- Data integration and automation needs
- Compliance and reporting inefficiencies
- User experience pain points affecting multiple segments

${existingIdeas.length > 0 ? `EXISTING IDEAS TO AVOID DUPLICATING:\n${existingIdeas.join('\n')}\n\nYour new ideas must be meaningfully different from these.\n` : ''}

Return STRICT JSON:
{
  "ideas": [
    {
      "score": 85,
      "name": "Specific Product Name",
      "one_liner": "Clear value proposition solving the common pattern",
      "target_user": "Specific user persona experiencing this pattern",
      "core_features": ["Feature 1", "Feature 2", "Feature 3"],
      "why_now": "Why this opportunity exists now",
      "pricing_hint": "Pricing model suggestion",
      "rationale": "Why this scores high - specific reasoning about the pattern",
      "representative_post_ids": [123, 456, 789],
      "pattern_evidence": "Description of the common pattern across posts"
    }
  ]
}`;

  const user = `Analyze these complaint summaries and identify COMMON PATTERNS that could be solved by scalable SaaS solutions:

${items}

Look for the SAME underlying problems mentioned across MULTIPLE different posts. Generate ideas that solve these recurring patterns, not individual one-off complaints.`;

  return { system, user };
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
          temperature: 0.4, // Higher temperature for more creativity
          max_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      }, 45000);

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

function calculateSimilarity(idea1: any, idea2: any): number {
  const name1 = normalizeName(idea1.name || "");
  const name2 = normalizeName(idea2.name || "");
  
  // Check for exact normalized name match
  if (name1 === name2) return 1.0;
  
  // Check for high word overlap
  const words1 = new Set(name1.split(" ").filter(w => w.length > 2));
  const words2 = new Set(name2.split(" ").filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  const wordSimilarity = union.size > 0 ? intersection.size / union.size : 0;
  
  // Check target user similarity
  const target1 = normalizeName(idea1.target_user || "");
  const target2 = normalizeName(idea2.target_user || "");
  const targetSimilarity = target1 === target2 ? 0.3 : 0;
  
  return Math.max(wordSimilarity, targetSimilarity);
}

function deduplicateIdeas(newIdeas: any[], existingIdeas: any[], threshold: number = 0.4): any[] {
  const allExisting = [...existingIdeas];
  const result: any[] = [];
  
  for (const idea of newIdeas) {
    let isDuplicate = false;
    
    // Check against existing ideas
    for (const existing of allExisting) {
      if (calculateSimilarity(idea, existing) > threshold) {
        console.log(`Skipping duplicate idea: "${idea.name}" (similar to existing: "${existing.name}")`);
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      // Check against already accepted ideas in this batch
      for (const accepted of result) {
        if (calculateSimilarity(idea, accepted) > threshold) {
          console.log(`Skipping duplicate idea in batch: "${idea.name}" (similar to: "${accepted.name}")`);
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate && idea.score >= MIN_SCORE_THRESHOLD) {
      result.push(idea);
      allExisting.push(idea); // Add to existing list for next iteration
    }
  }
  
  return result;
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
    console.log("Starting enhanced SaaS idea generation...");
    
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") || DEFAULT_DAYS);
    const limit = Number(url.searchParams.get("limit") || DEFAULT_LIMIT);
    const platform = url.searchParams.get("platform") || "reddit";
    
    console.log(`Platform: ${platform}, Days: ${days}, Limit: ${limit}`);
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Fetch summarized complaint posts
    const sinceISO = new Date(Date.now() - days * 86400000).toISOString();
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, summary, sentiment, url, created_at, platform")
      .eq("platform", platform)
      .eq("is_complaint", true)
      .lt("sentiment", -0.1)
      .not("summary", "is", null)
      .gte("created_at", sinceISO)
      .order("sentiment", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({
        status: "success",
        message: "No summarized complaints found",
        ideas: [],
        stats: { posts_found: 0, ideas_generated: 0 }
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    console.log(`Found ${posts.length} posts for idea generation`);

    // Get existing ideas for deduplication
    const dedupeSinceISO = new Date(Date.now() - DEDUPE_LOOKBACK_DAYS * 86400000).toISOString();
    const { data: existingIdeas } = await supabase
      .from("saas_idea_items")
      .select("name, target_user, name_norm")
      .gte("created_at", dedupeSinceISO);

    const existingIdeaNames = (existingIdeas || []).map(idea => 
      `${idea.name} (Target: ${idea.target_user || 'N/A'})`
    );

    // Create run header
    const { data: runData, error: runError } = await supabase
      .from("saas_idea_runs")
      .insert({
        platform: `${platform}_patterns`,
        period_days: days,
        source_limit: limit,
        notes: `Enhanced pattern-based generation from ${posts.length} posts`
      })
      .select("id, created_at")
      .single();

    if (runError || !runData) {
      throw new Error(`Failed to create run: ${runError?.message}`);
    }

    const runId = runData.id;
    console.log(`Created run ${runId}`);

    // Process posts in chunks
    const chunks = [];
    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      chunks.push(posts.slice(i, i + CHUNK_SIZE));
    }

    const allIdeas: any[] = [];
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const summaryLines = chunk.map(post => {
        const summary = extractSummaryText(post.summary).replace(/\s+/g, " ").trim();
        const truncated = summary.slice(0, SUMMARY_TRUNC);
        return `(${post.id}) ${truncated}${summary.length > SUMMARY_TRUNC ? "…" : ""} [${post.url || 'N/A'}]`;
      });

      console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} posts...`);

      try {
        const { system, user } = buildEnhancedPrompt(summaryLines, existingIdeaNames);
        const result = await callOpenAIWithRetry(system, user);
        
        const ideas = Array.isArray(result?.ideas) ? result.ideas : [];
        console.log(`Chunk ${chunkIndex + 1}: received ${ideas.length} raw ideas`);
        
        // Deduplicate within this chunk and against existing
        const deduplicatedIdeas = deduplicateIdeas(ideas, allIdeas.concat(existingIdeas || []));
        console.log(`Chunk ${chunkIndex + 1}: ${deduplicatedIdeas.length} unique ideas after deduplication`);
        
        allIdeas.push(...deduplicatedIdeas);
        
        // Add delay between chunks
        if (chunkIndex < chunks.length - 1) {
          await sleep(2000);
        }
        
      } catch (error) {
        console.error(`Chunk ${chunkIndex + 1} failed:`, error);
      }
    }

    // Prepare ideas for insertion
    const preparedIdeas = allIdeas.map(idea => ({
      run_id: runId,
      name: String(idea.name || "Untitled Idea"),
      name_norm: normalizeName(idea.name || ""),
      score: Math.min(100, Math.max(0, Math.round(Number(idea.score) || 0))),
      one_liner: idea.one_liner ? String(idea.one_liner) : null,
      target_user: idea.target_user ? String(idea.target_user) : null,
      core_features: Array.isArray(idea.core_features) ? idea.core_features.map(String) : [],
      why_now: idea.why_now ? String(idea.why_now) : null,
      pricing_hint: idea.pricing_hint ? String(idea.pricing_hint) : null,
      rationale: idea.rationale ? String(idea.rationale) : null,
      representative_post_ids: Array.isArray(idea.representative_post_ids) 
        ? idea.representative_post_ids.filter(id => Number.isInteger(Number(id))).map(Number)
        : [],
      payload: idea
    }));

    // Insert ideas
    let insertedCount = 0;
    if (preparedIdeas.length > 0) {
      const { data: insertedIdeas, error: insertError } = await supabase
        .from("saas_idea_items")
        .upsert(preparedIdeas, {
          onConflict: "run_id,name_norm",
          ignoreDuplicates: true
        })
        .select("id, name, score");

      if (insertError) {
        console.error("Insert error:", insertError);
      } else {
        insertedCount = insertedIdeas?.length || 0;
      }
    }

    const duration = Date.now() - startTime;
    const result = {
      status: "success",
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED
      },
      run_info: {
        run_id: runId,
        created_at: runData.created_at,
        platform,
        period_days: days,
        source_limit: limit
      },
      stats: {
        posts_processed: posts.length,
        chunks_processed: chunks.length,
        raw_ideas_generated: allIdeas.length,
        ideas_inserted: insertedCount,
        existing_ideas_checked: existingIdeas?.length || 0,
        duration_ms: duration,
        duration_minutes: Math.round(duration / 60000 * 10) / 10
      },
      sample_ideas: preparedIdeas.slice(0, 5).map(idea => ({
        name: idea.name,
        score: idea.score,
        target_user: idea.target_user
      }))
    };

    console.log("Idea generation complete:", result.stats);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Idea generation error:", error);
    
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