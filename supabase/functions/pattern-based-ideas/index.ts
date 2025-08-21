// supabase/functions/pattern-based-ideas/index.ts
// Enhanced SaaS idea generation based on complaint patterns across multiple posts
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Function version and configuration
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-16T12:00:00Z";

// Configuration
const MODEL = "gpt-4o-mini";
const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT = 300;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 60000;
const MIN_CLUSTER_SIZE = 3; // Minimum posts needed to form a cluster
const MAX_CLUSTERS = 15; // Maximum number of clusters to process
const MIN_SCORE_THRESHOLD = 40; // Only keep high-quality ideas

interface ClusterAnalysis {
  cluster_id: string;
  theme: string;
  pain_points: string[];
  user_segments: string[];
  frequency: number;
  business_impact: string;
  post_ids: number[];
  representative_complaints: string[];
}

interface PatternIdea {
  score: number;
  name: string;
  description: string;
  target_user: string;
  phase1_features: string[];
  phase2_features: string[];
  phase3_features: string[];
  why_now: string;
  pricing_hint: string;
  rationale: string;
  representative_post_ids: number[];
  cluster_analysis: ClusterAnalysis;
  market_evidence: {
    complaint_volume: number;
    user_segments: string[];
    pain_severity: string;
    solution_gap: string;
  };
}

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
          max_tokens: 4000,
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
        
        try {
          return JSON.parse(content);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          console.error("Raw content:", content);
          
          // Try to fix common JSON issues
          let fixedContent = content;
          
          // Remove any trailing incomplete content after the last complete JSON object
          const lastBraceIndex = fixedContent.lastIndexOf('}');
          if (lastBraceIndex > 0) {
            fixedContent = fixedContent.substring(0, lastBraceIndex + 1);
          }
          
          // Escape unescaped quotes in string values
          fixedContent = fixedContent.replace(/(?<!\\)"/g, '\\"');
          fixedContent = fixedContent.replace(/\\"/g, '"'); // Fix over-escaping
          
          try {
            return JSON.parse(fixedContent);
          } catch (secondParseError) {
            console.error("Failed to fix JSON:", secondParseError);
            throw new Error(`Invalid JSON response from OpenAI: ${parseError.message}`);
          }
        }
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

function buildClusteringPrompt(posts: any[]): { system: string, user: string } {
  const system = `You are an expert business analyst specializing in identifying market opportunities from customer complaints.

Your task: Analyze complaint posts and identify COMMON PATTERNS that could be solved by single SaaS solutions.

CRITICAL REQUIREMENTS:
1. Group complaints by UNDERLYING BUSINESS PROBLEMS (not surface-level symptoms)
2. Each cluster should represent a problem affecting MULTIPLE users/companies
3. Focus on problems that can be solved with SOFTWARE/SaaS solutions
4. Identify clusters with at least 3-5 similar complaints
5. Prioritize high-impact business problems

CLUSTERING CRITERIA:
- Similar pain points across different users/companies
- Common workflow inefficiencies 
- Repeated integration/automation needs
- Shared compliance/reporting challenges
- Similar user experience frustrations
- Cross-industry process problems

Return STRICT JSON:
{
  "clusters": [
    {
      "cluster_id": "unique_id",
      "theme": "Brief theme description",
      "pain_points": ["Pain point 1", "Pain point 2"],
      "user_segments": ["User type 1", "User type 2"],
      "frequency": 8,
      "business_impact": "High/Medium/Low impact description",
      "post_ids": [123, 456, 789],
      "representative_complaints": ["Quote 1", "Quote 2"]
    }
  ]
}`;

  const postsText = posts.map(post => {
    const title = post.title || '';
    const body = (post.body || '').slice(0, 800); // Use more content since no summary
    
    return `ID: ${post.id} | Title: ${title} | Content: ${body}...`;
  }).join('\n');

  const user = `Analyze these ${posts.length} complaint posts and identify common patterns that could be solved by SaaS solutions:

${postsText}

Focus on finding patterns where multiple posts describe similar underlying business problems.`;

  return { system, user };
}

function buildIdeaGenerationPrompt(clusters: ClusterAnalysis[], existingIdeas: string[]): { system: string, user: string } {
  const system = `You are an innovative SaaS product strategist and entrepreneur.

Your task: Generate HIGH-IMPACT SaaS ideas based on validated complaint patterns from real users.

CRITICAL REQUIREMENTS:
1. Each idea must solve problems affecting MULTIPLE users (backed by complaint clusters)
2. Focus on B2B SaaS opportunities with clear revenue potential
3. Generate 1-2 specific, actionable ideas per cluster
4. Ensure ideas are feasible to build and scale
5. Target underserved niches with strong pain points
6. Provide comprehensive multi-sentence descriptions (not one-liners)
7. Break down features into 3 development phases with 4 features each:
   - Phase 1: MVP/Core features for initial product launch
   - Phase 2: Advanced features for growth and differentiation
   - Phase 3: Enterprise features for scale and market leadership

SCORING CRITERIA (0-100):
- Validated Pain Intensity (0-30): How severe and widespread is the problem?
- Market Size & Revenue Potential (0-25): Clear willingness to pay?
- Competitive Moat & Defensibility (0-20): Sustainable competitive advantage?
- Technical Feasibility & Time to Market (0-15): Can be built efficiently?
- Market Timing & Opportunity (0-10): Why now?

FOCUS AREAS:
- Workflow automation and integration tools
- Industry-specific compliance and reporting solutions
- Data management and analytics platforms
- Communication and collaboration improvements
- Process optimization and efficiency tools

${existingIdeas.length > 0 ? `EXISTING IDEAS TO AVOID:\n${existingIdeas.join('\n')}\n` : ''}

IMPORTANT: Return VALID JSON only. Escape all quotes within strings. Keep descriptions concise to prevent truncation.

Return STRICT JSON:
{
  "ideas": [
    {
      "score": 85,
      "name": "Specific Product Name",
      "description": "Comprehensive multi-sentence description explaining the value proposition, problem it solves, target market, and key benefits. Keep under 200 words to prevent JSON truncation.",
      "target_user": "Specific user persona from cluster analysis",
      "phase1_features": ["MVP Core Feature 1", "MVP Core Feature 2", "MVP Core Feature 3", "MVP Core Feature 4"],
      "phase2_features": ["Advanced Feature 1", "Advanced Feature 2", "Advanced Feature 3", "Advanced Feature 4"],
      "phase3_features": ["Enterprise Feature 1", "Enterprise Feature 2", "Enterprise Feature 3", "Enterprise Feature 4"],
      "why_now": "Market timing and opportunity rationale",
      "pricing_hint": "Pricing model based on value delivered",
      "rationale": "Why this scores high - specific reasoning based on cluster data",
      "representative_post_ids": [123, 456, 789],
      "cluster_analysis": {
        "cluster_id": "cluster_id_reference",
        "theme": "cluster theme",
        "pain_points": ["pain 1", "pain 2"],
        "user_segments": ["segment 1", "segment 2"],
        "frequency": 8,
        "business_impact": "impact description",
        "post_ids": [123, 456],
        "representative_complaints": ["quote 1", "quote 2"]
      },
      "market_evidence": {
        "complaint_volume": 8,
        "user_segments": ["segment 1", "segment 2"],
        "pain_severity": "High/Medium/Low",
        "solution_gap": "Description of current solution gaps"
      }
    }
  ]
}`;

  const clustersText = clusters.map(cluster => 
    `Cluster: ${cluster.theme}
    Pain Points: ${cluster.pain_points.join(', ')}
    User Segments: ${cluster.user_segments.join(', ')}
    Frequency: ${cluster.frequency} complaints
    Business Impact: ${cluster.business_impact}
    Representative Complaints: ${cluster.representative_complaints.join(' | ')}`
  ).join('\n\n');

  const user = `Generate specific SaaS ideas based on these validated complaint clusters:

${clustersText}

Each idea should solve the core problems identified in these clusters and target the user segments experiencing these pain points.`;

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
    console.log("Starting pattern-based SaaS idea generation...");
    
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") || DEFAULT_DAYS);
    const limit = Number(url.searchParams.get("limit") || DEFAULT_LIMIT);
    
    console.log(`Days: ${days}, Limit: ${limit}`);
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required Supabase environment variables");
    }

    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch recent complaint posts (skip summarization requirement)
    const sinceISO = new Date(Date.now() - days * 86400000).toISOString();
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, title, body, sentiment, url, created_at, platform")
      .eq("is_complaint", true)
      .lt("sentiment", -0.1)
      .not("title", "is", null)
      .not("body", "is", null)
      .gte("created_at", sinceISO)
      .order("sentiment", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    if (!posts || posts.length < MIN_CLUSTER_SIZE) {
      return new Response(JSON.stringify({
        status: "success",
        message: `Insufficient posts for clustering (need at least ${MIN_CLUSTER_SIZE})`,
        ideas: [],
        stats: { posts_found: posts?.length || 0, clusters_found: 0, ideas_generated: 0 }
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    console.log(`Found ${posts.length} posts for clustering analysis`);

    // Step 1: Cluster complaints by common patterns
    console.log("Step 1: Clustering complaints by patterns...");
    const { system: clusterSystem, user: clusterUser } = buildClusteringPrompt(posts);
    const clusterResult = await callOpenAIWithRetry(clusterSystem, clusterUser);
    
    const clusters: ClusterAnalysis[] = Array.isArray(clusterResult?.clusters) 
      ? clusterResult.clusters.filter((cluster: any) => 
          cluster.post_ids && 
          Array.isArray(cluster.post_ids) && 
          cluster.post_ids.length >= MIN_CLUSTER_SIZE
        ).slice(0, MAX_CLUSTERS)
      : [];

    if (clusters.length === 0) {
      return new Response(JSON.stringify({
        status: "success",
        message: "No significant complaint patterns found",
        ideas: [],
        stats: { posts_found: posts.length, clusters_found: 0, ideas_generated: 0 }
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    console.log(`Found ${clusters.length} complaint clusters`);

    // Get existing ideas for deduplication
    const dedupeSinceISO = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data: existingIdeas } = await supabase
      .from("saas_idea_items")
      .select("name, target_user")
      .gte("created_at", dedupeSinceISO);

    const existingIdeaNames = (existingIdeas || []).map(idea => 
      `${idea.name} (Target: ${idea.target_user || 'N/A'})`
    );

    // Step 2: Generate SaaS ideas from clusters
    console.log("Step 2: Generating SaaS ideas from patterns...");
    const { system: ideaSystem, user: ideaUser } = buildIdeaGenerationPrompt(clusters, existingIdeaNames);
    const ideaResult = await callOpenAIWithRetry(ideaSystem, ideaUser);
    
    const rawIdeas: PatternIdea[] = Array.isArray(ideaResult?.ideas) 
      ? ideaResult.ideas.filter((idea: any) => 
          idea.score >= MIN_SCORE_THRESHOLD && 
          idea.representative_post_ids && 
          Array.isArray(idea.representative_post_ids)
        )
      : [];

    console.log(`Generated ${rawIdeas.length} high-quality pattern-based ideas`);

    // Create run header
    const { data: runData, error: runError } = await supabase
      .from("saas_idea_runs")
      .insert({
        platform: "pattern_analysis",
        period_days: days,
        source_limit: limit
      })
      .select("id, created_at")
      .single();

    if (runError || !runData) {
      throw new Error(`Failed to create run: ${runError?.message}`);
    }

    const runId = runData.id;
    console.log(`Created run ${runId}`);

    // Prepare ideas for insertion
    const preparedIdeas = rawIdeas.map(idea => ({
      run_id: runId,
      name: String(idea.name || "Untitled Pattern-Based Idea"),
      name_norm: String(idea.name || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(),
      score: Math.min(100, Math.max(0, Math.round(Number(idea.score) || 0))),
      one_liner: idea.description ? String(idea.description) : null,
      target_user: idea.target_user ? String(idea.target_user) : null,
      core_features: [
        ...(Array.isArray(idea.phase1_features) ? idea.phase1_features.map(String) : []),
        ...(Array.isArray(idea.phase2_features) ? idea.phase2_features.map(String) : []),
        ...(Array.isArray(idea.phase3_features) ? idea.phase3_features.map(String) : [])
      ],
      why_now: idea.why_now ? String(idea.why_now) : null,
      pricing_hint: idea.pricing_hint ? String(idea.pricing_hint) : null,
      rationale: idea.rationale ? String(idea.rationale) : null,
      representative_post_ids: Array.isArray(idea.representative_post_ids) 
        ? idea.representative_post_ids.filter(id => Number.isInteger(Number(id))).map(Number)
        : [],
      payload: {
        ...idea,
        generation_method: "pattern_analysis",
        cluster_data: idea.cluster_analysis,
        market_evidence: idea.market_evidence,
        phase_breakdown: {
          phase1: Array.isArray(idea.phase1_features) ? idea.phase1_features.map(String) : [],
          phase2: Array.isArray(idea.phase2_features) ? idea.phase2_features.map(String) : [],
          phase3: Array.isArray(idea.phase3_features) ? idea.phase3_features.map(String) : []
        }
      }
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
        last_updated: LAST_UPDATED,
        generation_method: "pattern_analysis"
      },
      run_info: {
        run_id: runId,
        created_at: runData.created_at,
        platform: "pattern_analysis",
        period_days: days,
        source_limit: limit
      },
      stats: {
        posts_analyzed: posts.length,
        clusters_identified: clusters.length,
        raw_ideas_generated: rawIdeas.length,
        ideas_inserted: insertedCount,
        existing_ideas_checked: existingIdeas?.length || 0,
        duration_ms: duration,
        duration_minutes: Math.round(duration / 60000 * 10) / 10
      },
      clusters: clusters.map(cluster => ({
        theme: cluster.theme,
        frequency: cluster.frequency,
        user_segments: cluster.user_segments,
        pain_points: cluster.pain_points
      })),
      sample_ideas: preparedIdeas.slice(0, 3).map(idea => ({
        name: idea.name,
        score: idea.score,
        target_user: idea.target_user,
        complaint_count: idea.representative_post_ids.length
      }))
    };

    console.log("Pattern-based idea generation complete:", result.stats);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Pattern-based idea generation error:", error);
    
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