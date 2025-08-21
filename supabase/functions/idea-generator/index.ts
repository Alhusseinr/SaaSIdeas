// Idea Generator Microservice - Generates SaaS ideas from cluster data
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function version
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-19T15:00:00Z";

// Configuration
const IDEATION_MODEL = "gpt-4o-mini";
const MAX_RETRIES = 3;
const MIN_SCORE_THRESHOLD = 30;
const MAX_CLUSTERS_TO_PROCESS = 8; // Limit to prevent timeouts
const MAX_PROCESSING_TIME_MS = 8 * 60 * 1000; // 8 minutes max

// Workflow automation scoring
const AUTOMATION_SCORE_BOOST = 15;
const INTEGRATION_SCORE_BOOST = 12;
const REPORTING_SCORE_BOOST = 10;
const COMPLIANCE_SCORE_BOOST = 8;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function updateJobStatus(jobId: string, updates: any): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supabase.from("ideas_jobs").update(updates).eq("id", jobId);
  if (error) console.error(`Failed to update job ${jobId}:`, error);
}

function buildEnhancedPrompt(cluster: any, existingIdeas: string[]): { system: string; user: string } {
  const system = `You are an innovative SaaS strategist and product visionary specializing in identifying scalable B2B opportunities.

⚡ CLUSTER-FOCUSED ANALYSIS:
You are analyzing a specific complaint cluster: "${cluster.theme_summary}"
This cluster contains ${cluster.size} similar posts representing a validated pain pattern.

CRITICAL REQUIREMENTS:
1. IDENTIFY IDENTICAL PROBLEMS: Look for the EXACT SAME complaint mentioned by multiple users in this cluster
2. COUNT FREQUENCY: Only generate ideas for problems mentioned 5+ times in the cluster
3. FOCUS ON B2B PAIN: Prioritize workflow, productivity, and business process complaints
4. MARKET VALIDATION: Consider willingness to pay - do users mention costs, time wasted, or business impact?
5. GENERATE 1-3 DIVERSE SaaS ideas: ensure each is meaningfully different in target users, industries, or workflows
6. TECHNICAL FEASIBILITY: Ensure ideas are technically feasible with today's SaaS stack (APIs, webhooks, ETL/ELT, LLMs, cloud infra)
7. AVOID VAGUE AI CLAIMS: Avoid generic "AI does everything" solutions without specific implementation details

PATTERN IDENTIFICATION FOCUS:
- Look for the SAME problem mentioned by different users/companies in this cluster
- Identify repeated workflow inefficiencies across industries
- Find common integration or automation needs
- Spot recurring compliance, reporting, or data management issues
- Notice shared user experience frustrations

🚀 PRIORITIZE WORKFLOW AUTOMATION OPPORTUNITIES:
- **Workflow Automation**: Manual, repetitive tasks that can be automated
- **Integration Platforms**: Connecting disconnected business tools (CRM+Email, etc.)
- **Reporting/Dashboards**: Visibility into business metrics and KPIs
- **Compliance/Audit**: Regulatory requirements and approval workflows

⚖️ BALANCED APPROACH: While prioritizing automation, also consider other valuable B2B solutions like communication tools, customer management, or specialized industry software.

SCORING CRITERIA (0-100):
- Cross-Post Pattern Strength (0-30): How many posts in this cluster mention similar problems?
- Market Pain Intensity & Frequency (0-25): How urgent and widespread within this cluster?
- Market Size & Revenue Potential (0-20): Clear willingness to pay based on cluster evidence?
- Solution Feasibility & Differentiation (0-15): Buildable competitive advantage?
- Market Timing & Opportunity (0-10): Why now?

AVOID SINGLE-POST SOLUTIONS:
- Ideas that only solve one person's specific problem
- Highly customized or niche one-off solutions
- Generic "productivity tools" without specific pain points
- Solutions that don't scale across multiple customers

FOCUS ON SCALABLE CLUSTER PATTERNS:
- Industry-agnostic workflow problems represented in this cluster
- Cross-functional communication gaps evident across cluster posts
- Data integration and automation needs mentioned multiple times
- Compliance and reporting inefficiencies appearing in cluster
- User experience pain points affecting multiple segments in this cluster

${existingIdeas.length > 0 ? `EXISTING IDEAS TO AVOID DUPLICATING:\n${existingIdeas.join('\n')}\n\nYour new ideas must be meaningfully different from these.\n` : ''}

OUTPUT RULES:
- Return ONLY the JSON object below. No explanations, no markdown, no prose before or after.
- Do not invent post IDs; use the actual post IDs from this cluster in representative_post_ids
- If you are uncertain about market existence, set "does_not_exist": "unknown" and still list "similar_to" if any adjacent products are known
- Focus on the validated pain pattern represented by this cluster
- Each idea should directly address the cluster's common theme

Return STRICT JSON exactly in this shape:
{
  "ideas": [
    {
      "score": 85,
      "name": "Specific Product Name",
      "one_liner": "Clear value proposition solving the cluster pattern",
      "target_user": "Specific user persona experiencing this cluster pattern",
      "core_features": ["Feature 1", "Feature 2", "Feature 3+"],
      "why_now": "Why this opportunity exists now",
      "pricing_hint": "Pricing model suggestion",
      "rationale": "Why this scores high - specific reasoning about the cluster pattern",
      "representative_post_ids": [${cluster.representative_posts.map((p: any) => p.id).join(', ')}],
      "pattern_evidence": "Description of the common pattern across this cluster",
      "similar_to": "List of existing similar products or solutions in the market",
      "gaps_filled": "Specific gaps or limitations in existing solutions that this idea addresses",
      "does_not_exist": "Explanation of how this idea differs from or improves upon existing solutions"
    }
  ]
}`;

  const postTexts = cluster.representative_posts.map((post: any) => {
    const content = `${post.title || ""}\n\n${post.body || ""}`.replace(/\s+/g, " ").trim();
    const truncated = content.slice(0, 400); // More content for better context
    return `(${post.id}) ${truncated}${content.length > 400 ? "…" : ""} [${post.url || 'N/A'}]`;
  }).join('\n\n');

  const user = `Analyze this validated complaint cluster and identify HIGH-FREQUENCY PATTERNS that could be solved by scalable B2B SaaS solutions:

CLUSTER ANALYSIS:
Theme: ${cluster.theme_summary}
Size: ${cluster.size} similar posts
Validated Pattern: Multiple users experiencing the same underlying problem

REPRESENTATIVE POSTS FROM THIS CLUSTER:
${postTexts}

CRITICAL REQUIREMENTS:
1. This cluster represents a VALIDATED PATTERN - multiple users experiencing similar pain
2. Only generate ideas for problems mentioned 5+ times within this cluster's posts
3. Generate 1-3 DIVERSE SaaS ideas that solve the COMMON THREAD across these specific posts
4. Focus on B2B problems with clear business impact (time waste, productivity loss, manual work)
5. Each idea should directly address the recurring theme: "${cluster.theme_summary}"
6. Provide specific post IDs that support each pattern in "representative_post_ids"
7. Ensure technical feasibility with today's SaaS stack (APIs, webhooks, ETL/ELT, LLMs, cloud infra)
8. Ignore one-off complaints - focus on patterns mentioned multiple times across this cluster

Generate 1-3 high-confidence, diverse ideas based on the strongest recurring patterns (5+ mentions) you identify in this specific cluster.`;

  return { system, user };
}

async function callOpenAI(system: string, user: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Add timeout to OpenAI calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout per call
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: IDEATION_MODEL,
          temperature: 0.4,
          max_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      
      if (content) {
        return JSON.parse(content);
      } else {
        throw new Error("Empty response from OpenAI");
      }
    } catch (error) {
      console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      
      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function analyzeWorkflowOpportunity(idea: any): { 
  score_boost: number; 
  automation_category: string | null;
  automation_signals: string[];
} {
  const ideaText = `${idea.name || ""} ${idea.one_liner || ""} ${idea.rationale || ""} ${JSON.stringify(idea.core_features || [])}`.toLowerCase();
  
  let scoreBoost = 0;
  let automationCategory = null;
  const automationSignals: string[] = [];

  // 1. Workflow Automation Detection
  const workflowKeywords = [
    'automat', 'workflow', 'manual', 'repetitive', 'recurring', 'scheduled',
    'trigger', 'batch process', 'bulk', 'routine', 'streamline', 'eliminate manual'
  ];
  const workflowMatches = workflowKeywords.filter(keyword => ideaText.includes(keyword));
  
  if (workflowMatches.length > 0) {
    scoreBoost += AUTOMATION_SCORE_BOOST;
    automationCategory = 'workflow_automation';
    automationSignals.push(`Workflow automation: ${workflowMatches.join(', ')}`);
  }

  // 2. Integration Gaps Detection  
  const integrationKeywords = [
    'integrat', 'connect', 'sync', 'api', 'webhook', 'bridge', 'link',
    'unify', 'consolidate', 'centralize', 'single source', 'data flow'
  ];
  const systemKeywords = [
    'crm', 'erp', 'hrms', 'salesforce', 'slack', 'teams', 'jira', 'asana',
    'hubspot', 'mailchimp', 'stripe', 'quickbooks', 'excel', 'spreadsheet'
  ];
  
  const integrationMatches = integrationKeywords.filter(keyword => ideaText.includes(keyword));
  const systemMatches = systemKeywords.filter(keyword => ideaText.includes(keyword));
  
  if (integrationMatches.length > 0 && systemMatches.length >= 2) {
    scoreBoost += INTEGRATION_SCORE_BOOST;
    if (!automationCategory) automationCategory = 'integration_platform';
    automationSignals.push(`Integration opportunity: ${integrationMatches.join(', ')} between ${systemMatches.join(', ')}`);
  }

  // 3. Reporting/Dashboard Detection
  const reportingKeywords = [
    'report', 'dashboard', 'analytic', 'metric', 'kpi', 'visibility', 'insight',
    'track', 'monitor', 'measure', 'visualiz', 'chart', 'graph'
  ];
  const reportingMatches = reportingKeywords.filter(keyword => ideaText.includes(keyword));
  
  if (reportingMatches.length > 0) {
    scoreBoost += REPORTING_SCORE_BOOST;
    if (!automationCategory) automationCategory = 'reporting_dashboard';
    automationSignals.push(`Reporting/visibility: ${reportingMatches.join(', ')}`);
  }

  // 4. Compliance/Audit Trail Detection
  const complianceKeywords = [
    'compliance', 'audit', 'regulatory', 'govern', 'policy', 'rule',
    'approval', 'permission', 'access control', 'security', 'gdpr', 'hipaa'
  ];
  const complianceMatches = complianceKeywords.filter(keyword => ideaText.includes(keyword));
  
  if (complianceMatches.length > 0) {
    scoreBoost += COMPLIANCE_SCORE_BOOST;
    if (!automationCategory) automationCategory = 'compliance_automation';
    automationSignals.push(`Compliance/audit: ${complianceMatches.join(', ')}`);
  }

  // 5. Additional Business Process Signals
  const processKeywords = [
    'process', 'procedure', 'checklist', 'template', 'standardiz', 'optimize'
  ];
  const processMatches = processKeywords.filter(keyword => ideaText.includes(keyword));
  
  if (processMatches.length > 0 && scoreBoost === 0) {
    scoreBoost += 5; // Small boost for general process improvement
    automationCategory = 'process_optimization';
    automationSignals.push(`Process improvement: ${processMatches.join(', ')}`);
  }

  return { score_boost: scoreBoost, automation_category: automationCategory, automation_signals: automationSignals };
}

function normalizeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function storeIdeasAndTriggerNext(jobId: string, ideas: any[], parameters: any): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  // Create run header
  const { data: runData, error: runError } = await supabase
    .from("saas_idea_runs")
    .insert({
      platform: parameters.platform || "all",
      period_days: parameters.days || 14,
      source_limit: parameters.limit || 300,
      notes: `Microservice-generated from ${ideas.length} ideas`,
    })
    .select("id, created_at")
    .single();

  if (runError || !runData) {
    throw new Error(`Failed to create run: ${runError?.message}`);
  }

  const runId = runData.id;
  console.log(`Created run ${runId} for ${ideas.length} ideas`);

  // Prepare ideas for insertion
  const preparedIdeas = ideas.map(idea => ({
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
      ? idea.representative_post_ids.filter((id: any) => Number.isInteger(Number(id))).map(Number)
      : [],
    posts_in_common: Array.isArray(idea.representative_post_ids) ? idea.representative_post_ids.length : 0,
    confidence_level: 'medium', // Default for microservice-generated ideas
    pattern_evidence: idea.pattern_evidence ? String(idea.pattern_evidence) : null,
    payload: idea
  }));

  // Insert ideas
  let insertedCount = 0;
  if (preparedIdeas.length > 0) {
    const { data: insertedIdeas, error: insertError } = await supabase
      .from("saas_idea_items")
      .upsert(preparedIdeas, {
        onConflict: "run_id,name_norm",
        ignoreDuplicates: true,
      })
      .select("id, name, score");

    if (insertError) {
      console.error("Insert error:", insertError);
    } else {
      insertedCount = insertedIdeas?.length || 0;
    }
  }

  console.log(`Inserted ${insertedCount} ideas into database`);

  // Update job progress
  await updateJobStatus(jobId, {
    progress: {
      current_step: "Ideas generated, starting validation",
      total_steps: 3,
      completed_steps: 2,
      ideas_generated: ideas.length,
      ideas_inserted: insertedCount,
    }
  });

  // Trigger validation if enabled
  if (parameters.enable_validation !== false) {
    const baseUrl = SUPABASE_URL!.replace('supabase.co', 'supabase.co/functions/v1');
    const validatorResponse = await fetch(`${baseUrl}/idea-validator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        job_id: jobId,
        run_id: runId,
        ideas_count: insertedCount,
        ...parameters
      })
    });

    if (!validatorResponse.ok) {
      console.warn(`Idea validator failed: ${validatorResponse.status}, completing without validation`);
      
      await updateJobStatus(jobId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        result: {
          ideas_generated: ideas.length,
          ideas_inserted: insertedCount,
          validation_skipped: true,
          run_id: runId
        }
      });
    } else {
      console.log(`Triggered idea-validator for job ${jobId}`);
    }
  } else {
    // Complete job without validation
    await updateJobStatus(jobId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      result: {
        ideas_generated: ideas.length,
        ideas_inserted: insertedCount,
        validation_disabled: true,
        run_id: runId
      }
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Only POST requests supported" }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }
    
    const requestData = await req.json();
    const { job_id: jobId, clusters_count } = requestData;
    
    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }
    
    console.log(`Starting idea generation for job ${jobId}`);
    const startTime = Date.now();
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get cluster data from previous microservice
    const { data: clusterData, error: clusterError } = await supabase
      .from("cluster_results")
      .select("*")
      .eq("job_id", jobId)
      .single();
    
    if (clusterError || !clusterData) {
      throw new Error(`Failed to get cluster data: ${clusterError?.message}`);
    }
    
    const allClusters = clusterData.clusters;
    // Limit clusters to prevent timeouts - process largest clusters first
    const clusters = allClusters
      .sort((a: any, b: any) => b.size - a.size)
      .slice(0, MAX_CLUSTERS_TO_PROCESS);
    
    console.log(`Found ${allClusters.length} total clusters, processing top ${clusters.length} by size`);
    
    if (clusters.length === 0) {
      await updateJobStatus(jobId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        result: { message: "No clusters to process", ideas_generated: 0 }
      });
      
      return new Response(JSON.stringify({
        status: "completed",
        message: "No clusters to process",
        ideas_generated: 0
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }
    
    // Get existing ideas for deduplication (simplified)
    const { data: existingIdeas } = await supabase
      .from("saas_idea_items")
      .select("name, target_user")
      .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString())
      .limit(50);
    
    const existingIdeaNames = (existingIdeas || []).map(idea => 
      `${idea.name} (Target: ${idea.target_user || 'N/A'})`
    );
    
    // Generate ideas from each cluster with timeout protection
    const allIdeas: any[] = [];
    const processingStartTime = Date.now();
    
    for (let i = 0; i < clusters.length; i++) {
      // Check if we're approaching timeout
      if (Date.now() - processingStartTime > MAX_PROCESSING_TIME_MS) {
        console.log(`Timeout approaching, stopping at cluster ${i + 1}/${clusters.length}`);
        break;
      }
      const cluster = clusters[i];
      console.log(`Processing cluster ${i + 1}/${clusters.length}: ${cluster.theme_summary}`);
      
      await updateJobStatus(jobId, {
        progress: {
          current_step: `Generating ideas from cluster ${i + 1}/${clusters.length}`,
          total_steps: 3,
          completed_steps: 1,
          clusters_processed: i,
        }
      });
      
      try {
        const { system, user } = buildEnhancedPrompt(cluster, existingIdeaNames);
        const result = await callOpenAI(system, user);
        
        const ideas = Array.isArray(result?.ideas) ? result.ideas : [];
        console.log(`Cluster ${i + 1}: Generated ${ideas.length} raw ideas`);
        
        // Apply workflow automation boost if enabled
        const enhancedIdeas = ideas.map((idea: any) => {
          const baseIdea = {
            ...idea,
            cluster_id: cluster.id,
            cluster_theme: cluster.theme_summary,
            cluster_size: cluster.size
          };

          if (requestData.enable_automation_boost !== false) {
            const automationAnalysis = analyzeWorkflowOpportunity(baseIdea);
            baseIdea.score = (baseIdea.score || 0) + automationAnalysis.score_boost;
            baseIdea.automation_category = automationAnalysis.automation_category;
            baseIdea.automation_signals = automationAnalysis.automation_signals;
            baseIdea.original_score = idea.score;
            baseIdea.automation_boost = automationAnalysis.score_boost;
          }

          return baseIdea;
        });
        
        // Simple filtering by score threshold
        const filteredIdeas = enhancedIdeas.filter((idea: any) => idea.score >= MIN_SCORE_THRESHOLD);
        console.log(`Cluster ${i + 1}: ${filteredIdeas.length} ideas above threshold`);
        
        allIdeas.push(...filteredIdeas);
        
      } catch (error) {
        console.error(`Cluster ${i + 1} processing failed:`, error);
      }
    }
    
    console.log(`Generated ${allIdeas.length} total ideas`);
    
    if (allIdeas.length === 0) {
      await updateJobStatus(jobId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        result: { message: "No ideas generated above threshold", ideas_generated: 0 }
      });
      
      return new Response(JSON.stringify({
        status: "completed",
        message: "No ideas generated above threshold",
        ideas_generated: 0
      }), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }
    
    // Store ideas and trigger validation
    await storeIdeasAndTriggerNext(jobId, allIdeas, requestData);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      status: "success",
      message: `Idea generation completed, triggered validation`,
      job_id: jobId,
      ideas_generated: allIdeas.length,
      clusters_processed: clusters.length,
      duration_ms: duration,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        service: "idea-generator"
      }
    }), {
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
        last_updated: LAST_UPDATED,
        service: "idea-generator"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});