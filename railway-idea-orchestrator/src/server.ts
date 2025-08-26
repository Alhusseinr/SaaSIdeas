// Railway Ideas Service - Complete SaaS ideas pipeline without limits
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Configuration - Smart rate limiting
const IDEATION_MODEL = process.env.OPENAI_MODEL || "gpt-4o"; // Stronger model for better ideas
const FALLBACK_MODEL = "gpt-4o-mini"; // Better fallback than 3.5-turbo
const MAX_RETRIES = 5; // More retries for rate limits
const MIN_SCORE_THRESHOLD = 30;
const RATE_LIMIT_DELAY_BASE = 60000; // 1 minute base delay
const MAX_CLUSTERS_PER_BATCH = 50; // Process clusters in smaller batches

// Workflow automation scoring
const AUTOMATION_SCORE_BOOST = 15;
const INTEGRATION_SCORE_BOOST = 12;
const REPORTING_SCORE_BOOST = 10;
const COMPLIANCE_SCORE_BOOST = 8;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

interface PostData {
  id: number;
  title: string | null;
  body: string | null;
  sentiment: number;
  url: string | null;
  created_at: string;
  platform: string;
  embedding: number[];
  is_complaint: boolean;
  saas_score?: number | null;
  pain_points?: string[] | null;
  similarity_scores?: Array<{ post_id: number; score: number }> | null;
  opportunity_type?: string;
  opportunity_signals?: string[];
}

interface PostCluster {
  id: string;
  posts: PostData[];
  centroid: number[];
  size: number;
  representative_posts: PostData[];
  theme_summary: string;
}

async function updateJobStatus(jobId: string, updates: any): Promise<void> {
  try {
    const { error } = await supabase
      .from("ideas_jobs")
      .update(updates)
      .eq("id", jobId);
    if (error) console.error(`Failed to update job ${jobId}:`, error);
  } catch (error) {
    console.error(`Error updating job ${jobId}:`, error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

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

function generateClusterInsights(cluster: PostCluster): string {
  const posts = cluster.representative_posts;

  // Calculate SaaS score statistics
  const saasScores = posts
    .map((p) => p.saas_score)
    .filter((score) => score !== null && score !== undefined) as number[];

  const avgSaasScore =
    saasScores.length > 0
      ? Math.round(saasScores.reduce((a, b) => a + b, 0) / saasScores.length)
      : 0;
  const maxSaasScore = saasScores.length > 0 ? Math.max(...saasScores) : 0;
  const highScorePosts = saasScores.filter((score) => score >= 60).length;

  // Analyze pain points frequency
  const painPointFreq = new Map<string, number>();
  posts.forEach((post) => {
    if (post.pain_points) {
      post.pain_points.forEach((pain) => {
        const normalized = pain.toLowerCase().trim();
        painPointFreq.set(normalized, (painPointFreq.get(normalized) || 0) + 1);
      });
    }
  });

  // Get most common pain points (appearing in 2+ posts)
  const commonPainPoints = Array.from(painPointFreq.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pain, count]) => `"${pain}" (${count} posts)`);

  // Analyze opportunity types
  const opportunityTypes = new Map<string, number>();
  posts.forEach((post) => {
    if (post.opportunity_type) {
      opportunityTypes.set(
        post.opportunity_type,
        (opportunityTypes.get(post.opportunity_type) || 0) + 1
      );
    }
  });

  const topOpportunityTypes = Array.from(opportunityTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${type} (${count} posts)`);

  return `
- Cluster Size: ${posts.length} posts (using ${Math.min(
    25,
    posts.length
  )} for idea generation)
- Average SaaS Score: ${avgSaasScore}/100 (Max: ${maxSaasScore})
- High-Potential Posts: ${highScorePosts}/${posts.length} posts with score ≥60
- Most Common Pain Points: ${
    commonPainPoints.length > 0
      ? commonPainPoints.join(", ")
      : "None identified"
  }
- Opportunity Types: ${
    topOpportunityTypes.length > 0
      ? topOpportunityTypes.join(", ")
      : "Mixed types"
  }
- Posts with Structured Data: ${
    posts.filter((p) => p.saas_score || p.pain_points?.length).length
  }/${posts.length}
`.trim();
}

function determineSaaSOpportunityType(post: PostData): string {
  // Determine opportunity type based on pain_points and other signals
  const painPoints = post.pain_points || [];
  const content = `${post.title || ""} ${post.body || ""}`.toLowerCase();

  // Check for workflow automation signals
  const workflowSignals = [
    "automation",
    "workflow",
    "manual",
    "repetitive",
    "process",
  ];
  if (
    painPoints.some((p) =>
      workflowSignals.some((s) => p.toLowerCase().includes(s))
    ) ||
    workflowSignals.some((s) => content.includes(s))
  ) {
    return "workflow_automation";
  }

  // Check for integration needs
  const integrationSignals = [
    "integration",
    "connect",
    "sync",
    "api",
    "data flow",
  ];
  if (
    painPoints.some((p) =>
      integrationSignals.some((s) => p.toLowerCase().includes(s))
    ) ||
    integrationSignals.some((s) => content.includes(s))
  ) {
    return "integration_platform";
  }

  // Check for compliance/security
  const complianceSignals = ["compliance", "security", "audit", "regulation"];
  if (
    painPoints.some((p) =>
      complianceSignals.some((s) => p.toLowerCase().includes(s))
    ) ||
    complianceSignals.some((s) => content.includes(s))
  ) {
    return "compliance_tool";
  }

  // Check for analytics/reporting
  const analyticsSignals = [
    "analytics",
    "reporting",
    "dashboard",
    "metrics",
    "tracking",
  ];
  if (
    painPoints.some((p) =>
      analyticsSignals.some((s) => p.toLowerCase().includes(s))
    ) ||
    analyticsSignals.some((s) => content.includes(s))
  ) {
    return "analytics_dashboard";
  }

  // Default based on complaint status
  return post.is_complaint ? "complaint" : "feature_request";
}

function isSaaSOpportunityPost(post: PostData): {
  isOpportunity: boolean;
  opportunityType: string;
  signals: string[];
} {
  const title = (post.title || "").toLowerCase();
  const body = (post.body || "").toLowerCase();
  const content = `${title} ${body}`;

  const signals = [];
  let opportunityType = "unknown";
  let isOpportunity = false;

  // 1. Complaint Posts
  if (post.is_complaint && post.sentiment < 0) {
    isOpportunity = true;
    opportunityType = "complaint";
    signals.push("Negative sentiment complaint");
  }

  // 2. Feature Request / Wishlist Posts
  const wishlistKeywords = [
    "wish there was",
    "looking for",
    "need a tool",
    "wish someone built",
    "does anyone know",
    "is there a",
    "any recommendations for",
    "what tool do you use",
    "how do you handle",
    "best way to",
    "feature request",
    "would love to see",
    "missing feature",
  ];
  const wishlistMatches = wishlistKeywords.filter((keyword) =>
    content.includes(keyword)
  );
  if (wishlistMatches.length > 0) {
    isOpportunity = true;
    opportunityType = "feature_request";
    signals.push(`Feature request: ${wishlistMatches.join(", ")}`);
  }

  // 3. DIY Solution Sharing
  const diyKeywords = [
    "i built",
    "i created",
    "my script",
    "my solution",
    "i made",
    "wrote a",
    "custom tool",
    "automation i",
    "workflow i",
    "here is how i",
    "i solve this by",
    "my approach",
  ];
  const diyMatches = diyKeywords.filter((keyword) => content.includes(keyword));
  if (diyMatches.length > 0) {
    isOpportunity = true;
    opportunityType = "diy_solution";
    signals.push(`DIY solution: ${diyMatches.join(", ")}`);
  }

  // 4. Tool Gap Mentions
  const gapKeywords = [
    "missing",
    "lacks",
    "doesnt have",
    "wish it had",
    "except for",
    "but it doesnt",
    "only issue",
    "if only it",
    "would be perfect if",
    "needs better",
    "could improve",
  ];
  const gapMatches = gapKeywords.filter((keyword) => content.includes(keyword));
  if (gapMatches.length > 0 && post.sentiment > -0.5) {
    isOpportunity = true;
    opportunityType = "tool_gap";
    signals.push(`Tool gap: ${gapMatches.join(", ")}`);
  }

  // 5. Market Research Posts
  const researchKeywords = [
    "what tools",
    "how do you",
    "best practices",
    "recommendations",
    "what software",
    "how does your team",
    "workflow for",
    "process for",
    "tools for",
    "software for",
  ];
  const researchMatches = researchKeywords.filter((keyword) =>
    content.includes(keyword)
  );
  if (researchMatches.length > 0 && !isOpportunity) {
    isOpportunity = true;
    opportunityType = "market_research";
    signals.push(`Market research: ${researchMatches.join(", ")}`);
  }

  // 6. Business Process Mentions
  const businessKeywords = [
    "workflow",
    "process",
    "automation",
    "integration",
    "crm",
    "erp",
    "project management",
    "team collaboration",
    "reporting",
    "dashboard",
  ];
  const businessMatches = businessKeywords.filter((keyword) =>
    content.includes(keyword)
  );
  if (businessMatches.length >= 2 && !isOpportunity) {
    isOpportunity = true;
    opportunityType = "business_process";
    signals.push(`Business process: ${businessMatches.join(", ")}`);
  }

  const frustrations = [
    "worthless",
    "suffering",
    "frustrated",
    "bad",
    "react frontend",
    "frustrations",
    "issues",
    "awful",
    "challenging",
    "issue",
    "bug",
    "problem",
    "error",
    "annoying",
    "hate",
  ];
  const frustrationMatches = frustrations.filter((keyword) =>
    content.includes(keyword)
  );
  if (frustrationMatches.length > 0 && !isOpportunity) {
    isOpportunity = true;
    opportunityType = "frustration";
    signals.push(`Frustration: ${frustrationMatches.join(", ")}`);
  }

  return { isOpportunity, opportunityType, signals };
}

async function clusterPostsBySimilarity(
  posts: PostData[],
  similarityThreshold: number,
  minClusterSize: number
): Promise<PostCluster[]> {
  console.log(
    `Simplified clustering of ${posts.length} posts using pre-computed similarity scores`
  );
  console.log(
    `Using similarity threshold: ${similarityThreshold}, min cluster size: ${minClusterSize}`
  );

  if (posts.length < minClusterSize) {
    console.log(`Not enough posts for clustering`);
    return [];
  }

  // Build clusters using Union-Find approach for simplicity
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const edges: Array<{ post1: number; post2: number; score: number }> = [];

  // Collect all similarity relationships above threshold
  posts.forEach((post) => {
    if (post.similarity_scores && Array.isArray(post.similarity_scores)) {
      post.similarity_scores.forEach((sim) => {
        if (sim.score >= similarityThreshold && postMap.has(sim.post_id)) {
          edges.push({
            post1: post.id,
            post2: sim.post_id,
            score: sim.score,
          });
        }
      });
    }
  });

  console.log(`Found ${edges.length} similarity relationships above threshold`);

  // Simple Union-Find clustering
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  };

  const union = (x: number, y: number) => {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX !== rootY) {
      parent.set(rootX, rootY);
    }
  };

  // Initialize all posts
  posts.forEach((post) => parent.set(post.id, post.id));

  // Union connected posts
  edges.forEach((edge) => {
    union(edge.post1, edge.post2);
  });

  // Group posts by their root parent
  const clusterGroups = new Map<number, PostData[]>();
  posts.forEach((post) => {
    const root = find(post.id);
    if (!clusterGroups.has(root)) {
      clusterGroups.set(root, []);
    }
    clusterGroups.get(root)!.push(post);
  });

  // Create clusters from groups that meet minimum size
  const clusters: PostCluster[] = [];
  clusterGroups.forEach((posts, _root) => {
    if (posts.length >= minClusterSize) {
      const embeddings = posts
        .map((post) => post.embedding)
        .filter((embedding) => embedding && Array.isArray(embedding));

      const centroid =
        embeddings.length > 0 ? calculateCentroid(embeddings) : [];
      const sortedPosts = posts.sort((a, b) => a.sentiment - b.sentiment);

      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        posts: posts,
        centroid,
        size: posts.length,
        representative_posts: sortedPosts,
        theme_summary: `Cluster of ${posts.length} similar posts`,
      });
    }
  });

  // Sort clusters by size (largest first)
  clusters.sort((a, b) => b.size - a.size);
  console.log(
    `Created ${clusters.length} clusters with sizes: ${clusters
      .map((c) => c.size)
      .join(", ")}`
  );

  return clusters;
}

// Database-driven clustering using similarity_scores JSONB
async function clusterPostsUsingDatabase(
  posts: PostData[],
  similarityThreshold: number,
  minClusterSize: number
): Promise<PostCluster[]> {
  console.log(`Database-driven clustering of ${posts.length} posts`);
  console.log(
    `Using similarity threshold: ${similarityThreshold}, min cluster size: ${minClusterSize}`
  );

  if (posts.length < minClusterSize) {
    console.log(`Not enough posts for clustering`);
    return [];
  }

  const postIds = posts.map((p) => p.id);
  console.log(
    `Clustering posts: ${postIds.slice(0, 10).join(", ")}${
      postIds.length > 10 ? "..." : ""
    }`
  );

  // Use direct application logic for clustering (more reliable than SQL functions)
  return fallbackClusteringWithDirectQuery(
    posts,
    similarityThreshold,
    minClusterSize
  );
}

// Fallback approach that directly queries similarity scores
async function fallbackClusteringWithDirectQuery(
  posts: PostData[],
  similarityThreshold: number,
  minClusterSize: number
): Promise<PostCluster[]> {
  console.log("Using fallback clustering with direct similarity score query");

  const postIds = posts.map((p) => p.id);

  // Fetch posts with their similarity scores
  const { data: postsWithSimilarity, error } = await supabase
    .from("posts")
    .select(
      "id, title, body, sentiment, url, created_at, platform, embedding, is_complaint, saas_score, pain_points, similarity_scores"
    )
    .in("id", postIds)
    .not("similarity_scores", "is", null)
    .not("similarity_scores", "eq", "[]");

  if (error || !postsWithSimilarity) {
    console.error("Failed to fetch posts with similarity scores:", error);
    return [];
  }

  console.log(
    `Fetched ${postsWithSimilarity.length} posts with similarity scores`
  );

  // Debug: Check the structure of similarity scores
  if (postsWithSimilarity.length > 0) {
    const samplePost = postsWithSimilarity[0];
    console.log(
      `Sample similarity_scores structure:`,
      JSON.stringify(samplePost.similarity_scores, null, 2)
    );
    console.log(`Sample post ID: ${samplePost.id}`);
    console.log(
      `Type of similarity_scores:`,
      typeof samplePost.similarity_scores
    );
    console.log(`Is array:`, Array.isArray(samplePost.similarity_scores));
    if (
      Array.isArray(samplePost.similarity_scores) &&
      samplePost.similarity_scores.length > 0
    ) {
      console.log(`First similarity entry:`, samplePost.similarity_scores[0]);
      console.log(
        `Available keys in first entry:`,
        Object.keys(samplePost.similarity_scores[0] || {})
      );
    }
  }

  // Build similarity relationships - cluster opportunity posts with ANY similar posts
  const edges: Array<{ post1: number; post2: number; score: number }> = [];
  const allRelevantPosts = new Map<number, any>();

  // Start with opportunity posts
  posts.forEach((post) => allRelevantPosts.set(post.id, post));

  // Add any posts that are similar to opportunity posts (expand the universe)
  postsWithSimilarity.forEach((post) => {
    if (post.similarity_scores && Array.isArray(post.similarity_scores)) {
      post.similarity_scores.forEach((sim: any) => {
        if (sim.score >= similarityThreshold) {
          // If this post is similar to any opportunity post, include both
          allRelevantPosts.set(post.id, post);
          // Note: we can't add sim.post_id here since we don't have its full data
        }
      });
    }
  });

  let totalSimilarityEntries = 0;
  let validPostIdMatches = 0;
  let thresholdPassed = 0;

  postsWithSimilarity.forEach((post) => {
    if (post.similarity_scores && Array.isArray(post.similarity_scores)) {
      totalSimilarityEntries += post.similarity_scores.length;
      post.similarity_scores.forEach((sim: any) => {
        // Now allow connections to ANY post, not just opportunity posts
        if (sim.score >= similarityThreshold) {
          thresholdPassed++;
          edges.push({
            post1: post.id,
            post2: sim.post_id,
            score: sim.score,
          });
        }
        // Track how many would match if we required both to be opportunity posts
        if (allRelevantPosts.has(sim.post_id)) {
          validPostIdMatches++;
        }
      });
    }
  });

  console.log(`Debug stats:`);
  console.log(
    `- Total similarity entries across all posts: ${totalSimilarityEntries}`
  );
  console.log(
    `- Entries with post_id in our opportunity posts: ${validPostIdMatches}`
  );
  console.log(
    `- Entries that passed similarity threshold ${similarityThreshold}: ${thresholdPassed}`
  );

  // Debug: Show some example post IDs that we're looking for vs what's in similarity scores
  const opportunityPostIds = new Set(posts.map((p) => p.id));
  console.log(
    `Opportunity post IDs (first 10): ${Array.from(opportunityPostIds)
      .slice(0, 10)
      .join(", ")}`
  );

  if (
    postsWithSimilarity.length > 0 &&
    postsWithSimilarity[0].similarity_scores &&
    Array.isArray(postsWithSimilarity[0].similarity_scores)
  ) {
    const sampleSimilarPostIds = postsWithSimilarity[0].similarity_scores
      .slice(0, 5)
      .map((s: any) => s.post_id);
    console.log(
      `Sample similarity post IDs from first post: ${sampleSimilarPostIds.join(
        ", "
      )}`
    );

    // Check if ANY of the similarity post IDs are in our opportunity posts
    const hasOverlap = sampleSimilarPostIds.some((id: number) =>
      opportunityPostIds.has(id)
    );
    console.log(
      `Do similarity post IDs overlap with opportunity posts? ${hasOverlap}`
    );
  }

  console.log(
    `Found ${edges.length} similarity relationships above threshold ${similarityThreshold}`
  );

  if (edges.length === 0) {
    console.log(
      "No similarity relationships found - trying with lower threshold"
    );
    // Try with a much lower threshold and don't restrict to opportunity posts
    const lowThreshold = 0.1;
    postsWithSimilarity.forEach((post) => {
      if (post.similarity_scores && Array.isArray(post.similarity_scores)) {
        post.similarity_scores.forEach((sim: any) => {
          if (sim.score >= lowThreshold) {
            edges.push({
              post1: post.id,
              post2: sim.post_id,
              score: sim.score,
            });
          }
        });
      }
    });
    console.log(
      `Found ${edges.length} similarity relationships with lower threshold ${lowThreshold}`
    );
  }

  // Union-Find clustering - but only create clusters around opportunity posts
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  };

  const union = (x: number, y: number) => {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX !== rootY) {
      parent.set(rootX, rootY);
    }
  };

  // Initialize with all post IDs that appear in edges
  const allPostIdsInEdges = new Set<number>();
  edges.forEach((edge) => {
    allPostIdsInEdges.add(edge.post1);
    allPostIdsInEdges.add(edge.post2);
  });

  allPostIdsInEdges.forEach((postId) => parent.set(postId, postId));

  // Union connected posts
  edges.forEach((edge) => union(edge.post1, edge.post2));

  // Group posts by root, but only include opportunity posts in final clusters
  const clusterGroups = new Map<number, PostData[]>();
  posts.forEach((post) => {
    // Only iterate through opportunity posts
    const root = find(post.id);
    if (!clusterGroups.has(root)) {
      clusterGroups.set(root, []);
    }
    clusterGroups.get(root)!.push(post);
  });

  // Create clusters from opportunity posts that are connected
  const clusters: PostCluster[] = [];
  clusterGroups.forEach((clusterPosts, _root) => {
    if (clusterPosts.length >= minClusterSize) {
      const embeddings = clusterPosts
        .map((post) => post.embedding)
        .filter((embedding) => embedding && Array.isArray(embedding));

      const centroid =
        embeddings.length > 0 ? calculateCentroid(embeddings) : [];
      const sortedPosts = clusterPosts.sort(
        (a, b) => a.sentiment - b.sentiment
      );

      console.log(
        `Creating cluster with ${
          clusterPosts.length
        } posts (will use ${Math.min(25, clusterPosts.length)} for AI analysis)`
      );

      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        posts: clusterPosts,
        centroid,
        size: clusterPosts.length,
        representative_posts: sortedPosts,
        theme_summary: `Cluster of ${clusterPosts.length} similar opportunity posts`,
      });
    }
  });

  clusters.sort((a, b) => b.size - a.size);
  return clusters;
}

async function generateClusterTheme(cluster: PostCluster): Promise<string> {
  if (!OPENAI_API_KEY) {
    return `Cluster of ${cluster.size} similar complaints`;
  }

  // Use MORE posts for better theme generation - up to 100 for larger clusters
  const maxPostsForTheme = Math.min(100, cluster.representative_posts.length);
  const samplePosts = cluster.representative_posts.slice(0, maxPostsForTheme);
  const postTexts = samplePosts
    .map((post) => {
      const content = `${post.title || ""}\n${post.body || ""}`.slice(0, 400); // More content
      return content.replace(/\s+/g, " ").trim();
    })
    .join("\n\n");

  const prompt = `Analyze these similar complaint posts and create a 1-sentence theme description:

${postTexts}

Return ONLY a concise theme description (10-15 words) that captures the common complaint pattern.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const theme = data?.choices?.[0]?.message?.content?.trim();

    if (theme) {
      return theme;
    } else {
      return `Cluster of ${cluster.size} similar complaints`;
    }
  } catch (error) {
    console.warn(`Theme generation failed for cluster ${cluster.id}:`, error);
    return `Cluster of ${cluster.size} similar complaints`;
  }
}

function buildEnhancedPrompt(
  cluster: PostCluster,
  existingIdeas: string[]
): { system: string; user: string } {
  const system = `You are an innovative SaaS strategist and product visionary specializing in identifying scalable B2B opportunities.

⚡ CLUSTER-FOCUSED ANALYSIS:
You are analyzing a specific complaint cluster: "${cluster.theme_summary}"
This cluster contains ${
    cluster.size
  } similar posts representing a validated pain pattern.

📊 CLUSTER DATA INSIGHTS:
${generateClusterInsights(cluster)}

CRITICAL REQUIREMENTS:
1. LEVERAGE STRUCTURED DATA: Use the SaaS scores and pain points provided to identify the strongest opportunities
2. PATTERN FREQUENCY: Focus on pain points that appear in 3+ posts within this cluster
3. WEIGHT BY SCORE: Give more weight to posts with SaaS scores ≥ 60
4. FOCUS ON B2B PAIN: Workflow, productivity, integrations, compliance, and business process complaints
5. MARKET VALIDATION: Look for signs of willingness to pay (cost, wasted time, business/revenue impact)
6. GENERATE 1–3 IDEAS: Ensure each idea is meaningfully different in users, industries, or workflows
7. TECHNICAL FEASIBILITY: Must be achievable with today's SaaS stack (APIs, webhooks, ETL/ELT, LLMs, cloud infra)
8. NO VAGUE AI: Avoid generic "AI does everything" solutions without specific implementation details
9. NOVELTY: At least one idea must be a distinct approach not already seen in "similar_to"

PATTERN DISCOVERY CHECKLIST:
- Pain points mentioned in 3+ posts
- Repeated inefficiencies across industries
- Common integration or automation needs
- Compliance, reporting, or audit challenges
- Shared UX frustrations
- Explicit mentions of wasted time, costs, or missed revenue

🚀 PRIORITIZE WORKFLOW AUTOMATION WHEN PRESENT:
- **Workflow Automation**: Manual, repetitive tasks that can be automated
- **Integration Platforms**: Connecting disconnected business tools (CRM+Email, etc.)
- **Reporting/Dashboards**: Visibility into business metrics and KPIs
- **Compliance/Audit**: Regulatory requirements and approval workflows

⚖️ BALANCED APPROACH:
If automation isn’t clearly present, prioritize other validated B2B opportunities such as collaboration tools, customer management, or vertical SaaS.

SCORING CRITERIA (0–100):
- Cross-Post Pattern Strength (0–30)
- Pain Intensity & Frequency (0–25)
- Market Size & Willingness to Pay (0–20)
- Feasibility & Differentiation (0–15)
- Market Timing (0–10)

Include a score breakdown explanation inside "rationale".

AVOID SINGLE-POST SOLUTIONS:
- Ideas that only solve one person’s unique problem
- Highly customized or one-off niche solutions
- Generic "productivity tools" without cluster evidence
- Solutions that don’t scale across multiple customers

${
  existingIdeas.length > 0
    ? `EXISTING IDEAS TO AVOID DUPLICATING:\n${existingIdeas.join(
        "\n"
      )}\n\nYour new ideas must be meaningfully different from these.\n`
    : ""
}

OUTPUT RULES:
- Return ONLY the JSON object below. No explanations, no markdown, no prose before or after
- All strings must be properly escaped
- No trailing commas
- representative_post_ids must always be a valid JSON array (empty if none)
- If uncertain about market existence, set "does_not_exist": "unknown"
- Each idea should directly address the cluster’s common theme
- At least one idea must propose a novel angle not already in "similar_to"

Return STRICT JSON exactly in this shape:
{
  "ideas": [
    {
      "score": 85,
      "name": "Specific Product Name",
      "one_liner": "Concise but specific value proposition (1–2 sentences) reflecting the cluster pattern",
      "target_user": "Specific user persona experiencing this cluster pattern",
      "core_features": ["Feature 1", "Feature 2", "Feature 3+"],
      "why_now": "Why this opportunity exists now",
      "pricing_hint": "Suggested pricing model",
      "rationale": "Score breakdown + reasoning tied to cluster patterns",
      "representative_post_ids": [${cluster.representative_posts
        .map((p: any) => p.id)
        .join(", ")}],
      "pattern_evidence": "Description of the common pattern across this cluster",
      "similar_to": "List of existing similar products in market",
      "gaps_filled": "Specific gaps or limitations in existing solutions addressed here",
      "does_not_exist": "Explanation of how this idea differs from or improves on existing solutions"
    }
  ]
}`;

  // Use MORE representative posts with enhanced metadata (up to 100 for large clusters)
  const maxPostsForIdeas = Math.min(100, cluster.representative_posts.length);
  const postsToUse = cluster.representative_posts.slice(0, maxPostsForIdeas);
  const postTexts = postsToUse
    .map((post: any) => {
      const content = `${post.title || ""}\n\n${post.body || ""}`
        .replace(/\s+/g, " ")
        .trim();
      const truncated = content.slice(0, 500);

      const metadata = [];
      if (post.saas_score !== null && post.saas_score !== undefined) {
        metadata.push(`SaaS Score: ${post.saas_score}`);
      }
      if (post.pain_points && post.pain_points.length > 0) {
        metadata.push(`Pain Points: ${post.pain_points.join(", ")}`);
      }
      if (post.opportunity_type) {
        metadata.push(`Type: ${post.opportunity_type}`);
      }

      const metadataStr =
        metadata.length > 0 ? `\n[${metadata.join(" | ")}]` : "";

      return `(${post.id}) ${truncated}${
        content.length > 500 ? "…" : ""
      } ${metadataStr} [${post.url || "N/A"}]`;
    })
    .join("\n\n");

  const user = `Analyze this validated complaint cluster and identify HIGH-FREQUENCY PATTERNS that can be solved by scalable B2B SaaS solutions. Then propose 1–3 diverse ideas that directly address the common theme.

CLUSTER ANALYSIS:
Theme: ${cluster.theme_summary}
Size: ${cluster.size} similar posts
Validated Pattern: Multiple users experiencing the same underlying problem

📊 DATA-DRIVEN INSIGHTS:
${generateClusterInsights(cluster)}

🎯 STRUCTURED ANALYSIS INSTRUCTIONS:
- PRIORITIZE posts with SaaS scores ≥60 (strongest commercial potential)
- FOCUS on pain points that appear in 3+ posts (high-frequency)
- TIE-BREAKER: Prefer patterns that are BOTH frequent (≥3) AND high-scoring (≥60)
- USE the opportunity-type distribution to guide solution categories
- LEVERAGE structured data: ${
    cluster.representative_posts.filter(
      (p) => p.saas_score || p.pain_points?.length
    ).length
  }/${cluster.representative_posts.length} posts include structured signals (scores or pain points)
- AVOID vague “AI does everything” outputs; specify concrete implementation (APIs, webhooks, ETL/ELT, LLMs)

REPRESENTATIVE POSTS FROM THIS CLUSTER:
${postTexts}

CRITICAL REQUIREMENTS:
1) This cluster represents a VALIDATED PATTERN with structured data backing
2) Generate 1–3 DIVERSE B2B SaaS ideas that solve the COMMON THREAD: "${cluster.theme_summary}"
3) Each idea must show clear business impact (time saved, productivity, reduced manual work)
4) Provide specific supporting post IDs in "representative_post_ids"
5) Ensure technical feasibility with today’s SaaS stack (APIs, webhooks, ETL/ELT, LLMs, cloud infra)
6) Use structured pain-points data to craft precise problem statements
${
  existingIdeas.length > 0
    ? `7) Do NOT duplicate existing ideas. Existing ideas to avoid:\n${existingIdeas.join(
        "\n"
      )}`
    : ""
}

OUTPUT RULES:
- Return ONLY the JSON object below. No explanations, no markdown, no extra text.
- Strings must be properly escaped. No trailing commas.
- "representative_post_ids" must be a JSON array of strings (empty if none).
- If unsure whether a product exists, set "does_not_exist": "unknown" and still populate "similar_to" if adjacent products are known.

Return STRICT JSON exactly in this shape:
{
  "ideas": [
    {
      "name": "Specific Product Name",
      "one_liner": "Concise but specific value proposition (1–2 sentences) reflecting the cluster pattern",
      "target_user": "Specific persona most affected by this pattern",
      "core_features": ["Feature 1", "Feature 2", "Feature 3+"],
      "rationale": "Data-backed justification referencing frequency (≥3) and score (≥60) where applicable",
      "representative_post_ids": [${postsToUse
        .map((p: any) => `"${p.id}"`)
        .join(", ")}],
      "similar_to": "Existing similar products (if any)",
      "gaps_filled": "What those tools miss that this solves",
      "does_not_exist": "unknown or explanation of uniqueness"
    }
  ]
}`;

  return { system, user };
}

async function callOpenAI(
  system: string,
  user: string,
  retryWithFallback = true
): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Try main model first, then fallback model if rate limited
  const modelsToTry = [IDEATION_MODEL];
  if (retryWithFallback && IDEATION_MODEL !== FALLBACK_MODEL) {
    modelsToTry.push(FALLBACK_MODEL);
  }

  for (const model of modelsToTry) {
    console.log(`Trying OpenAI model: ${model}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
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
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`OpenAI ${response.status}: ${errorText}`);

          // Handle rate limiting specifically
          if (response.status === 429) {
            console.warn(
              `Rate limited on ${model}, attempt ${attempt}/${MAX_RETRIES}`
            );

            // Parse rate limit info from error
            let waitTime = RATE_LIMIT_DELAY_BASE * attempt; // Progressive delay
            try {
              const errorData = JSON.parse(errorText);
              const errorMsg = errorData?.error?.message || "";

              // Extract wait time from error message if available
              const waitMatch = errorMsg.match(/Please try again in ([\d.]+)s/);
              if (waitMatch) {
                waitTime = Math.max(
                  parseFloat(waitMatch[1]) * 1000 + 5000,
                  waitTime
                ); // Add 5s buffer
              }

              // Check if it's a daily limit
              if (errorMsg.includes("requests per day")) {
                console.error(`Daily rate limit exceeded for ${model}`);
                if (model !== FALLBACK_MODEL && modelsToTry.length > 1) {
                  console.log(`Switching to fallback model: ${FALLBACK_MODEL}`);
                  break; // Break to try fallback model
                }
                throw new Error(
                  `Daily rate limit exceeded for all models. Please try again tomorrow or upgrade your OpenAI plan.`
                );
              }
            } catch (parseError) {
              // Ignore parsing errors, use default wait time
            }

            if (attempt < MAX_RETRIES) {
              console.log(
                `Waiting ${Math.round(waitTime / 1000)}s before retry...`
              );
              await sleep(waitTime);
              continue;
            }
          }

          throw error;
        }

        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim();

        if (content) {
          console.log(`Successfully generated ideas using ${model}`);
          return JSON.parse(content);
        } else {
          throw new Error("Empty response from OpenAI");
        }
      } catch (error) {
        const isRateLimit =
          error instanceof Error && error.message.includes("429");

        console.warn(
          `${model} attempt ${attempt}/${MAX_RETRIES} failed:`,
          error
        );

        if (attempt === MAX_RETRIES) {
          if (
            isRateLimit &&
            model !== FALLBACK_MODEL &&
            modelsToTry.length > 1
          ) {
            console.log(`Max retries reached for ${model}, trying fallback...`);
            break; // Try fallback model
          }
          throw error;
        }

        // Progressive backoff for non-rate-limit errors
        if (!isRateLimit) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          await sleep(delay);
        }
      }
    }
  }

  throw new Error("All OpenAI models exhausted");
}

function analyzeWorkflowOpportunity(idea: any): {
  score_boost: number;
  automation_category: string | null;
  automation_signals: string[];
} {
  const ideaText = `${idea.name || ""} ${idea.one_liner || ""} ${
    idea.rationale || ""
  } ${JSON.stringify(idea.core_features || [])}`.toLowerCase();

  let scoreBoost = 0;
  let automationCategory = null;
  const automationSignals: string[] = [];

  // 1. Workflow Automation Detection
  const workflowKeywords = [
    "automat",
    "workflow",
    "manual",
    "repetitive",
    "recurring",
    "scheduled",
    "trigger",
    "batch process",
    "bulk",
    "routine",
    "streamline",
    "eliminate manual",
  ];
  const workflowMatches = workflowKeywords.filter((keyword) =>
    ideaText.includes(keyword)
  );

  if (workflowMatches.length > 0) {
    scoreBoost += AUTOMATION_SCORE_BOOST;
    automationCategory = "workflow_automation";
    automationSignals.push(
      `Workflow automation: ${workflowMatches.join(", ")}`
    );
  }

  // 2. Integration Gaps Detection
  const integrationKeywords = [
    "integrat",
    "connect",
    "sync",
    "api",
    "webhook",
    "bridge",
    "link",
    "unify",
    "consolidate",
    "centralize",
    "single source",
    "data flow",
  ];
  const systemKeywords = [
    "crm",
    "erp",
    "hrms",
    "salesforce",
    "slack",
    "teams",
    "jira",
    "asana",
    "hubspot",
    "mailchimp",
    "stripe",
    "quickbooks",
    "excel",
    "spreadsheet",
  ];

  const integrationMatches = integrationKeywords.filter((keyword) =>
    ideaText.includes(keyword)
  );
  const systemMatches = systemKeywords.filter((keyword) =>
    ideaText.includes(keyword)
  );

  if (integrationMatches.length > 0 && systemMatches.length >= 2) {
    scoreBoost += INTEGRATION_SCORE_BOOST;
    if (!automationCategory) automationCategory = "integration_platform";
    automationSignals.push(
      `Integration opportunity: ${integrationMatches.join(
        ", "
      )} between ${systemMatches.join(", ")}`
    );
  }

  // 3. Reporting/Dashboard Detection
  const reportingKeywords = [
    "report",
    "dashboard",
    "analytic",
    "metric",
    "kpi",
    "visibility",
    "insight",
    "track",
    "monitor",
    "measure",
    "visualiz",
    "chart",
    "graph",
  ];
  const reportingMatches = reportingKeywords.filter((keyword) =>
    ideaText.includes(keyword)
  );

  if (reportingMatches.length > 0) {
    scoreBoost += REPORTING_SCORE_BOOST;
    if (!automationCategory) automationCategory = "reporting_dashboard";
    automationSignals.push(
      `Reporting/visibility: ${reportingMatches.join(", ")}`
    );
  }

  // 4. Compliance/Audit Trail Detection
  const complianceKeywords = [
    "compliance",
    "audit",
    "regulatory",
    "govern",
    "policy",
    "rule",
    "approval",
    "permission",
    "access control",
    "security",
    "gdpr",
    "hipaa",
  ];
  const complianceMatches = complianceKeywords.filter((keyword) =>
    ideaText.includes(keyword)
  );

  if (complianceMatches.length > 0) {
    scoreBoost += COMPLIANCE_SCORE_BOOST;
    if (!automationCategory) automationCategory = "compliance_automation";
    automationSignals.push(`Compliance/audit: ${complianceMatches.join(", ")}`);
  }

  // 5. Additional Business Process Signals
  const processKeywords = [
    "process",
    "procedure",
    "checklist",
    "template",
    "standardiz",
    "optimize",
  ];
  const processMatches = processKeywords.filter((keyword) =>
    ideaText.includes(keyword)
  );

  if (processMatches.length > 0 && scoreBoost === 0) {
    scoreBoost += 5; // Small boost for general process improvement
    automationCategory = "process_optimization";
    automationSignals.push(`Process improvement: ${processMatches.join(", ")}`);
  }

  return {
    score_boost: scoreBoost,
    automation_category: automationCategory,
    automation_signals: automationSignals,
  };
}

function normalizeName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateIdeasFromPosts(parameters: any): Promise<{
  ideas: any[];
  clusters_processed: number;
  posts_processed: number;
}> {
  const jobId = parameters.job_id;

  console.log(`Starting complete ideas generation for job ${jobId}`);

  // Update job status
  await updateJobStatus(jobId, {
    status: "running",
    started_at: new Date().toISOString(),
    progress: {
      current_step: "Fetching posts with embeddings",
      total_steps: 5,
      completed_steps: 0,
    },
  });

  // Fetch posts with embeddings - NO LIMITS
  const sinceISO = new Date(
    Date.now() - (parameters.days || 14) * 86400000
  ).toISOString();

  let query = supabase
    .from("posts")
    .select(
      "id, title, body, sentiment, url, created_at, platform, embedding, is_complaint, saas_score, pain_points, similarity_scores"
    )
    .not("title", "is", null)
    .not("body", "is", null)
    .not("embedding", "is", null)
    .gte("created_at", sinceISO);

  if (parameters.platform && parameters.platform !== "all") {
    query = query.eq("platform", parameters.platform);
  }

  // Filter by SaaS score if provided
  if (parameters.min_saas_score) {
    query = query.gte("saas_score", parameters.min_saas_score);
  }

  // NO LIMIT - fetch as many posts as possible
  const { data: rawPosts, error: postsError } = await query
    .order("saas_score", { ascending: false }) // Prioritize high SaaS scores
    .order("created_at", { ascending: false })
    .limit(parameters.limit || 1000); // Much higher default

  if (postsError || !rawPosts) {
    throw new Error(`Failed to fetch posts: ${postsError?.message}`);
  }

  console.log(`Fetched ${rawPosts.length} posts`);

  // Filter for SaaS opportunities
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
    // Use database-computed saas_score if available, otherwise fallback to heuristics
    let isOpportunity = false;
    let opportunityType = "unknown";
    let signals: string[] = [];

    if (post.saas_score !== null && post.saas_score !== undefined) {
      // Use database score (prioritize this approach)
      isOpportunity = post.saas_score >= (parameters.min_saas_score || 30);
      opportunityType = determineSaaSOpportunityType(post);
      signals = post.pain_points || [];
    } else {
      // Fallback to existing heuristic analysis
      const analysis = isSaaSOpportunityPost(post);
      isOpportunity = analysis.isOpportunity;
      opportunityType = analysis.opportunityType;
      signals = analysis.signals;
    }

    if (isOpportunity) {
      opportunityPosts.push({
        ...post,
        opportunity_type: opportunityType,
        opportunity_signals: signals,
      });
      (opportunityStats as any)[opportunityType]++;
    }
  }

  console.log(
    `Found ${opportunityPosts.length} opportunity posts:`,
    opportunityStats
  );

  if (opportunityPosts.length === 0) {
    await updateJobStatus(jobId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      result: {
        message: "No SaaS opportunity posts found",
        ideas_generated: 0,
      },
    });
    return {
      ideas: [],
      clusters_processed: 0,
      posts_processed: rawPosts.length,
    };
  }

  // Perform clustering using database-driven approach
  await updateJobStatus(jobId, {
    progress: {
      current_step: "Performing database-driven clustering",
      total_steps: 5,
      completed_steps: 2,
      posts_found: opportunityPosts.length,
    },
  });

  const clusters = await clusterPostsUsingDatabase(
    opportunityPosts,
    parameters.similarity_threshold || 0.3,
    parameters.min_cluster_size || 2
  );

  console.log(`Created ${clusters.length} clusters`);

  if (clusters.length === 0) {
    await updateJobStatus(jobId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      result: {
        message: `No clusters found with threshold ${
          parameters.similarity_threshold || 0.3
        } and min size ${
          parameters.min_cluster_size || 2
        }. Try lowering similarity threshold or minimum cluster size.`,
        ideas_generated: 0,
      },
    });
    return {
      ideas: [],
      clusters_processed: 0,
      posts_processed: rawPosts.length,
    };
  }

  // Generate themes for clusters
  await updateJobStatus(jobId, {
    progress: {
      current_step: "Generating cluster themes",
      total_steps: 5,
      completed_steps: 3,
      clusters_found: clusters.length,
    },
  });

  // Generate themes for clusters in batches to avoid rate limits
  console.log(
    `Generating themes for ${clusters.length} clusters in batches...`
  );
  for (let i = 0; i < clusters.length; i += MAX_CLUSTERS_PER_BATCH) {
    const batch = clusters.slice(i, i + MAX_CLUSTERS_PER_BATCH);
    console.log(
      `Processing theme batch ${
        Math.floor(i / MAX_CLUSTERS_PER_BATCH) + 1
      }/${Math.ceil(clusters.length / MAX_CLUSTERS_PER_BATCH)} (${
        batch.length
      } clusters)`
    );

    const themePromises = batch.map(async (cluster) => {
      try {
        cluster.theme_summary = await generateClusterTheme(cluster);
        console.log(
          `Generated theme for ${cluster.id}: ${cluster.theme_summary}`
        );
      } catch (error) {
        console.warn(`Failed to generate theme for ${cluster.id}:`, error);
        cluster.theme_summary = `Cluster of ${cluster.size} similar posts`;
      }
    });

    await Promise.all(themePromises);

    // Add delay between batches to avoid rate limits
    if (i + MAX_CLUSTERS_PER_BATCH < clusters.length) {
      console.log("Waiting 30s between theme generation batches...");
      await sleep(30000);
    }
  }

  // Generate ideas from ALL clusters - NO LIMITS
  await updateJobStatus(jobId, {
    progress: {
      current_step: "Generating ideas from clusters",
      total_steps: 5,
      completed_steps: 4,
      clusters_with_themes: clusters.length,
    },
  });

  // Get existing ideas for deduplication
  const { data: existingIdeas } = await supabase
    .from("saas_idea_items")
    .select("name, target_user")
    .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString())
    .limit(100); // Higher limit for better deduplication

  const existingIdeaNames = (existingIdeas || []).map(
    (idea) => `${idea.name} (Target: ${idea.target_user || "N/A"})`
  );

  // Process clusters in batches to manage rate limits
  const allIdeas: any[] = [];

  console.log(
    `Processing ${clusters.length} clusters for idea generation in batches...`
  );
  for (
    let batchStart = 0;
    batchStart < clusters.length;
    batchStart += MAX_CLUSTERS_PER_BATCH
  ) {
    const batchEnd = Math.min(
      batchStart + MAX_CLUSTERS_PER_BATCH,
      clusters.length
    );
    const currentBatch = clusters.slice(batchStart, batchEnd);

    console.log(
      `Processing idea generation batch ${
        Math.floor(batchStart / MAX_CLUSTERS_PER_BATCH) + 1
      }/${Math.ceil(clusters.length / MAX_CLUSTERS_PER_BATCH)} (clusters ${
        batchStart + 1
      }-${batchEnd})`
    );

    for (let i = 0; i < currentBatch.length; i++) {
      const clusterIndex = batchStart + i;
      const cluster = currentBatch[i];
      console.log(
        `Processing cluster ${clusterIndex + 1}/${clusters.length}: ${
          cluster.theme_summary
        } (${cluster.size} posts)`
      );

      await updateJobStatus(jobId, {
        progress: {
          current_step: `Generating ideas from cluster ${clusterIndex + 1}/${
            clusters.length
          }`,
          total_steps: 5,
          completed_steps: 4,
          clusters_processed: clusterIndex,
        },
      });

      try {
        const { system, user } = buildEnhancedPrompt(
          cluster,
          existingIdeaNames
        );
        const result = await callOpenAI(system, user);

        const ideas = Array.isArray(result?.ideas) ? result.ideas : [];
        console.log(
          `Cluster ${clusterIndex + 1}: Generated ${ideas.length} raw ideas`
        );

        // Apply workflow automation boost if enabled
        const enhancedIdeas = ideas.map((idea: any) => {
          const baseIdea = {
            ...idea,
            cluster_id: cluster.id,
            cluster_theme: cluster.theme_summary,
            cluster_size: cluster.size,
          };

          if (parameters.enable_automation_boost !== false) {
            const automationAnalysis = analyzeWorkflowOpportunity(baseIdea);
            baseIdea.score =
              (baseIdea.score || 0) + automationAnalysis.score_boost;
            baseIdea.automation_category =
              automationAnalysis.automation_category;
            baseIdea.automation_signals = automationAnalysis.automation_signals;
            baseIdea.original_score = idea.score;
            baseIdea.automation_boost = automationAnalysis.score_boost;
          }

          return baseIdea;
        });

        // Filter by score threshold
        const filteredIdeas = enhancedIdeas.filter(
          (idea: any) => idea.score >= MIN_SCORE_THRESHOLD
        );
        console.log(
          `Cluster ${clusterIndex + 1}: ${
            filteredIdeas.length
          } ideas above threshold`
        );

        allIdeas.push(...filteredIdeas);
      } catch (error) {
        console.error(`Cluster ${clusterIndex + 1} processing failed:`, error);

        // Check if it's a rate limit error that exhausted all models
        if (
          error instanceof Error &&
          error.message.includes("Daily rate limit exceeded")
        ) {
          console.warn(
            `OpenAI daily rate limit reached. Stopping further processing.`
          );

          // Update job with partial completion
          await updateJobStatus(jobId, {
            status: "completed",
            completed_at: new Date().toISOString(),
            result: {
              message: `Partial completion due to OpenAI rate limits. Processed ${clusterIndex}/${clusters.length} clusters.`,
              ideas_generated: allIdeas.length,
              clusters_processed: clusterIndex,
              rate_limited: true,
              suggestion:
                "Try again tomorrow or upgrade OpenAI plan for higher limits",
            },
          });

          // Return partial results
          return {
            ideas: allIdeas,
            clusters_processed: clusterIndex,
            posts_processed: rawPosts.length,
          };
        }
      }

      // Add small delay between clusters within batch
      if (i < currentBatch.length - 1) {
        await sleep(5000); // Shorter delay within batch
      }
    }

    // Add longer delay between batches to prevent rate limiting
    if (batchEnd < clusters.length) {
      console.log(
        `Completed batch ${
          Math.floor(batchStart / MAX_CLUSTERS_PER_BATCH) + 1
        }/${Math.ceil(
          clusters.length / MAX_CLUSTERS_PER_BATCH
        )}, waiting 60s before next batch...`
      );
      await sleep(60000); // 1 minute between batches
    }
  }

  console.log(
    `Generated ${allIdeas.length} total ideas from ${clusters.length} clusters`
  );

  return {
    ideas: allIdeas,
    clusters_processed: clusters.length,
    posts_processed: rawPosts.length,
  };
}

async function storeIdeas(
  ideas: any[],
  parameters: any
): Promise<{ run_id: number; inserted_count: number }> {
  // Create run header
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

  // Prepare ideas for insertion
  const preparedIdeas = ideas.map((idea) => ({
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
    representative_post_ids: Array.isArray(idea.representative_post_ids)
      ? idea.representative_post_ids
          .filter((id: any) => Number.isInteger(Number(id)))
          .map(Number)
      : [],
    posts_in_common: Array.isArray(idea.representative_post_ids)
      ? idea.representative_post_ids.length
      : 0,
    confidence_level: "high", // Railway service produces higher confidence
    pattern_evidence: idea.pattern_evidence
      ? String(idea.pattern_evidence)
      : null,
    payload: idea,
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
      throw insertError;
    } else {
      insertedCount = insertedIdeas?.length || 0;
    }
  }

  console.log(`Inserted ${insertedCount} ideas into database`);
  return { run_id: runId, inserted_count: insertedCount };
}

// Routes
app.get("/", (_req: Request, res: Response) => {
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
      "Advanced workflow automation detection",
    ],
    endpoints: {
      health: "/health",
      ideas: "/generate-ideas",
    },
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.post("/generate-ideas", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const jobId =
    req.body.job_id ||
    `railway_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    console.log(`Starting ideas generation for job ${jobId}`);
    console.log("Parameters:", req.body);

    // Create job record if it doesn't exist
    const { error: jobCreateError } = await supabase.from("ideas_jobs").upsert(
      {
        id: jobId,
        status: "pending",
        created_at: new Date().toISOString(),
        parameters: req.body,
      },
      {
        onConflict: "id",
        ignoreDuplicates: false,
      }
    );

    if (jobCreateError) {
      console.warn("Job creation warning:", jobCreateError);
    }

    // Generate ideas with no limits
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

    // Store ideas
    await updateJobStatus(jobId, {
      progress: {
        current_step: "Storing ideas in database",
        total_steps: 5,
        completed_steps: 4,
        ideas_generated: result.ideas.length,
      },
    });

    const { run_id, inserted_count } = await storeIdeas(result.ideas, req.body);

    // Complete job
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
          "Uses all available posts and clusters",
        ],
      },
    });
  } catch (error) {
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Railway Ideas Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🎯 Features: Unlimited processing, no timeouts, complete pipeline`
  );
  console.log(`💡 Endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - Ideas: http://localhost:${PORT}/generate-ideas`);
});

export default app;
