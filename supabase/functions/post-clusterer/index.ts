// Post Clusterer Microservice - Semantic clustering of posts with embeddings
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Function version
const FUNCTION_VERSION = "1.0.0";
const LAST_UPDATED = "2025-01-19T15:00:00Z";

// Configuration
const MAX_PROCESSING_TIME = 8 * 60 * 1000; // 8 minutes
const CLUSTER_REPRESENTATION_LIMIT = 15;

interface PostCluster {
  id: string;
  posts: any[];
  centroid: number[];
  size: number;
  representative_posts: any[];
  theme_summary: string;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function updateJobStatus(jobId: string, updates: any): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supabase
    .from("ideas_jobs")
    .update(updates)
    .eq("id", jobId);
  if (error) console.error(`Failed to update job ${jobId}:`, error);
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

function isSaaSOpportunityPost(post: any): {
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
  if (post.is_complaint && post.sentiment < -0.1) {
    isOpportunity = true;
    opportunityType = "complaint";
    signals.push("Negative sentiment complaint");
  }

  // 2. Feature Request / Wishlist Posts
  const wishlistKeywords = [
    "wish there was", "looking for", "need a tool", "wish someone built",
    "does anyone know", "is there a", "any recommendations for",
    "what tool do you use", "how do you handle", "best way to",
    "feature request", "would love to see", "missing feature"
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

  // 4. Tool Gap Mentions
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

  // 5. Market Research Posts
  const researchKeywords = [
    "what tools", "how do you", "best practices", "recommendations",
    "what software", "how does your team", "workflow for",
    "process for", "tools for", "software for"
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
    "workflow", "process", "automation", "integration", "crm", "erp",
    "project management", "team collaboration", "reporting", "dashboard"
  ];
  const businessMatches = businessKeywords.filter((keyword) =>
    content.includes(keyword)
  );
  if (businessMatches.length >= 2 && !isOpportunity) {
    isOpportunity = true;
    opportunityType = "business_process";
    signals.push(`Business process: ${businessMatches.join(", ")}`);
  }

  return { isOpportunity, opportunityType, signals };
}

function clusterPostsBySimilarity(
  posts: any[],
  similarityThreshold: number,
  minClusterSize: number,
  maxClusters: number
): PostCluster[] {
  // Filter posts that have embeddings
  const postsWithEmbeddings = posts.filter((post) => {
    if (!post.embedding) return false;

    // Handle pgvector format
    if (typeof post.embedding === "string") {
      try {
        post.embedding = JSON.parse(post.embedding);
      } catch (e) {
        console.warn(`Failed to parse embedding for post ${post.id}:`, e);
        return false;
      }
    }

    return Array.isArray(post.embedding) && post.embedding.length > 0;
  });

  console.log(`Clustering ${postsWithEmbeddings.length} posts with embeddings`);
  console.log(
    `Using similarity threshold: ${similarityThreshold}, min cluster size: ${minClusterSize}`
  );

  if (postsWithEmbeddings.length < minClusterSize) {
    console.log(`Not enough posts with embeddings for clustering`);
    return [];
  }

  const clusters: PostCluster[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < postsWithEmbeddings.length; i++) {
    if (processed.has(i)) continue;

    const seedPost = postsWithEmbeddings[i];
    const clusterPosts = [seedPost];
    processed.add(i);

    console.log(`Starting cluster with seed post ${seedPost.id}`);

    // Find similar posts for this cluster
    for (let j = i + 1; j < postsWithEmbeddings.length; j++) {
      if (processed.has(j)) continue;

      const candidatePost = postsWithEmbeddings[j];
      const similarity = cosineSimilarity(
        seedPost.embedding,
        candidatePost.embedding
      );

      if (similarity >= similarityThreshold) {
        console.log(
          `Found similar post ${
            candidatePost.id
          } with similarity ${similarity.toFixed(4)}`
        );
        clusterPosts.push(candidatePost);
        processed.add(j);
      }
    }

    console.log(`Potential cluster has ${clusterPosts.length} posts`);

    // Only create cluster if it meets minimum size requirement
    if (clusterPosts.length >= minClusterSize) {
      console.log(`Creating cluster with ${clusterPosts.length} posts`);
      const embeddings = clusterPosts.map((post) => post.embedding);
      const centroid = calculateCentroid(embeddings);

      const sortedPosts = clusterPosts.sort(
        (a, b) => a.sentiment - b.sentiment
      );
      const representativePosts = sortedPosts.slice(
        0,
        CLUSTER_REPRESENTATION_LIMIT
      );

      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        posts: clusterPosts,
        centroid,
        size: clusterPosts.length,
        representative_posts: representativePosts,
        theme_summary: `Cluster of ${clusterPosts.length} similar posts`, // Will be improved by AI
      });
    }
  }

  // Sort clusters by size (largest first)
  clusters.sort((a, b) => b.size - a.size);
  console.log(
    `Created ${clusters.length} clusters with sizes: ${clusters
      .map((c) => c.size)
      .join(", ")}`
  );

  return clusters.slice(0, maxClusters);
}

async function storeClustersAndTriggerNext(
  jobId: string,
  clusters: PostCluster[],
  parameters: any
): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Store cluster results for next microservice
  const clusterData = {
    job_id: jobId,
    clusters: clusters.map((cluster) => ({
      id: cluster.id,
      size: cluster.size,
      theme_summary: cluster.theme_summary,
      representative_posts: cluster.representative_posts.map((post) => ({
        id: post.id,
        title: post.title,
        body: post.body,
        sentiment: post.sentiment,
        url: post.url,
      })),
    })),
    created_at: new Date().toISOString(),
  };

  // Store in temporary table for passing data between microservices
  const { error: storeError } = await supabase
    .from("cluster_results")
    .insert(clusterData);

  if (storeError) {
    console.error("Failed to store cluster results:", storeError);
    throw storeError;
  }

  console.log(`Stored ${clusters.length} clusters for job ${jobId}`);

  // Update job progress
  await updateJobStatus(jobId, {
    status: "running",
    progress: {
      current_step: "Clustering completed, starting idea generation",
      total_steps: 3,
      completed_steps: 1,
      clusters_found: clusters.length,
    },
  });

  // Trigger next microservice (idea-generator) with timeout handling
  const baseUrl = SUPABASE_URL!.replace(
    "supabase.co",
    "supabase.co/functions/v1"
  );
  
  try {
    // Add 10 minute timeout for idea generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    
    const generatorResponse = await fetch(`${baseUrl}/idea-generator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        job_id: jobId,
        clusters_count: clusters.length,
        ...parameters,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!generatorResponse.ok) {
      throw new Error(`Idea generator failed: ${generatorResponse.status}`);
    }
  } catch (error) {
    console.error(`Idea generator error:`, error);
    
    // Update job with error status instead of throwing
    await updateJobStatus(jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error: {
        step: "idea_generation",
        message: String(error),
        clusters_completed: clusters.length,
      },
    });
    
    throw error;
  }

  console.log(`Triggered idea-generator for job ${jobId}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST requests supported" }),
        {
          status: 405,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const requestData = await req.json();
    const {
      job_id: jobId,
      platform,
      days,
      limit,
      similarity_threshold,
      min_cluster_size,
      max_clusters_to_process,
    } = requestData;

    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    console.log(`Starting post clustering for job ${jobId}`);
    const startTime = Date.now();

    // Update job status
    await updateJobStatus(jobId, {
      status: "running",
      started_at: new Date().toISOString(),
      progress: {
        current_step: "Fetching and filtering posts",
        total_steps: 3,
        completed_steps: 0,
      },
    });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch posts with embeddings
    const sinceISO = new Date(
      Date.now() - (days || 14) * 86400000
    ).toISOString();

    let query = supabase
      .from("posts")
      .select(
        "id, title, body, sentiment, url, created_at, platform, embedding, is_complaint"
      )
      .not("title", "is", null)
      .not("body", "is", null)
      .not("embedding", "is", null)
      .gte("created_at", sinceISO);

    if (platform && platform !== "all") {
      query = query.eq("platform", platform);
    }

    const { data: rawPosts, error: postsError } = await query
      .order("created_at", { ascending: false })
      .limit(limit || 300);

    if (postsError || !rawPosts) {
      throw new Error(`Failed to fetch posts: ${postsError?.message}`);
    }

    console.log(`Fetched ${rawPosts.length} posts`);

    // Filter for SaaS opportunities
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
        (opportunityStats as any)[analysis.opportunityType]++;
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
          clusters_found: 0,
        },
      });

      return new Response(
        JSON.stringify({
          status: "completed",
          message: "No SaaS opportunity posts found",
          clusters_found: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    // Perform clustering
    await updateJobStatus(jobId, {
      progress: {
        current_step: "Performing semantic clustering",
        total_steps: 3,
        completed_steps: 0,
        posts_found: opportunityPosts.length,
      },
    });

    const clusters = clusterPostsBySimilarity(
      opportunityPosts,
      similarity_threshold || 0.6,
      min_cluster_size || 3,
      max_clusters_to_process || 10
    );

    if (clusters.length === 0) {
      await updateJobStatus(jobId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        result: {
          message: `No clusters found with threshold ${
            similarity_threshold || 0.6
          } and min size ${min_cluster_size || 3}`,
          clusters_found: 0,
        },
      });

      return new Response(
        JSON.stringify({
          status: "completed",
          message:
            "No clusters found - try lowering similarity_threshold or min_cluster_size",
          suggestion: "Try similarity_threshold=0.50 and min_cluster_size=2",
          clusters_found: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    // Store clusters and trigger next microservice
    await storeClustersAndTriggerNext(jobId, clusters, requestData);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        status: "success",
        message: `Clustering completed, triggered idea generation`,
        job_id: jobId,
        clusters_found: clusters.length,
        posts_processed: opportunityPosts.length,
        duration_ms: duration,
        function_info: {
          version: FUNCTION_VERSION,
          last_updated: LAST_UPDATED,
          service: "post-clusterer",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Post clustering error:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        error: String(error),
        function_info: {
          version: FUNCTION_VERSION,
          last_updated: LAST_UPDATED,
          service: "post-clusterer",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});
