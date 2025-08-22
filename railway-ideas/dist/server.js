"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "50mb" }));
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IDEATION_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const FALLBACK_MODEL = "gpt-3.5-turbo";
const MAX_RETRIES = 5;
const MIN_SCORE_THRESHOLD = 30;
const RATE_LIMIT_DELAY_BASE = 60000;
const MAX_CLUSTERS_PER_BATCH = 5;
const AUTOMATION_SCORE_BOOST = 15;
const INTEGRATION_SCORE_BOOST = 12;
const REPORTING_SCORE_BOOST = 10;
const COMPLIANCE_SCORE_BOOST = 8;
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
async function updateJobStatus(jobId, updates) {
    try {
        const { error } = await supabase
            .from("ideas_jobs")
            .update(updates)
            .eq("id", jobId);
        if (error)
            console.error(`Failed to update job ${jobId}:`, error);
    }
    catch (error) {
        console.error(`Error updating job ${jobId}:`, error);
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length)
        return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
function calculateCentroid(embeddings) {
    if (embeddings.length === 0)
        return [];
    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);
    for (const embedding of embeddings) {
        for (let i = 0; i < dimensions; i++) {
            centroid[i] += embedding[i];
        }
    }
    for (let i = 0; i < dimensions; i++) {
        centroid[i] /= embeddings.length;
    }
    return centroid;
}
function isSaaSOpportunityPost(post) {
    const title = (post.title || "").toLowerCase();
    const body = (post.body || "").toLowerCase();
    const content = `${title} ${body}`;
    const signals = [];
    let opportunityType = "unknown";
    let isOpportunity = false;
    if (post.is_complaint && post.sentiment < -0.1) {
        isOpportunity = true;
        opportunityType = "complaint";
        signals.push("Negative sentiment complaint");
    }
    const wishlistKeywords = [
        "wish there was", "looking for", "need a tool", "wish someone built",
        "does anyone know", "is there a", "any recommendations for",
        "what tool do you use", "how do you handle", "best way to",
        "feature request", "would love to see", "missing feature"
    ];
    const wishlistMatches = wishlistKeywords.filter((keyword) => content.includes(keyword));
    if (wishlistMatches.length > 0) {
        isOpportunity = true;
        opportunityType = "feature_request";
        signals.push(`Feature request: ${wishlistMatches.join(", ")}`);
    }
    const diyKeywords = [
        "i built", "i created", "my script", "my solution", "i made",
        "wrote a", "custom tool", "automation i", "workflow i",
        "here is how i", "i solve this by", "my approach"
    ];
    const diyMatches = diyKeywords.filter((keyword) => content.includes(keyword));
    if (diyMatches.length > 0) {
        isOpportunity = true;
        opportunityType = "diy_solution";
        signals.push(`DIY solution: ${diyMatches.join(", ")}`);
    }
    const gapKeywords = [
        "missing", "lacks", "doesnt have", "wish it had", "except for",
        "but it doesnt", "only issue", "if only it", "would be perfect if",
        "needs better", "could improve"
    ];
    const gapMatches = gapKeywords.filter((keyword) => content.includes(keyword));
    if (gapMatches.length > 0 && post.sentiment > -0.5) {
        isOpportunity = true;
        opportunityType = "tool_gap";
        signals.push(`Tool gap: ${gapMatches.join(", ")}`);
    }
    const researchKeywords = [
        "what tools", "how do you", "best practices", "recommendations",
        "what software", "how does your team", "workflow for",
        "process for", "tools for", "software for"
    ];
    const researchMatches = researchKeywords.filter((keyword) => content.includes(keyword));
    if (researchMatches.length > 0 && !isOpportunity) {
        isOpportunity = true;
        opportunityType = "market_research";
        signals.push(`Market research: ${researchMatches.join(", ")}`);
    }
    const businessKeywords = [
        "workflow", "process", "automation", "integration", "crm", "erp",
        "project management", "team collaboration", "reporting", "dashboard"
    ];
    const businessMatches = businessKeywords.filter((keyword) => content.includes(keyword));
    if (businessMatches.length >= 2 && !isOpportunity) {
        isOpportunity = true;
        opportunityType = "business_process";
        signals.push(`Business process: ${businessMatches.join(", ")}`);
    }
    return { isOpportunity, opportunityType, signals };
}
function clusterPostsBySimilarity(posts, similarityThreshold, minClusterSize) {
    const postsWithEmbeddings = posts.filter((post) => {
        if (!post.embedding)
            return false;
        if (typeof post.embedding === "string") {
            try {
                post.embedding = JSON.parse(post.embedding);
            }
            catch (e) {
                console.warn(`Failed to parse embedding for post ${post.id}:`, e);
                return false;
            }
        }
        return Array.isArray(post.embedding) && post.embedding.length > 0;
    });
    console.log(`Clustering ${postsWithEmbeddings.length} posts with embeddings`);
    console.log(`Using similarity threshold: ${similarityThreshold}, min cluster size: ${minClusterSize}`);
    if (postsWithEmbeddings.length < minClusterSize) {
        console.log(`Not enough posts with embeddings for clustering`);
        return [];
    }
    const clusters = [];
    const processed = new Set();
    for (let i = 0; i < postsWithEmbeddings.length; i++) {
        if (processed.has(i))
            continue;
        const seedPost = postsWithEmbeddings[i];
        const clusterPosts = [seedPost];
        processed.add(i);
        console.log(`Starting cluster with seed post ${seedPost.id}`);
        let foundNew = true;
        while (foundNew) {
            foundNew = false;
            for (let j = 0; j < postsWithEmbeddings.length; j++) {
                if (processed.has(j))
                    continue;
                const candidatePost = postsWithEmbeddings[j];
                let maxSimilarity = 0;
                let bestMatch = null;
                for (const clusterPost of clusterPosts) {
                    const similarity = cosineSimilarity(clusterPost.embedding, candidatePost.embedding);
                    if (similarity > maxSimilarity) {
                        maxSimilarity = similarity;
                        bestMatch = clusterPost;
                    }
                }
                if (maxSimilarity >= similarityThreshold) {
                    console.log(`Found similar post ${candidatePost.id} with similarity ${maxSimilarity.toFixed(4)} to post ${bestMatch?.id}`);
                    clusterPosts.push(candidatePost);
                    processed.add(j);
                    foundNew = true;
                }
            }
        }
        console.log(`Cluster expanded to ${clusterPosts.length} posts using iterative clustering`);
        if (clusterPosts.length >= minClusterSize) {
            console.log(`Creating cluster with ${clusterPosts.length} posts`);
            const embeddings = clusterPosts.map((post) => post.embedding);
            const centroid = calculateCentroid(embeddings);
            const sortedPosts = clusterPosts.sort((a, b) => a.sentiment - b.sentiment);
            const representativePosts = sortedPosts;
            clusters.push({
                id: `cluster_${clusters.length + 1}`,
                posts: clusterPosts,
                centroid,
                size: clusterPosts.length,
                representative_posts: representativePosts,
                theme_summary: `Cluster of ${clusterPosts.length} similar posts`,
            });
        }
    }
    clusters.sort((a, b) => b.size - a.size);
    console.log(`Created ${clusters.length} clusters with sizes: ${clusters
        .map((c) => c.size)
        .join(", ")}`);
    return clusters;
}
async function generateClusterTheme(cluster) {
    if (!OPENAI_API_KEY) {
        return `Cluster of ${cluster.size} similar complaints`;
    }
    const samplePosts = cluster.representative_posts.slice(0, 10);
    const postTexts = samplePosts.map(post => {
        const content = `${post.title || ""}\n${post.body || ""}`.slice(0, 400);
        return content.replace(/\s+/g, ' ').trim();
    }).join('\n\n');
    const prompt = `Analyze these similar complaint posts and create a 1-sentence theme description:

${postTexts}

Return ONLY a concise theme description (10-15 words) that captures the common complaint pattern.`;
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                temperature: 0.3,
                max_tokens: 100,
                messages: [
                    { role: "user", content: prompt }
                ],
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
        }
        const data = await response.json();
        const theme = data?.choices?.[0]?.message?.content?.trim();
        if (theme) {
            return theme;
        }
        else {
            return `Cluster of ${cluster.size} similar complaints`;
        }
    }
    catch (error) {
        console.warn(`Theme generation failed for cluster ${cluster.id}:`, error);
        return `Cluster of ${cluster.size} similar complaints`;
    }
}
function buildEnhancedPrompt(cluster, existingIdeas) {
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
      "representative_post_ids": [${cluster.representative_posts.map((p) => p.id).join(', ')}],
      "pattern_evidence": "Description of the common pattern across this cluster",
      "similar_to": "List of existing similar products or solutions in the market",
      "gaps_filled": "Specific gaps or limitations in existing solutions that this idea addresses",
      "does_not_exist": "Explanation of how this idea differs from or improves upon existing solutions"
    }
  ]
}`;
    const postTexts = cluster.representative_posts.map((post) => {
        const content = `${post.title || ""}\n\n${post.body || ""}`.replace(/\s+/g, " ").trim();
        const truncated = content.slice(0, 500);
        return `(${post.id}) ${truncated}${content.length > 500 ? "…" : ""} [${post.url || 'N/A'}]`;
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
async function callOpenAI(system, user, retryWithFallback = true) {
    if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY not configured");
    }
    const modelsToTry = [IDEATION_MODEL];
    if (retryWithFallback && IDEATION_MODEL !== FALLBACK_MODEL) {
        modelsToTry.push(FALLBACK_MODEL);
    }
    for (const model of modelsToTry) {
        console.log(`Trying OpenAI model: ${model}`);
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: model,
                        temperature: 0.4,
                        max_tokens: model === FALLBACK_MODEL ? 2000 : 3000,
                        response_format: { type: "json_object" },
                        messages: [
                            { role: "system", content: system },
                            { role: "user", content: user },
                        ],
                    }),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`OpenAI ${response.status}: ${errorText}`);
                    if (response.status === 429) {
                        console.warn(`Rate limited on ${model}, attempt ${attempt}/${MAX_RETRIES}`);
                        let waitTime = RATE_LIMIT_DELAY_BASE * attempt;
                        try {
                            const errorData = JSON.parse(errorText);
                            const errorMsg = errorData?.error?.message || "";
                            const waitMatch = errorMsg.match(/Please try again in ([\d.]+)s/);
                            if (waitMatch) {
                                waitTime = Math.max(parseFloat(waitMatch[1]) * 1000 + 5000, waitTime);
                            }
                            if (errorMsg.includes("requests per day")) {
                                console.error(`Daily rate limit exceeded for ${model}`);
                                if (model !== FALLBACK_MODEL && modelsToTry.length > 1) {
                                    console.log(`Switching to fallback model: ${FALLBACK_MODEL}`);
                                    break;
                                }
                                throw new Error(`Daily rate limit exceeded for all models. Please try again tomorrow or upgrade your OpenAI plan.`);
                            }
                        }
                        catch (parseError) {
                        }
                        if (attempt < MAX_RETRIES) {
                            console.log(`Waiting ${Math.round(waitTime / 1000)}s before retry...`);
                            await sleep(waitTime);
                            continue;
                        }
                    }
                    throw error;
                }
                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content?.trim();
                if (content) {
                    console.log(`Successfully generated ideas using ${model}`);
                    return JSON.parse(content);
                }
                else {
                    throw new Error("Empty response from OpenAI");
                }
            }
            catch (error) {
                const isRateLimit = error instanceof Error && error.message.includes("429");
                console.warn(`${model} attempt ${attempt}/${MAX_RETRIES} failed:`, error);
                if (attempt === MAX_RETRIES) {
                    if (isRateLimit && model !== FALLBACK_MODEL && modelsToTry.length > 1) {
                        console.log(`Max retries reached for ${model}, trying fallback...`);
                        break;
                    }
                    throw error;
                }
                if (!isRateLimit) {
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    await sleep(delay);
                }
            }
        }
    }
    throw new Error("All OpenAI models exhausted");
}
function analyzeWorkflowOpportunity(idea) {
    const ideaText = `${idea.name || ""} ${idea.one_liner || ""} ${idea.rationale || ""} ${JSON.stringify(idea.core_features || [])}`.toLowerCase();
    let scoreBoost = 0;
    let automationCategory = null;
    const automationSignals = [];
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
        if (!automationCategory)
            automationCategory = 'integration_platform';
        automationSignals.push(`Integration opportunity: ${integrationMatches.join(', ')} between ${systemMatches.join(', ')}`);
    }
    const reportingKeywords = [
        'report', 'dashboard', 'analytic', 'metric', 'kpi', 'visibility', 'insight',
        'track', 'monitor', 'measure', 'visualiz', 'chart', 'graph'
    ];
    const reportingMatches = reportingKeywords.filter(keyword => ideaText.includes(keyword));
    if (reportingMatches.length > 0) {
        scoreBoost += REPORTING_SCORE_BOOST;
        if (!automationCategory)
            automationCategory = 'reporting_dashboard';
        automationSignals.push(`Reporting/visibility: ${reportingMatches.join(', ')}`);
    }
    const complianceKeywords = [
        'compliance', 'audit', 'regulatory', 'govern', 'policy', 'rule',
        'approval', 'permission', 'access control', 'security', 'gdpr', 'hipaa'
    ];
    const complianceMatches = complianceKeywords.filter(keyword => ideaText.includes(keyword));
    if (complianceMatches.length > 0) {
        scoreBoost += COMPLIANCE_SCORE_BOOST;
        if (!automationCategory)
            automationCategory = 'compliance_automation';
        automationSignals.push(`Compliance/audit: ${complianceMatches.join(', ')}`);
    }
    const processKeywords = [
        'process', 'procedure', 'checklist', 'template', 'standardiz', 'optimize'
    ];
    const processMatches = processKeywords.filter(keyword => ideaText.includes(keyword));
    if (processMatches.length > 0 && scoreBoost === 0) {
        scoreBoost += 5;
        automationCategory = 'process_optimization';
        automationSignals.push(`Process improvement: ${processMatches.join(', ')}`);
    }
    return { score_boost: scoreBoost, automation_category: automationCategory, automation_signals: automationSignals };
}
function normalizeName(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
async function generateIdeasFromPosts(parameters) {
    const startTime = Date.now();
    const jobId = parameters.job_id;
    console.log(`Starting complete ideas generation for job ${jobId}`);
    await updateJobStatus(jobId, {
        status: "running",
        started_at: new Date().toISOString(),
        progress: {
            current_step: "Fetching posts with embeddings",
            total_steps: 5,
            completed_steps: 0,
        },
    });
    const sinceISO = new Date(Date.now() - (parameters.days || 14) * 86400000).toISOString();
    let query = supabase
        .from("posts")
        .select("id, title, body, sentiment, url, created_at, platform, embedding, is_complaint")
        .not("title", "is", null)
        .not("body", "is", null)
        .not("embedding", "is", null)
        .gte("created_at", sinceISO);
    if (parameters.platform && parameters.platform !== "all") {
        query = query.eq("platform", parameters.platform);
    }
    const { data: rawPosts, error: postsError } = await query
        .order("created_at", { ascending: false })
        .limit(parameters.limit || 1000);
    if (postsError || !rawPosts) {
        throw new Error(`Failed to fetch posts: ${postsError?.message}`);
    }
    console.log(`Fetched ${rawPosts.length} posts`);
    await updateJobStatus(jobId, {
        progress: {
            current_step: "Filtering for SaaS opportunities",
            total_steps: 5,
            completed_steps: 1,
            posts_fetched: rawPosts.length,
        },
    });
    const opportunityPosts = [];
    const opportunityStats = {
        complaint: 0,
        feature_request: 0,
        diy_solution: 0,
        tool_gap: 0,
        market_research: 0,
        business_process: 0,
    };
    for (const post of rawPosts) {
        const analysis = isSaaSOpportunityPost(post);
        if (analysis.isOpportunity) {
            opportunityPosts.push({
                ...post,
                opportunity_type: analysis.opportunityType,
                opportunity_signals: analysis.signals,
            });
            opportunityStats[analysis.opportunityType]++;
        }
    }
    console.log(`Found ${opportunityPosts.length} opportunity posts:`, opportunityStats);
    if (opportunityPosts.length === 0) {
        await updateJobStatus(jobId, {
            status: "completed",
            completed_at: new Date().toISOString(),
            result: {
                message: "No SaaS opportunity posts found",
                ideas_generated: 0,
            },
        });
        return { ideas: [], clusters_processed: 0, posts_processed: rawPosts.length };
    }
    await updateJobStatus(jobId, {
        progress: {
            current_step: "Performing semantic clustering",
            total_steps: 5,
            completed_steps: 2,
            posts_found: opportunityPosts.length,
        },
    });
    const clusters = clusterPostsBySimilarity(opportunityPosts, parameters.similarity_threshold || 0.5, parameters.min_cluster_size || 2);
    console.log(`Created ${clusters.length} clusters`);
    if (clusters.length === 0) {
        await updateJobStatus(jobId, {
            status: "completed",
            completed_at: new Date().toISOString(),
            result: {
                message: `No clusters found with threshold ${parameters.similarity_threshold || 0.6} and min size ${parameters.min_cluster_size || 3}`,
                ideas_generated: 0,
            },
        });
        return { ideas: [], clusters_processed: 0, posts_processed: rawPosts.length };
    }
    await updateJobStatus(jobId, {
        progress: {
            current_step: "Generating cluster themes",
            total_steps: 5,
            completed_steps: 3,
            clusters_found: clusters.length,
        },
    });
    console.log(`Generating themes for ${clusters.length} clusters in batches...`);
    for (let i = 0; i < clusters.length; i += MAX_CLUSTERS_PER_BATCH) {
        const batch = clusters.slice(i, i + MAX_CLUSTERS_PER_BATCH);
        console.log(`Processing theme batch ${Math.floor(i / MAX_CLUSTERS_PER_BATCH) + 1}/${Math.ceil(clusters.length / MAX_CLUSTERS_PER_BATCH)} (${batch.length} clusters)`);
        const themePromises = batch.map(async (cluster) => {
            try {
                cluster.theme_summary = await generateClusterTheme(cluster);
                console.log(`Generated theme for ${cluster.id}: ${cluster.theme_summary}`);
            }
            catch (error) {
                console.warn(`Failed to generate theme for ${cluster.id}:`, error);
                cluster.theme_summary = `Cluster of ${cluster.size} similar posts`;
            }
        });
        await Promise.all(themePromises);
        if (i + MAX_CLUSTERS_PER_BATCH < clusters.length) {
            console.log('Waiting 30s between theme generation batches...');
            await sleep(30000);
        }
    }
    await updateJobStatus(jobId, {
        progress: {
            current_step: "Generating ideas from clusters",
            total_steps: 5,
            completed_steps: 4,
            clusters_with_themes: clusters.length,
        },
    });
    const { data: existingIdeas } = await supabase
        .from("saas_idea_items")
        .select("name, target_user")
        .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString())
        .limit(100);
    const existingIdeaNames = (existingIdeas || []).map(idea => `${idea.name} (Target: ${idea.target_user || 'N/A'})`);
    const allIdeas = [];
    console.log(`Processing ${clusters.length} clusters for idea generation in batches...`);
    for (let batchStart = 0; batchStart < clusters.length; batchStart += MAX_CLUSTERS_PER_BATCH) {
        const batchEnd = Math.min(batchStart + MAX_CLUSTERS_PER_BATCH, clusters.length);
        const currentBatch = clusters.slice(batchStart, batchEnd);
        console.log(`Processing idea generation batch ${Math.floor(batchStart / MAX_CLUSTERS_PER_BATCH) + 1}/${Math.ceil(clusters.length / MAX_CLUSTERS_PER_BATCH)} (clusters ${batchStart + 1}-${batchEnd})`);
        for (let i = 0; i < currentBatch.length; i++) {
            const clusterIndex = batchStart + i;
            const cluster = currentBatch[i];
            console.log(`Processing cluster ${clusterIndex + 1}/${clusters.length}: ${cluster.theme_summary} (${cluster.size} posts)`);
            await updateJobStatus(jobId, {
                progress: {
                    current_step: `Generating ideas from cluster ${clusterIndex + 1}/${clusters.length}`,
                    total_steps: 5,
                    completed_steps: 4,
                    clusters_processed: clusterIndex,
                },
            });
            try {
                const { system, user } = buildEnhancedPrompt(cluster, existingIdeaNames);
                const result = await callOpenAI(system, user);
                const ideas = Array.isArray(result?.ideas) ? result.ideas : [];
                console.log(`Cluster ${clusterIndex + 1}: Generated ${ideas.length} raw ideas`);
                const enhancedIdeas = ideas.map((idea) => {
                    const baseIdea = {
                        ...idea,
                        cluster_id: cluster.id,
                        cluster_theme: cluster.theme_summary,
                        cluster_size: cluster.size
                    };
                    if (parameters.enable_automation_boost !== false) {
                        const automationAnalysis = analyzeWorkflowOpportunity(baseIdea);
                        baseIdea.score = (baseIdea.score || 0) + automationAnalysis.score_boost;
                        baseIdea.automation_category = automationAnalysis.automation_category;
                        baseIdea.automation_signals = automationAnalysis.automation_signals;
                        baseIdea.original_score = idea.score;
                        baseIdea.automation_boost = automationAnalysis.score_boost;
                    }
                    return baseIdea;
                });
                const filteredIdeas = enhancedIdeas.filter((idea) => idea.score >= MIN_SCORE_THRESHOLD);
                console.log(`Cluster ${clusterIndex + 1}: ${filteredIdeas.length} ideas above threshold`);
                allIdeas.push(...filteredIdeas);
            }
            catch (error) {
                console.error(`Cluster ${clusterIndex + 1} processing failed:`, error);
                if (error instanceof Error && error.message.includes('Daily rate limit exceeded')) {
                    console.warn(`OpenAI daily rate limit reached. Stopping further processing.`);
                    await updateJobStatus(jobId, {
                        status: "completed",
                        completed_at: new Date().toISOString(),
                        result: {
                            message: `Partial completion due to OpenAI rate limits. Processed ${clusterIndex}/${clusters.length} clusters.`,
                            ideas_generated: allIdeas.length,
                            clusters_processed: clusterIndex,
                            rate_limited: true,
                            suggestion: "Try again tomorrow or upgrade OpenAI plan for higher limits"
                        },
                    });
                    return { ideas: allIdeas, clusters_processed: clusterIndex, posts_processed: rawPosts.length };
                }
            }
            if (i < currentBatch.length - 1) {
                await sleep(5000);
            }
        }
        if (batchEnd < clusters.length) {
            console.log(`Completed batch ${Math.floor(batchStart / MAX_CLUSTERS_PER_BATCH) + 1}/${Math.ceil(clusters.length / MAX_CLUSTERS_PER_BATCH)}, waiting 60s before next batch...`);
            await sleep(60000);
        }
    }
    console.log(`Generated ${allIdeas.length} total ideas from ${clusters.length} clusters`);
    return { ideas: allIdeas, clusters_processed: clusters.length, posts_processed: rawPosts.length };
}
async function storeIdeas(ideas, parameters) {
    const { data: runData, error: runError } = await supabase
        .from("saas_idea_runs")
        .insert({
        platform: parameters.platform || "all",
        period_days: parameters.days || 14,
        source_limit: parameters.limit || 1000,
        notes: `Railway-generated from ${ideas.length} ideas (unlimited processing)`,
    })
        .select("id, created_at")
        .single();
    if (runError || !runData) {
        throw new Error(`Failed to create run: ${runError?.message}`);
    }
    const runId = runData.id;
    console.log(`Created run ${runId} for ${ideas.length} ideas`);
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
            ? idea.representative_post_ids.filter((id) => Number.isInteger(Number(id))).map(Number)
            : [],
        posts_in_common: Array.isArray(idea.representative_post_ids) ? idea.representative_post_ids.length : 0,
        confidence_level: 'high',
        pattern_evidence: idea.pattern_evidence ? String(idea.pattern_evidence) : null,
        payload: idea
    }));
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
            throw insertError;
        }
        else {
            insertedCount = insertedIdeas?.length || 0;
        }
    }
    console.log(`Inserted ${insertedCount} ideas into database`);
    return { run_id: runId, inserted_count: insertedCount };
}
app.get("/", (req, res) => {
    res.json({
        service: "Railway Ideas Service",
        version: "1.0.0",
        platform: "Railway",
        status: "running",
        capabilities: [
            "Unlimited post processing",
            "Unlimited cluster processing",
            "No timeout restrictions",
            "Complete ideas pipeline",
            "Advanced workflow automation detection"
        ],
        endpoints: {
            health: "/health",
            ideas: "/generate-ideas",
        },
    });
});
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});
app.post("/generate-ideas", async (req, res) => {
    const startTime = Date.now();
    const jobId = req.body.job_id || `railway_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    try {
        console.log(`Starting ideas generation for job ${jobId}`);
        console.log('Parameters:', req.body);
        const { error: jobCreateError } = await supabase
            .from("ideas_jobs")
            .upsert({
            id: jobId,
            status: "pending",
            created_at: new Date().toISOString(),
            parameters: req.body,
        }, {
            onConflict: "id",
            ignoreDuplicates: false
        });
        if (jobCreateError) {
            console.warn("Job creation warning:", jobCreateError);
        }
        const result = await generateIdeasFromPosts({
            ...req.body,
            job_id: jobId,
        });
        if (result.ideas.length === 0) {
            await updateJobStatus(jobId, {
                status: "completed",
                completed_at: new Date().toISOString(),
                result: {
                    message: "No ideas generated above threshold",
                    ideas_generated: 0,
                    clusters_processed: result.clusters_processed,
                    posts_processed: result.posts_processed,
                },
            });
            const duration = Date.now() - startTime;
            return res.json({
                success: true,
                message: "No ideas generated above threshold",
                job_id: jobId,
                ideas_generated: 0,
                clusters_processed: result.clusters_processed,
                posts_processed: result.posts_processed,
                duration_ms: duration,
                platform_info: {
                    name: "railway",
                    service: "ideas-generation",
                    version: "1.0.0",
                    unlimited: true,
                },
            });
        }
        await updateJobStatus(jobId, {
            progress: {
                current_step: "Storing ideas in database",
                total_steps: 5,
                completed_steps: 4,
                ideas_generated: result.ideas.length,
            },
        });
        const { run_id, inserted_count } = await storeIdeas(result.ideas, req.body);
        const duration = Date.now() - startTime;
        await updateJobStatus(jobId, {
            status: "completed",
            completed_at: new Date().toISOString(),
            result: {
                ideas_generated: result.ideas.length,
                ideas_inserted: inserted_count,
                clusters_processed: result.clusters_processed,
                posts_processed: result.posts_processed,
                run_id: run_id,
                duration_ms: duration,
            },
        });
        return res.json({
            success: true,
            message: `Successfully generated ${result.ideas.length} ideas from ${result.clusters_processed} clusters`,
            job_id: jobId,
            run_id: run_id,
            ideas_generated: result.ideas.length,
            ideas_inserted: inserted_count,
            clusters_processed: result.clusters_processed,
            posts_processed: result.posts_processed,
            duration_ms: duration,
            duration_readable: `${Math.round(duration / 1000)}s`,
            platform_info: {
                name: "railway",
                service: "ideas-generation",
                version: "1.0.0",
                unlimited: true,
                limits_removed: [
                    "No 8-minute timeout",
                    "No 15-post representative limit",
                    "No 8-cluster processing limit",
                    "No memory constraints",
                    "Uses all available posts and clusters"
                ]
            },
        });
    }
    catch (error) {
        console.error("Ideas generation error:", error);
        const duration = Date.now() - startTime;
        await updateJobStatus(jobId, {
            status: "failed",
            completed_at: new Date().toISOString(),
            error: String(error),
        });
        return res.status(500).json({
            success: false,
            error: String(error),
            job_id: jobId,
            duration_ms: duration,
            platform_info: {
                name: "railway",
                service: "ideas-generation",
                version: "1.0.0",
                unlimited: true,
            },
        });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Railway Ideas Service running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🎯 Features: Unlimited processing, no timeouts, complete pipeline`);
    console.log(`💡 Endpoints:`);
    console.log(`   - Health: http://localhost:${PORT}/health`);
    console.log(`   - Ideas: http://localhost:${PORT}/generate-ideas`);
});
exports.default = app;
