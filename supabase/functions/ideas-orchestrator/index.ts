// Ideas orchestrator - coordinates background SaaS idea generation with job tracking
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function version and metadata
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-17T17:00:00Z";

// Security configuration
const IDEAS_API_KEY = Deno.env.get("IDEAS_API_KEY");
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 2; // More restrictive for complex idea generation

// Processing configuration - Ultra conservative for complex analysis
const CHUNK_SIZE = 60; // Smaller chunks for better analysis
const CONCURRENT_REQUESTS = 1; // Sequential processing for idea generation
const MAX_PROCESSING_TIME = 15 * 60 * 1000; // 15 minutes
const INTER_CHUNK_DELAY = 5000; // Longer delays for stability
const OPENAI_TIMEOUT_MS = 60000; // Very long timeout for complex analysis

// Model configuration - Two-tier system
const IDEATION_MODEL = "gpt-4o-mini"; // Fast, cheap for initial pattern detection
const VALIDATION_MODEL = "gpt-4o"; // More accurate for existence checks and refinement
const VALIDATION_TIMEOUT_MS = 90000; // Longer timeout for validation model
const VALIDATION_THRESHOLD_SCORE = 70; // Only validate ideas above this score
const MAX_IDEAS_TO_VALIDATE = 10; // Limit expensive validation calls
const MAX_RETRIES = 3;
const SAFETY_BUFFER_MS = 3 * 60 * 1000; // 3 minutes safety buffer
const MAX_SUMMARIES_PER_RUN = 300; // Increased limit for idea processing

// Enhanced reliability configuration
const OPENAI_RATE_LIMIT_DELAY = 90000; // 1.5 minute delay for rate limit
const EXPONENTIAL_BACKOFF_BASE = 2000; // 2 second base delay
const MAX_EXPONENTIAL_DELAY = 60000; // 60 seconds max delay
const CIRCUIT_BREAKER_THRESHOLD = 3; // Fail fast after 3 consecutive failures
const FALLBACK_USAGE_THRESHOLD = 0.6; // Use fallback when 60% of requests fail

// Cost optimization configuration
const MODEL_COSTS = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 }, // per 1K tokens
  "gpt-4o": { input: 0.003, output: 0.012 }, // per 1K tokens
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 }, // per 1K tokens
};

const COST_OPTIMIZATION_ENABLED = true;
const MAX_COST_PER_JOB = 5.0; // Maximum $5 per job

// Idea generation configuration
const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT = 300;
const SUMMARY_TRUNC = 200;
const DEDUPE_LOOKBACK_DAYS = 60;
const MIN_SCORE_THRESHOLD = 30;

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Database connection pooling
interface DatabaseConnection {
  client: any;
  inUse: boolean;
  lastUsed: number;
  createdAt: number;
}

class DatabasePool {
  private pool: DatabaseConnection[] = [];
  private readonly maxConnections = 3; // Smaller pool for idea generation
  private readonly connectionTimeout = 10 * 60 * 1000; // 10 minutes

  async getConnection(): Promise<any> {
    let connection = this.pool.find((conn) => !conn.inUse);

    if (connection) {
      const age = Date.now() - connection.createdAt;
      if (age > this.connectionTimeout) {
        this.pool = this.pool.filter((c) => c !== connection);
        connection = null;
      } else {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        return connection.client;
      }
    }

    if (this.pool.length < this.maxConnections) {
      const client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const newConnection: DatabaseConnection = {
        client,
        inUse: true,
        lastUsed: Date.now(),
        createdAt: Date.now(),
      };
      this.pool.push(newConnection);
      return client;
    }

    return new Promise((resolve) => {
      const checkForConnection = () => {
        const available = this.pool.find((conn) => !conn.inUse);
        if (available) {
          available.inUse = true;
          available.lastUsed = Date.now();
          resolve(available.client);
        } else {
          setTimeout(checkForConnection, 200);
        }
      };
      checkForConnection();
    });
  }

  releaseConnection(client: any): void {
    const connection = this.pool.find((conn) => conn.client === client);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  cleanup(): void {
    const now = Date.now();
    this.pool = this.pool.filter((conn) => {
      const age = now - conn.lastUsed;
      return age < this.connectionTimeout && !conn.inUse;
    });
  }
}

const dbPool = new DatabasePool();

// Enhanced reliability tracking
interface ReliabilityState {
  openaiFailures: number;
  consecutiveFailures: number;
  lastFailureTime: number;
  totalRequests: number;
  failedRequests: number;
  rateLimitHits: number;
  circuitBreakerOpen: boolean;
  fallbackMode: boolean;
}

const reliabilityState: ReliabilityState = {
  openaiFailures: 0,
  consecutiveFailures: 0,
  lastFailureTime: 0,
  totalRequests: 0,
  failedRequests: 0,
  rateLimitHits: 0,
  circuitBreakerOpen: false,
  fallbackMode: false,
};

// Cost tracking state
interface CostTracker {
  totalCost: number;
  ideationCost: number;
  validationCost: number;
  requestCounts: Record<string, number>;
  tokenCounts: Record<string, { input: number; output: number }>;
}

const costTracker: CostTracker = {
  totalCost: 0,
  ideationCost: 0,
  validationCost: 0,
  requestCounts: {},
  tokenCounts: {},
};

function estimateTokens(text: string): number {
  // Rough token estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function calculateRequestCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
  if (!costs) return 0;

  const inputCost = (inputTokens / 1000) * costs.input;
  const outputCost = (outputTokens / 1000) * costs.output;
  return inputCost + outputCost;
}

function trackCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  type: "ideation" | "validation"
): number {
  const cost = calculateRequestCost(model, inputTokens, outputTokens);

  costTracker.totalCost += cost;
  if (type === "ideation") {
    costTracker.ideationCost += cost;
  } else {
    costTracker.validationCost += cost;
  }

  costTracker.requestCounts[model] =
    (costTracker.requestCounts[model] || 0) + 1;

  if (!costTracker.tokenCounts[model]) {
    costTracker.tokenCounts[model] = { input: 0, output: 0 };
  }
  costTracker.tokenCounts[model].input += inputTokens;
  costTracker.tokenCounts[model].output += outputTokens;

  return cost;
}

function resetCostTracker(): void {
  costTracker.totalCost = 0;
  costTracker.ideationCost = 0;
  costTracker.validationCost = 0;
  costTracker.requestCounts = {};
  costTracker.tokenCounts = {};
}

interface IdeasJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: {
    current_step: string;
    total_steps: number;
    completed_steps: number;
    summaries_processed: number;
    summaries_total: number;
    current_chunk: number;
    total_chunks: number;
    ideas_generated: number;
    ideas_inserted: number;
  };
  result?: any;
  error?: string;
  parameters: any;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  const cfConnectingIP = req.headers.get("cf-connecting-ip");

  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return "unknown";
}

function checkRateLimit(clientIP: string): {
  allowed: boolean;
  remainingRequests: number;
} {
  const now = Date.now();
  const key = clientIP;

  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }

  const clientData = rateLimitMap.get(key);

  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remainingRequests: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remainingRequests: 0 };
  }

  clientData.count++;
  return {
    allowed: true,
    remainingRequests: MAX_REQUESTS_PER_WINDOW - clientData.count,
  };
}

function generateJobId(): string {
  return `ideas_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function getJob(jobId: string): Promise<IdeasJob | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = await dbPool.getConnection();

  try {
    const { data, error } = await supabase
      .from("ideas_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      status: data.status,
      created_at: data.created_at,
      started_at: data.started_at,
      completed_at: data.completed_at,
      progress: data.progress,
      result: data.result,
      error: data.error,
      parameters: data.parameters,
    };
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

async function createJob(job: IdeasJob): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = await dbPool.getConnection();

  try {
    const { error } = await supabase.from("ideas_jobs").insert({
      id: job.id,
      status: job.status,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      progress: job.progress,
      result: job.result,
      error: job.error,
      parameters: job.parameters,
    });

    if (error) {
      console.error("Failed to create ideas job:", error);
      throw new Error(`Failed to create ideas job: ${error.message}`);
    }

    console.log(`Created ideas job ${job.id} in database`);
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

async function updateJobStatus(
  jobId: string,
  updates: Partial<IdeasJob>
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = await dbPool.getConnection();

  try {
    const { error } = await supabase
      .from("ideas_jobs")
      .update(updates)
      .eq("id", jobId);

    if (error) {
      console.error(`Failed to update ideas job ${jobId}:`, error);
    }
  } finally {
    dbPool.releaseConnection(supabase);
  }
}

// Utility functions
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

// Enhanced prompt for idea generation (optimized for gpt-4o-mini)
function buildEnhancedPrompt(
  items: string[],
  existingIdeas: string[]
): { system: string; user: string } {
  const system = `You are a fast pattern-recognition SaaS strategist focused on identifying scalable opportunities.

⚡ SPEED-OPTIMIZED ANALYSIS:
1. RAPID PATTERN SCAN: Identify 3-5 recurring themes across multiple posts (not individual solutions)
2. QUICK DIVERSITY CHECK: Generate 3-7 ideas spanning different industries, user types, or workflow stages
3. FAST FEASIBILITY: Focus on proven SaaS patterns (dashboards, automation, integrations, notifications)
4. LIGHTWEIGHT DIFFERENTIATION: Simple competitive positioning, don't over-research existence

🎯 PATTERN IDENTIFICATION FOCUS:
- Same workflow bottlenecks mentioned 3+ times
- Repeated integration/automation gaps
- Common reporting/visibility issues
- Shared compliance/process pain points

📊 SCORING (Focus on clear signals):
- Pattern Frequency (0-30): How many posts mention this?
- Pain Intensity (0-25): How urgent does this seem?
- Market Scope (0-20): B2B with clear willingness to pay?
- Build Complexity (0-15): Standard SaaS patterns?
- Timing (0-10): Why now opportunity?

💡 IDEA GENERATION STRATEGY:
- Focus on recurring patterns (3+ mentions)
- Prioritize B2B solutions with clear ROI
- Avoid over-engineering - keep ideas simple and buildable
- Quick competitive assessment: "similar", "gap", or "unknown"

${
  existingIdeas.length > 0
    ? `EXISTING IDEAS TO AVOID DUPLICATING:\n${existingIdeas.join(
        "\n"
      )}\n\nYour new ideas must be meaningfully different from these.\n`
    : ""
}

OUTPUT RULES:
- Return ONLY the JSON object below. No explanations, no markdown, no prose before or after.
- Do not invent post IDs; if no IDs are available, set "representative_post_ids": [].
- If you are uncertain about market existence, set "does_not_exist": "unknown" and still list "similar_to" if any adjacent products are known.

Return STRICT JSON exactly in this shape:
{
  "ideas": [
    {
      "score": 85,
      "name": "Specific Product Name",
      "one_liner": "Clear value proposition solving the common pattern",
      "target_user": "Specific user persona experiencing this pattern",
      "core_features": ["Feature 1", "Feature 2", "Feature 3+"],
      "why_now": "Why this opportunity exists now",
      "pricing_hint": "Pricing model suggestion",
      "rationale": "Why this scores high - specific reasoning about the pattern",
      "representative_post_ids": [123, 456, 789],
      "pattern_evidence": "Description of the common pattern across posts",
      "gaps_filled": "List of gaps that the new idea could fill",
      "does_not_exist": "yes | no | unknown",
      "similar_to": "List the similar ideas or products"
    }
  ]
}`;

  const user = `Analyze these complaint summaries and identify COMMON PATTERNS that could be solved by scalable SaaS solutions:

${items}

Look for the SAME underlying problems mentioned across MULTIPLE different posts. Generate ideas that solve these recurring patterns, not individual one-off complaints.`;

  return { system, user };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Enhanced OpenAI integration with reliability
async function generateIdeasWithReliability(
  summaryLines: string[],
  existingIdeas: string[],
  ideationModel: string = IDEATION_MODEL
): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — cannot generate ideas");
    return { ideas: [] };
  }

  // Check circuit breaker
  if (reliabilityState.circuitBreakerOpen) {
    const timeSinceLastFailure = Date.now() - reliabilityState.lastFailureTime;
    if (timeSinceLastFailure < OPENAI_RATE_LIMIT_DELAY) {
      console.warn("Circuit breaker open, skipping idea generation");
      return { ideas: [] };
    } else {
      console.log("Circuit breaker cooling off, attempting request");
      reliabilityState.circuitBreakerOpen = false;
      reliabilityState.consecutiveFailures = 0;
    }
  }

  const { system, user } = buildEnhancedPrompt(summaryLines, existingIdeas);
  let lastError: any;
  reliabilityState.totalRequests++;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: ideationModel,
            temperature: 0.4,
            max_tokens: 2000,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        },
        OPENAI_TIMEOUT_MS
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = new Error(
          `OpenAI ${response.status}: ${errorText.slice(0, 300)}`
        );

        if (response.status === 429) {
          reliabilityState.rateLimitHits++;
          console.warn(`Rate limit hit, attempt ${attempt}/${MAX_RETRIES}`);

          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) =>
              setTimeout(resolve, OPENAI_RATE_LIMIT_DELAY)
            );
            continue;
          }
        } else if (
          response.status === 503 ||
          (response.status >= 500 && response.status < 600)
        ) {
          console.warn(
            `Server error ${response.status}, attempt ${attempt}/${MAX_RETRIES}`
          );

          if (attempt < MAX_RETRIES) {
            const delay = Math.min(
              EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
              MAX_EXPONENTIAL_DELAY
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        break;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();

      if (content) {
        reliabilityState.consecutiveFailures = 0;

        // Track cost
        const inputTokens =
          data.usage?.prompt_tokens || estimateTokens(system + user);
        const outputTokens =
          data.usage?.completion_tokens || estimateTokens(content);
        const cost = trackCost(
          ideationModel,
          inputTokens,
          outputTokens,
          "ideation"
        );

        console.log(
          `Ideation request cost: $${cost.toFixed(
            4
          )} (Total: $${costTracker.totalCost.toFixed(4)})`
        );

        // Check cost limit
        if (
          COST_OPTIMIZATION_ENABLED &&
          costTracker.totalCost > MAX_COST_PER_JOB
        ) {
          console.warn(
            `Cost limit exceeded: $${costTracker.totalCost.toFixed(
              4
            )} > $${MAX_COST_PER_JOB}`
          );
          reliabilityState.fallbackMode = true;
        }

        return JSON.parse(content);
      } else {
        console.warn("Empty response from OpenAI");
        break;
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `Ideas generation attempt ${attempt}/${MAX_RETRIES} error:`,
        error
      );

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(
          EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
          MAX_EXPONENTIAL_DELAY
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Handle failure
  reliabilityState.failedRequests++;
  reliabilityState.consecutiveFailures++;
  reliabilityState.lastFailureTime = Date.now();

  if (reliabilityState.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    reliabilityState.circuitBreakerOpen = true;
    console.warn("Circuit breaker opened due to consecutive failures");
  }

  const failureRate =
    reliabilityState.failedRequests / reliabilityState.totalRequests;
  if (failureRate >= FALLBACK_USAGE_THRESHOLD) {
    reliabilityState.fallbackMode = true;
    console.warn("Entering fallback mode due to high failure rate");
  }

  console.error("All idea generation attempts failed:", lastError);
  return { ideas: [] };
}

// Enhanced validation function using gpt-4o for existence checks and refinement
async function validateAndRefineIdeas(
  ideas: any[],
  parameters: {
    validation_model?: string;
    validation_threshold?: number;
    max_validation_ideas?: number;
    enable_validation?: boolean;
  } = {}
): Promise<any[]> {
  const {
    validation_model = VALIDATION_MODEL,
    validation_threshold = VALIDATION_THRESHOLD_SCORE,
    enable_validation = true,
  } = parameters;

  let max_validation_ideas =
    parameters.max_validation_ideas || MAX_IDEAS_TO_VALIDATE;

  if (!OPENAI_API_KEY || ideas.length === 0) {
    console.warn("No OPENAI_API_KEY or no ideas to validate");
    return ideas;
  }

  if (!enable_validation) {
    console.log("Validation disabled by parameter");
    return ideas;
  }

  // Cost-based validation optimization
  if (COST_OPTIMIZATION_ENABLED) {
    const remainingBudget = MAX_COST_PER_JOB - costTracker.totalCost;
    const estimatedValidationCost = max_validation_ideas * 0.05; // ~$0.05 per validation on average

    if (remainingBudget < estimatedValidationCost) {
      const affordableValidations = Math.floor(remainingBudget / 0.05);
      max_validation_ideas = Math.min(
        max_validation_ideas,
        Math.max(0, affordableValidations)
      );
      console.log(
        `Cost optimization: Limiting validations to ${max_validation_ideas} (budget: $${remainingBudget.toFixed(
          4
        )})`
      );
    }

    if (max_validation_ideas === 0) {
      console.log(
        "Cost optimization: Skipping validation due to budget constraints"
      );
      return ideas;
    }
  }

  // Filter ideas for validation (high-scoring ones only)
  const ideasToValidate = ideas
    .filter((idea) => idea.score >= validation_threshold)
    .slice(0, max_validation_ideas)
    .sort((a, b) => b.score - a.score);

  if (ideasToValidate.length === 0) {
    console.log(`No ideas meet validation threshold (${validation_threshold})`);
    return ideas;
  }

  console.log(
    `Validating ${ideasToValidate.length} high-scoring ideas with ${validation_model}`
  );

  const validatedIdeas = [];

  for (const idea of ideasToValidate) {
    try {
      const validationPrompt = buildValidationPrompt(idea);
      const validationResult = await callOpenAIForValidation(
        validationPrompt,
        validation_model
      );

      if (
        validationResult &&
        validationResult.ideas_analysis &&
        validationResult.ideas_analysis.length > 0
      ) {
        // Extract the first (and should be only) analysis result
        const analysis = validationResult.ideas_analysis[0];

        // Update idea with validation results
        const enhancedIdea = {
          ...idea,
          score: analysis.revised_score || idea.score,
          market_size: analysis.market_size || null,
          competition: analysis.competition || [],
          does_exist: analysis.does_exist || "uncertain",
          review_sentiment: analysis.review_sentiment || null,
          improvement_opportunities: analysis.improvement_opportunities || [],
          differentiation: analysis.differentiation || null,
          feasibility: analysis.feasibility || "uncertain",
          risks: analysis.risks || [],
          go_to_market_hint: analysis.go_to_market_hint || null,
          sanity_check: analysis.sanity_check || "uncertain",
          validated_at: new Date().toISOString(),
          validated_by_model: VALIDATION_MODEL,
        };

        validatedIdeas.push(enhancedIdea);
      } else {
        validatedIdeas.push(idea);
      }

      // Add delay between validation calls to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Validation failed for idea "${idea.name}":`, error);
      validatedIdeas.push(idea); // Keep original if validation fails
    }
  }

  // Combine validated ideas with non-validated ones
  const nonValidatedIdeas = ideas.filter(
    (idea) => idea.score < VALIDATION_THRESHOLD_SCORE
  );
  return [...validatedIdeas, ...nonValidatedIdeas];
}

function buildValidationPrompt(idea: any): { system: string; user: string } {
  const system = `You are a SaaS market analyst and venture strategist.
Your role is to evaluate SaaS product concepts with a critical, data-driven lens.

CRITICAL REQUIREMENTS:
1. Validate feasibility: Is the idea realistically buildable with today’s tech stack (APIs, integrations, LLMs, SaaS infra)?
2. Assess competition: Identify existing products/services and whether they already solve this problem.
3. Check product existence: If a similar product exists, analyze reviews/feedback (especially negative reviews).
4. Improvement potential: Suggest how a new SaaS version could outperform existing ones (UX, integrations, pricing, performance, etc.).
5. Evaluate market demand: Estimate urgency, frequency, and willingness to pay for this solution.
6. Test scalability: Does the idea serve a broad market segment or is it niche?
7. Identify risks & blind spots: Potential adoption blockers, regulatory hurdles, switching costs, or entrenched incumbents.
8. Prioritize opportunities: Re-score each idea (0–100) based on feasibility, competition, TAM/SAM, differentiation, and timing.

OUTPUT RULES:
- Return STRICT JSON only. No explanations, markdown, or prose outside the JSON.
- For each idea, keep the original name and add deeper analysis fields as shown below.
- Each array should contain 3–7 items unless data is limited. 
- If data is uncertain, clearly state "uncertain" instead of fabricating details.

Return STRICT JSON in this shape:
{
  "ideas_analysis": [
    {
      "name": "Idea name from input",
      "revised_score": 78,
      "market_size": "Estimate of TAM/SAM/SOM with reasoning",
      "competition": ["Competitor 1", "Competitor 2", "Competitor 3+"],
      "does_exist": "yes | no | uncertain",
      "review_sentiment": {
        "positive": ["theme 1", "theme 2", "theme 3+"],
        "negative": ["theme 1", "theme 2", "theme 3+"]
      },
      "improvement_opportunities": ["Improvement 1", "Improvement 2", "Improvement 3+"],
      "differentiation": "How this idea stands out or gaps it fills",
      "feasibility": "High | Medium | Low with reasoning",
      "risks": ["Risk 1", "Risk 2", "Risk 3+"],
      "go_to_market_hint": "Possible entry strategy or wedge",
      "sanity_check": "Overall verdict: viable | crowded | weak"
    }
  ]
}`;

  const user = `Validate this SaaS idea:

NAME: ${idea.name}
TARGET USER: ${idea.target_user}
ONE-LINER: ${idea.one_liner}
CORE FEATURES: ${
    Array.isArray(idea.core_features)
      ? idea.core_features.join(", ")
      : idea.core_features
  }
CURRENT SCORE: ${idea.score}
CURRENT RATIONALE: ${idea.rationale}

Perform market validation and existence check. Provide refined score and analysis.`;

  return { system, user };
}

async function callOpenAIForValidation(
  prompt: { system: string; user: string },
  model: string = VALIDATION_MODEL
): Promise<any> {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model,
            temperature: 0.2, // Lower temperature for more consistent analysis
            max_tokens: 1500,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
          }),
        },
        VALIDATION_TIMEOUT_MS
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        lastError = new Error(
          `OpenAI validation ${response.status}: ${errorText.slice(0, 300)}`
        );

        if (response.status === 429 || response.status >= 500) {
          // Retry on rate limit or server errors
          const delay = Math.min(
            EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
            MAX_EXPONENTIAL_DELAY
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        break;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();

      if (content) {
        // Track cost for validation
        const inputTokens =
          data.usage?.prompt_tokens ||
          estimateTokens(prompt.system + prompt.user);
        const outputTokens =
          data.usage?.completion_tokens || estimateTokens(content);
        const cost = trackCost(model, inputTokens, outputTokens, "validation");

        console.log(
          `Validation request cost: $${cost.toFixed(
            4
          )} (Total: $${costTracker.totalCost.toFixed(4)})`
        );

        return JSON.parse(content);
      } else {
        console.warn("Empty validation response from OpenAI");
        break;
      }
    } catch (error) {
      lastError = error;
      console.warn(
        `Validation attempt ${attempt}/${MAX_RETRIES} error:`,
        error
      );

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(
          EXPONENTIAL_BACKOFF_BASE * Math.pow(2, attempt - 1),
          MAX_EXPONENTIAL_DELAY
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error("Validation failed after all attempts:", lastError);
  return null;
}

// Deduplication functions
function calculateSimilarity(idea1: any, idea2: any): number {
  const name1 = normalizeName(idea1.name || "");
  const name2 = normalizeName(idea2.name || "");

  if (name1 === name2) return 1.0;

  const words1 = new Set(name1.split(" ").filter((w) => w.length > 2));
  const words2 = new Set(name2.split(" ").filter((w) => w.length > 2));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  const wordSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  const target1 = normalizeName(idea1.target_user || "");
  const target2 = normalizeName(idea2.target_user || "");
  const targetSimilarity = target1 === target2 ? 0.3 : 0;

  return Math.max(wordSimilarity, targetSimilarity);
}

function deduplicateIdeas(
  newIdeas: any[],
  existingIdeas: any[],
  threshold: number = 0.8
): any[] {
  const allExisting = [...existingIdeas];
  const result: any[] = [];

  for (const idea of newIdeas) {
    let isDuplicate = false;

    for (const existing of allExisting) {
      if (calculateSimilarity(idea, existing) > threshold) {
        console.log(
          `Skipping duplicate idea: "${idea.name}" (similar to existing: "${existing.name}")`
        );
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      for (const accepted of result) {
        if (calculateSimilarity(idea, accepted) > threshold) {
          console.log(
            `Skipping duplicate idea in batch: "${idea.name}" (similar to: "${accepted.name}")`
          );
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate && idea.score >= MIN_SCORE_THRESHOLD) {
      result.push(idea);
      allExisting.push(idea);
    }
  }

  return result;
}

// Main job execution function
async function executeIdeasJob(jobId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Reset cost tracker for this job
    resetCostTracker();

    await updateJobStatus(jobId, {
      status: "running",
      started_at: new Date().toISOString(),
    });

    const job = await getJob(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const { platform, days, limit } = job.parameters;
    console.log(
      `Starting ideas job ${jobId} for ${platform}, ${days} days, ${limit} limit...`
    );

    const supabase = await dbPool.getConnection();

    // Fetch summarized complaint posts
    const sinceISO = new Date(Date.now() - days * 86400000).toISOString();
    let query = supabase
      .from("posts")
      .select("id, summary, sentiment, url, created_at, platform")
      .eq("is_complaint", true)
      .lt("sentiment", -0.1)
      .not("summary", "is", null)
      .gte("created_at", sinceISO);

    // Add platform filter if not "all"
    if (platform && platform !== "all") {
      query = query.eq("platform", platform);
    }

    const { data: posts, error: postsError } = await query
      .order("sentiment", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, MAX_SUMMARIES_PER_RUN));

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      await updateJobStatus(jobId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        result: {
          message: "No summarized complaints found",
          ideas_generated: 0,
          ideas_inserted: 0,
          posts_processed: 0,
        },
      });
      return;
    }

    // Get existing ideas for deduplication
    const dedupeSinceISO = new Date(
      Date.now() - DEDUPE_LOOKBACK_DAYS * 86400000
    ).toISOString();
    const { data: existingIdeas } = await supabase
      .from("saas_idea_items")
      .select("name, target_user, name_norm")
      .gte("created_at", dedupeSinceISO);

    const existingIdeaNames = (existingIdeas || []).map(
      (idea) => `${idea.name} (Target: ${idea.target_user || "N/A"})`
    );

    // Create run header
    const { data: runData, error: runError } = await supabase
      .from("saas_idea_runs")
      .insert({
        platform: `${platform}_patterns`,
        period_days: days,
        source_limit: limit,
        notes: `Enhanced orchestrated generation from ${posts.length} posts`,
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
    let processedSummaries = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      if (Date.now() - startTime >= MAX_PROCESSING_TIME) {
        console.log("Processing time limit reached, stopping");
        break;
      }

      const chunk = chunks[chunkIndex];
      const summaryLines = chunk.map((post) => {
        const summary = extractSummaryText(post.summary)
          .replace(/\s+/g, " ")
          .trim();
        const truncated = summary.slice(0, SUMMARY_TRUNC);
        return `(${post.id}) ${truncated}${
          summary.length > SUMMARY_TRUNC ? "…" : ""
        } [${post.url || "N/A"}]`;
      });

      console.log(
        `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${
          chunk.length
        } posts...`
      );

      // Update progress
      await updateJobStatus(jobId, {
        progress: {
          current_step: `Processing chunk ${chunkIndex + 1}`,
          total_steps: chunks.length,
          completed_steps: chunkIndex,
          summaries_processed: processedSummaries,
          summaries_total: posts.length,
          current_chunk: chunkIndex + 1,
          total_chunks: chunks.length,
          ideas_generated: allIdeas.length,
          ideas_inserted: 0,
        },
      });

      try {
        const result = await generateIdeasWithReliability(
          summaryLines,
          existingIdeaNames,
          job.parameters.ideation_model || IDEATION_MODEL
        );
        const ideas = Array.isArray(result?.ideas) ? result.ideas : [];
        console.log(
          `Chunk ${chunkIndex + 1}: received ${ideas.length} raw ideas`
        );

        const deduplicatedIdeas = deduplicateIdeas(
          ideas,
          allIdeas.concat(existingIdeas || [])
        );
        console.log(
          `Chunk ${chunkIndex + 1}: ${
            deduplicatedIdeas.length
          } unique ideas after deduplication`
        );

        allIdeas.push(...deduplicatedIdeas);
        processedSummaries += chunk.length;

        // Inter-chunk delay
        if (chunkIndex < chunks.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, INTER_CHUNK_DELAY)
          );
        }
      } catch (error) {
        console.error(`Chunk ${chunkIndex + 1} failed:`, error);
      }
    }

    // Validation phase: Use gpt-4o to validate and refine high-scoring ideas
    console.log(`Starting validation phase for ${allIdeas.length} ideas...`);
    const validatedIdeas = await validateAndRefineIdeas(allIdeas, {
      validation_model: job.parameters.validation_model,
      validation_threshold: job.parameters.validation_threshold,
      max_validation_ideas: job.parameters.max_validation_ideas,
      enable_validation: job.parameters.enable_validation,
    });
    console.log(
      `Validation phase completed: ${validatedIdeas.length} ideas processed`
    );

    // Update job progress to include validation results
    const validatedCount = validatedIdeas.filter(
      (idea) => idea.validated_at
    ).length;
    await updateJobStatus(jobId, {
      progress: {
        current_step: "Validation completed",
        total_steps: chunks.length + 1,
        completed_steps: chunks.length + 1,
        summaries_processed: processedSummaries,
        summaries_total: posts.length,
        current_chunk: chunks.length,
        total_chunks: chunks.length,
        ideas_generated: allIdeas.length,
        ideas_validated: validatedCount,
        ideas_inserted: 0,
      },
    });

    // Prepare and insert ideas
    const preparedIdeas = validatedIdeas.map((idea) => {
      const postIds = Array.isArray(idea.representative_post_ids)
        ? idea.representative_post_ids
            .filter((id) => Number.isInteger(Number(id)))
            .map(Number)
        : [];

      return {
        run_id: runId,
        name: String(idea.name || "Untitled Idea"),
        name_norm: normalizeName(idea.name || ""),
        score: Math.min(100, Math.max(0, Math.round(Number(idea.score) || 0))),
        one_liner: idea.one_liner ? String(idea.one_liner) : null,
        target_user: idea.target_user ? String(idea.target_user) : null,
        core_features: Array.isArray(idea.core_features)
          ? idea.core_features.map(String)
          : [],
        why_now: idea.why_now ? String(idea.why_now) : null,
        pricing_hint: idea.pricing_hint ? String(idea.pricing_hint) : null,
        rationale: idea.rationale ? String(idea.rationale) : null,
        representative_post_ids: postIds,
        posts_in_common: postIds.length, // Number of posts that support this idea
        pattern_evidence: idea.pattern_evidence
          ? String(idea.pattern_evidence)
          : null,
        // Validation fields from gpt-4o analysis
        existence_check: idea.existence_check || null,
        market_saturation: idea.market_saturation || null,
        competitive_analysis: idea.competitive_analysis || null,
        validation_confidence: idea.validation_confidence || null,
        validated_at: idea.validated_at || null,
        validated_by_model: idea.validated_by_model || null,
        payload: {
          ...idea,
          // Store validation fields in payload until schema is updated
          validation_metadata: idea.validated_at
            ? {
                market_size: idea.market_size,
                competition: idea.competition,
                does_exist: idea.does_exist,
                review_sentiment: idea.review_sentiment,
                improvement_opportunities: idea.improvement_opportunities,
                differentiation: idea.differentiation,
                feasibility: idea.feasibility,
                risks: idea.risks,
                go_to_market_hint: idea.go_to_market_hint,
                sanity_check: idea.sanity_check,
                validated_at: idea.validated_at,
                validated_by_model: idea.validated_by_model,
              }
            : undefined,
        },
      };
    });

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

    dbPool.releaseConnection(supabase);

    const duration = Date.now() - startTime;
    const result = {
      run_id: runId,
      platform,
      period_days: days,
      source_limit: limit,
      posts_processed: processedSummaries,
      chunks_processed: chunks.length,
      raw_ideas_generated: allIdeas.length,
      ideas_validated: validatedCount,
      ideas_inserted: insertedCount,
      existing_ideas_checked: existingIdeas?.length || 0,
      validation_threshold_score: VALIDATION_THRESHOLD_SCORE,
      ideation_model: IDEATION_MODEL,
      validation_model: VALIDATION_MODEL,
      duration_ms: duration,
      duration_minutes: Math.round((duration / 60000) * 10) / 10,
      sample_ideas: preparedIdeas.slice(0, 5).map((idea) => ({
        name: idea.name,
        score: idea.score,
        target_user: idea.target_user,
      })),
      reliability_stats: {
        total_requests: reliabilityState.totalRequests,
        failed_requests: reliabilityState.failedRequests,
        rate_limit_hits: reliabilityState.rateLimitHits,
        circuit_breaker_open: reliabilityState.circuitBreakerOpen,
        fallback_mode: reliabilityState.fallbackMode,
      },
      cost_breakdown: {
        total_cost: Number(costTracker.totalCost.toFixed(4)),
        ideation_cost: Number(costTracker.ideationCost.toFixed(4)),
        validation_cost: Number(costTracker.validationCost.toFixed(4)),
        cost_per_idea: Number(
          (costTracker.totalCost / Math.max(1, allIdeas.length)).toFixed(4)
        ),
        request_counts: costTracker.requestCounts,
        token_usage: costTracker.tokenCounts,
        cost_limit: MAX_COST_PER_JOB,
        cost_optimization_enabled: COST_OPTIMIZATION_ENABLED,
      },
    };

    await updateJobStatus(jobId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      result: result,
    });

    console.log(`Ideas job ${jobId} completed:`, result);
  } catch (error) {
    console.error(`Ideas job ${jobId} failed:`, error);

    await updateJobStatus(jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error: String(error),
    });

    throw error;
  } finally {
    dbPool.cleanup();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const url = new URL(req.url);

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error:
            "Only POST requests are supported for triggering idea generation jobs",
        }),
        {
          status: 405,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    // Security checks
    const clientIP = getClientIP(req);
    console.log(`Ideas orchestrator request from IP: ${clientIP}`);

    const rateLimitCheck = checkRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Maximum 2 requests per minute.",
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }

    // Optional API key check
    if (IDEAS_API_KEY) {
      const providedKey =
        req.headers.get("x-api-key") || url.searchParams.get("api_key");
      if (providedKey !== IDEAS_API_KEY) {
        console.warn(`Invalid API key from IP: ${clientIP}`);
        return new Response(
          JSON.stringify({
            error: "Invalid or missing API key",
          }),
          {
            status: 401,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create new ideas job
    const jobId = generateJobId();
    const nowISO = new Date().toISOString();

    // Parse parameters
    const jobParameters = {
      platform: url.searchParams.get("platform") || "all",
      days: parseInt(url.searchParams.get("days") || String(DEFAULT_DAYS)),
      limit: parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT)),
      chunk_size: parseInt(
        url.searchParams.get("chunk_size") || String(CHUNK_SIZE)
      ),
      // Model configuration parameters
      ideation_model: url.searchParams.get("ideation_model") || IDEATION_MODEL,
      validation_model:
        url.searchParams.get("validation_model") || VALIDATION_MODEL,
      validation_threshold: parseInt(
        url.searchParams.get("validation_threshold") ||
          String(VALIDATION_THRESHOLD_SCORE)
      ),
      max_validation_ideas: parseInt(
        url.searchParams.get("max_validation_ideas") ||
          String(MAX_IDEAS_TO_VALIDATE)
      ),
      enable_validation: url.searchParams.get("enable_validation") !== "false", // Default true
    };

    const job: IdeasJob = {
      id: jobId,
      status: "pending",
      created_at: nowISO,
      parameters: jobParameters,
    };

    await createJob(job);

    console.log(`Created ideas job ${jobId} with parameters:`, jobParameters);

    // Execute the job in the background (fire and forget)
    executeIdeasJob(jobId).catch((error) => {
      console.error(`Background ideas job ${jobId} failed:`, error);
    });

    // Return immediately with job ID
    return new Response(
      JSON.stringify({
        status: "triggered",
        message: "SaaS idea generation job has been triggered successfully",
        architecture: "orchestrated_ideas",
        job_id: jobId,
        created_at: nowISO,
        parameters: jobParameters,
        status_url: `${url.origin}/functions/v1/job-status?job_id=${jobId}`,
        function_info: {
          version: FUNCTION_VERSION,
          last_updated: LAST_UPDATED,
          orchestrator: true,
        },
      }),
      {
        status: 202,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Ideas orchestrator trigger error:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        error: String(error),
        message: "Failed to trigger idea generation job",
        function_info: {
          version: FUNCTION_VERSION,
          last_updated: LAST_UPDATED,
          orchestrator: true,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});
