// Idea Validator Microservice - Validates and enhances generated ideas using GPT-4o
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function version
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-19T15:00:00Z";

// Configuration
const VALIDATION_MODEL = "gpt-4o";
const MAX_RETRIES = 3;
const VALIDATION_THRESHOLD_SCORE = 70;
const MAX_IDEAS_TO_VALIDATE = 10;

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

function buildValidationPrompt(idea: any): { system: string; user: string } {
  const system = `You are a SaaS market analyst and venture strategist.
Your role is to evaluate SaaS product concepts with a critical, data-driven lens.

CRITICAL REQUIREMENTS:
1. Validate feasibility: Is the idea realistically buildable with today's tech stack?
2. Assess competition: Identify existing products/services and analyze gaps
3. Check product existence: Research similar solutions and their limitations
4. Evaluate market demand: Estimate urgency, frequency, and willingness to pay
5. Test scalability: Does this serve a broad market segment?
6. Identify risks: Adoption blockers, regulatory hurdles, switching costs
7. Market validation: Extract financial impact and quantify business value

MARKET VALIDATION FOCUS:
- Look for mentions of dollar amounts lost, revenue impact, cost savings potential
- Quantify time waste: "hours per week/month" wasted on manual processes
- Identify business systems: CRM, ERP, HRMS, project management tools
- Calculate market indicators: Potential willingness to pay based on problem costs
- Assess pain frequency: How often does this problem occur?
- Validate target persona: Enterprise users, SMB owners, specific job functions?

Return STRICT JSON:
{
  "ideas_analysis": [
    {
      "name": "${idea.name}",
      "revised_score": 78,
      "market_size": "Estimate of TAM/SAM with reasoning",
      "competition": ["Competitor 1", "Competitor 2", "Competitor 3"],
      "does_exist": "yes | no | uncertain",
      "improvement_opportunities": ["Gap 1", "Gap 2", "Gap 3"],
      "differentiation": "How this idea stands out or gaps it fills",
      "feasibility": "High | Medium | Low with reasoning",
      "risks": ["Risk 1", "Risk 2", "Risk 3"],
      "go_to_market_hint": "Possible entry strategy or wedge",
      "sanity_check": "viable | crowded | weak",
      "market_validation": {
        "financial_impact": "Dollar amounts or estimated costs",
        "time_waste_quantified": "Hours wasted per period",
        "business_systems_mentioned": ["CRM", "ERP", "etc"],
        "willingness_to_pay": "Estimated based on problem costs",
        "pain_frequency": "daily | weekly | monthly | quarterly",
        "target_persona_validated": "Specific user persona",
        "market_maturity": "emerging | growing | mature | declining",
        "adoption_barriers": ["Barrier 1", "Barrier 2", "etc"]
      }
    }
  ]
}`;

  const user = `Validate this SaaS idea with deep market analysis:

NAME: ${idea.name}
TARGET USER: ${idea.target_user}
ONE-LINER: ${idea.one_liner}
CORE FEATURES: ${Array.isArray(idea.core_features) ? idea.core_features.join(", ") : idea.core_features}
CURRENT SCORE: ${idea.score}
CURRENT RATIONALE: ${idea.rationale}
CLUSTER THEME: ${idea.cluster_theme || "N/A"}
CLUSTER SIZE: ${idea.cluster_size || 0} supporting complaints
PATTERN EVIDENCE: ${idea.pattern_evidence || "N/A"}

ORIGINAL COMPLAINTS FOR MARKET VALIDATION:
${idea.representative_post_ids ? `Based on ${idea.representative_post_ids.length} complaint posts from validated cluster` : "No specific posts referenced"}

🔍 PERFORM DEEP MARKET VALIDATION:
- Extract any dollar amounts, costs, or financial impact mentioned in the cluster evidence
- Look for time quantification (hours, days wasted) in the underlying complaints
- Identify business tools/systems mentioned (CRM, ERP, etc.) that this could integrate with
- Estimate market size and willingness to pay based on the validated cluster pattern
- Validate if this represents a real, quantifiable business problem affecting multiple users
- Research existing solutions and identify specific gaps this idea could fill
- Assess competitive landscape and differentiation opportunities

Provide comprehensive market validation analysis with refined scoring based on cluster evidence and competitive research.`;

  return { system, user };
}

async function callOpenAIForValidation(prompt: { system: string; user: string }): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: VALIDATION_MODEL,
          temperature: 0.2,
          max_tokens: 1500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI validation ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      
      if (content) {
        return JSON.parse(content);
      } else {
        throw new Error("Empty validation response from OpenAI");
      }
    } catch (error) {
      console.warn(`Validation attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      
      // Exponential backoff
      const delay = 2000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function validateAndUpdateIdeas(jobId: string, runId: string, parameters: any): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  // Get ideas from the run that need validation
  const { data: ideas, error: ideasError } = await supabase
    .from("saas_idea_items")
    .select("*")
    .eq("run_id", runId)
    .gte("score", VALIDATION_THRESHOLD_SCORE)
    .order("score", { ascending: false })
    .limit(MAX_IDEAS_TO_VALIDATE);
  
  if (ideasError || !ideas) {
    throw new Error(`Failed to get ideas for validation: ${ideasError?.message}`);
  }
  
  console.log(`Validating ${ideas.length} high-scoring ideas`);
  
  if (ideas.length === 0) {
    console.log(`No ideas meet validation threshold (${VALIDATION_THRESHOLD_SCORE})`);
    await updateJobStatus(jobId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      result: {
        message: "No ideas met validation threshold",
        validation_threshold: VALIDATION_THRESHOLD_SCORE,
        ideas_validated: 0
      }
    });
    return;
  }
  
  let validatedCount = 0;
  const validationResults = [];
  
  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    console.log(`Validating idea ${i + 1}/${ideas.length}: ${idea.name}`);
    
    await updateJobStatus(jobId, {
      progress: {
        current_step: `Validating idea ${i + 1}/${ideas.length}: ${idea.name}`,
        total_steps: 3,
        completed_steps: 2,
        ideas_validated: validatedCount,
      }
    });
    
    try {
      const validationPrompt = buildValidationPrompt(idea);
      const validationResult = await callOpenAIForValidation(validationPrompt);
      
      if (validationResult && validationResult.ideas_analysis && validationResult.ideas_analysis.length > 0) {
        const analysis = validationResult.ideas_analysis[0];
        
        // Update the idea with validation results
        const validationData = {
          score: analysis.revised_score || idea.score,
          validated_at: new Date().toISOString(),
          validated_by_model: VALIDATION_MODEL,
          // Store validation data in payload for now (until schema is updated)
          payload: {
            ...idea.payload,
            validation_metadata: {
              market_size: analysis.market_size,
              competition: analysis.competition,
              does_exist: analysis.does_exist,
              improvement_opportunities: analysis.improvement_opportunities,
              differentiation: analysis.differentiation,
              feasibility: analysis.feasibility,
              risks: analysis.risks,
              go_to_market_hint: analysis.go_to_market_hint,
              sanity_check: analysis.sanity_check,
              market_validation: analysis.market_validation,
              validated_at: new Date().toISOString(),
              validated_by_model: VALIDATION_MODEL,
            }
          }
        };
        
        const { error: updateError } = await supabase
          .from("saas_idea_items")
          .update(validationData)
          .eq("id", idea.id);
        
        if (updateError) {
          console.error(`Failed to update idea ${idea.id}:`, updateError);
        } else {
          validatedCount++;
          validationResults.push({
            id: idea.id,
            name: idea.name,
            original_score: idea.score,
            revised_score: analysis.revised_score,
            sanity_check: analysis.sanity_check
          });
        }
      }
      
      // Add delay between validation calls to respect rate limits
      if (i < ideas.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`Validation failed for idea "${idea.name}":`, error);
    }
  }
  
  console.log(`Validation completed: ${validatedCount}/${ideas.length} ideas validated`);
  
  // Complete the job
  await updateJobStatus(jobId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    progress: {
      current_step: "Validation completed",
      total_steps: 3,
      completed_steps: 3,
      ideas_validated: validatedCount,
    },
    result: {
      message: "Idea generation pipeline completed successfully",
      ideas_validated: validatedCount,
      total_ideas: ideas.length,
      validation_threshold: VALIDATION_THRESHOLD_SCORE,
      run_id: runId,
      sample_results: validationResults.slice(0, 3)
    }
  });
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
    const { job_id: jobId, run_id: runId, ideas_count } = requestData;
    
    if (!jobId || !runId) {
      return new Response(JSON.stringify({ error: "job_id and run_id are required" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }
    
    console.log(`Starting idea validation for job ${jobId}, run ${runId}`);
    const startTime = Date.now();
    
    // Validate and update ideas
    await validateAndUpdateIdeas(jobId, runId, requestData);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      status: "success",
      message: `Idea validation completed`,
      job_id: jobId,
      run_id: runId,
      ideas_count: ideas_count || 0,
      duration_ms: duration,
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        service: "idea-validator"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Idea validation error:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      function_info: {
        version: FUNCTION_VERSION,
        last_updated: LAST_UPDATED,
        service: "idea-validator"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});