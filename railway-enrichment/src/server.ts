// Railway High-Performance Enrichment Service - Process 99k posts efficiently
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { log } from "console";

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

// BALANCED CONFIGURATION - Optimized for reliability and speed
const AGGRESSIVE_BATCH_SIZE = 50; // Reasonable batch size
const MAX_CONCURRENT_REQUESTS = 10; // REDUCED: Lower concurrency to prevent OpenAI overload (was 20)
const MAX_POSTS_PER_RUN = 10000; // Process 10k posts per run
const MIN_INTER_BATCH_DELAY = 200; // INCREASED: Small delays to prevent rate limits (was 50ms)
const OPENAI_TIMEOUT_MS = 60000; // Increased to 60 second timeout
const MAX_RETRIES = 3;

// TURBO MODE - Balanced for speed and reliability
const TURBO_BATCH_SIZE = 100; // Keep large batches
const TURBO_CONCURRENT_REQUESTS = 15; // REDUCED: Lower max concurrency (was 30)

// Embedding configuration - Use large model with reduced dimensions for compatibility
const EMBEDDING_MODEL = "text-embedding-3-large"; // Higher quality embeddings
const EXPECTED_EMBED_DIM = 1536; // Reduced dimensions for database compatibility
const EMBEDDING_DIMENSIONS = 1536; // Specify dimensions in API call (reduces from 3072 to 1536)
const EMBED_CHAR_LIMIT = 8000;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// Single-post processing configuration
const POSTS_PER_BATCH = 1; // Process one post at a time
const INTER_POST_DELAY = 1000; // 1 second delay between posts


// CONTINUOUS ENRICHMENT LISTENER CONFIGURATION
const LISTENER_ENABLED = process.env.ENABLE_LISTENER !== "false"; // Default enabled
const LISTENER_INTERVAL_MS = 60000; // Check every 60 seconds (slower to be gentle on OpenAI)
const MIN_POSTS_TO_PROCESS = 5; // Start with fewer posts
const LISTENER_BATCH_SIZE = 20; // Process 20 posts per run
const LISTENER_CONCURRENCY = MAX_CONCURRENT_REQUESTS; // Use same concurrency as main config

// Listener state
let isListenerRunning = false;
let isProcessing = false;
let listenerStats = {
  totalProcessed: 0,
  lastRunTime: null as Date | null,
  consecutiveErrors: 0,
  status: "stopped" as "running" | "stopped" | "error",
};

interface PostData {
  id: number;
  title: string | null;
  body: string | null;
  platform: string;
  created_at: string;
}

interface EnrichmentResult {
  post_id: number;
  sentiment: number;
  sentiment_label: string;
  is_complaint: boolean;
  keywords: string[];
  embedding: number[];
  themes?: string[];
  confidence: number;
  // New SaaS-focused fields
  saas_score?: number;
  pain_points?: string[];
}

async function updateJobStatus(jobId: string, updates: any): Promise<void> {
  try {
    const { error } = await supabase
      .from("enrichment_jobs")
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

// Removed fallback heuristics - AI-only approach for consistency

// Simple single-post analysis function
async function analyzeSinglePost(post: PostData): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key required for sentiment analysis");
  }

  const content = `${post.title || ""} ${post.body || ""}`.trim();
  if (!content) {
    throw new Error("Post has no content to analyze");
  }

  // Smart content handling - use full content up to reasonable limit
  const maxContentLength = 8000; // ~2000 tokens, well within GPT-4o-mini limits
  let analysisContent = content;
  
  if (content.length > maxContentLength) {
    // Keep title + first part of body, truncate intelligently
    const title = post.title || "";
    const bodyLimit = maxContentLength - title.length - 100; // Reserve space
    const truncatedBody = (post.body || "").slice(0, bodyLimit);
    
    // Try to truncate at sentence boundary
    const lastSentence = truncatedBody.lastIndexOf('. ');
    if (lastSentence > bodyLimit * 0.8) { // If we can keep 80% and end on sentence
      analysisContent = `${title} ${truncatedBody.slice(0, lastSentence + 1)}`;
    } else {
      analysisContent = `${title} ${truncatedBody}...`;
    }
  }

  const analysisPrompt = `Analyze this ${post.platform || 'social media'} post for SaaS business opportunity signals. Focus on pain points, workflow frustrations, and unmet software needs.

Platform: ${post.platform || 'Unknown'}
Post: ${analysisContent}

Analyze for:
1. SENTIMENT: Overall emotional tone (-1 to 1)
2. COMPLAINT: Is this expressing frustration with current tools/processes?
3. KEYWORDS: Extract SaaS-relevant terms (tools, software, workflows, pain points)

Consider these SaaS opportunity indicators:
- Manual process frustrations
- Tool limitations or missing features  
- Workflow inefficiencies
- Integration problems
- Pricing/feature complaints
- "I wish there was a tool that..."

Platform-specific context:
- Reddit: Look for detailed problem descriptions, community discussions about tools
- Twitter: Brief complaints, quick pain points, tool mentions
- Other platforms: Adapt analysis to typical communication patterns

Return ONLY valid JSON:
{
  "sentiment": 0.1,
  "sentiment_label": "frustrated|satisfied|neutral|excited", 
  "is_complaint": false,
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "saas_opportunity_score": 0.7,
  "pain_points": ["specific pain point 1", "pain point 2"]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", 
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system", 
            content: "You are a SaaS business opportunity analyst. Identify pain points, tool frustrations, and unmet software needs in social media posts from various platforms (Reddit, Twitter, etc.). Adapt your analysis based on the platform context and communication style. Return valid JSON with sentiment between -1 and 1, saas_opportunity_score between 0 and 1."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`OpenAI failed: ${response.status}`);
    }

    const result: any = await response.json();
    const analysisContent = result.choices[0]?.message?.content;
    
    if (!analysisContent) {
      throw new Error("Empty response from OpenAI");
    }

    console.log(`Analysis for post ${post.id}:`, analysisContent);

    return JSON.parse(analysisContent);
    
  } catch (error: any) {
    console.error(`Analysis failed for post ${post.id}:`, error.message);
    throw error; // Fail cleanly without fallback
  }
}

function cleanForEmbedding(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // Remove code blocks
    .replace(/`[^`]*`/g, " ") // Remove inline code
    .replace(/https?:\/\/\S+/g, " ") // Remove URLs
    .replace(/<[^>]+>/g, " ") // Remove HTML tags
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

function chunkByChars(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const end = Math.min(i + maxChars, text.length);
    const slice = text.slice(i, end);
    const lastSpace = slice.lastIndexOf(" ");
    const splitPoint = lastSpace > maxChars * 0.7 ? i + lastSpace : end;

    chunks.push(text.slice(i, splitPoint));
    i = splitPoint;
  }

  return chunks;
}

function meanVectors(vectors: number[][]): number[] {
  const numVectors = vectors.length;
  if (numVectors === 1) return vectors[0];

  const dimensions = vectors[0].length;
  const result = new Array(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      result[i] += vector[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    result[i] /= numVectors;
  }

  return result;
}

async function analyzeWithOpenAI(posts: PostData[]): Promise<any[]> {
  if (!OPENAI_API_KEY) {
    console.error("No OPENAI_API_KEY — cannot perform AI analysis");
    throw new Error("OpenAI API key required for sentiment analysis");
  }

  // Limit to smaller batches for OpenAI to prevent malformed JSON
  const maxPostsForAnalysis = Math.min(posts.length, 20); // Reduced from 100 to 20
  const postsToAnalyze = posts.slice(0, maxPostsForAnalysis);

  const analysisPrompt = `Analyze these ${
    postsToAnalyze.length
  } posts for sentiment, complaint detection, and keywords. Return ONLY a valid JSON object with a "results" array.

Posts:
${postsToAnalyze
  .map((post, i) =>
    `${i + 1}. ${(post.title || "") + " " + (post.body || "")}`.slice(0, 300)
  )
  .join("\n\n")}

Return exactly this format:
{
  "results": [
    {"sentiment": 0.1, "sentiment_label": "neutral", "is_complaint": false, "keywords": ["word1", "word2"]},
    {"sentiment": -0.5, "sentiment_label": "negative", "is_complaint": true, "keywords": ["word3", "word4"]}
  ]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a precise JSON analyzer. Always return valid JSON with complete numeric values. Never truncate numbers.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        temperature: 0,
        max_tokens: 4000, // Increased for larger responses
      }),
      signal: AbortSignal.timeout(60000), // Increased timeout to 60 seconds
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI analysis failed: ${response.status} - ${errorText}`
      );
    }

    const result: any = await response.json();
    const content = result.choices[0]?.message?.content;

    try {
      const parsed = JSON.parse(content);
      const results = parsed.results || parsed;

      if (Array.isArray(results) && results.length > 0) {
        // Pad results to match all posts - use fallback for remainder
        const allResults = [];
        for (let i = 0; i < posts.length; i++) {
          if (i < results.length && results[i]) {
            allResults.push(results[i]);
          } else {
            // Skip posts that couldn't be analyzed - mark as failed
            console.warn(`Post ${posts[i].id} could not be analyzed by OpenAI`);
            allResults.push(null); // Will be filtered out later
          }
        }
        return allResults;
      }
      throw new Error("Invalid results format");
    } catch (parseError: any) {
      console.error(
        "Failed to parse OpenAI response:",
        content?.slice(0, 1000) + "..."
      );
      console.error("Parse error:", parseError.message);
      throw parseError;
    }
  } catch (error: any) {
    console.error(
      "OpenAI analysis failed, using fallback heuristics:",
      error.message
    );
    // Fail gracefully - don't use unreliable fallback
    console.error("OpenAI analysis failed completely");
    throw new Error("AI sentiment analysis unavailable");
  }
}

// DEPRECATED: Old chunking function - DO NOT USE
async function generateEmbeddings_DEPRECATED(posts: PostData[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY — returning default embeddings");
    return posts.map(() => new Array(1536).fill(0.001));
  }

  const allEmbeddings: number[][] = [];

  for (const post of posts) {
    try {
      const fullText = `${post.title || ""}\n${post.body || ""}`.trim();
      if (!fullText || fullText.length < 3) {
        console.warn(`Empty text for post ${post.id}, using default embedding`);
        allEmbeddings.push(new Array(1536).fill(0.001));
        continue;
      }

      // Clean and chunk text for better embeddings
      const cleaned = cleanForEmbedding(fullText);
      const chunks = chunkByChars(cleaned, EMBED_CHAR_LIMIT);
      const vectors: number[][] = [];

      for (let i = 0; i < chunks.length; i++) {
        let lastError: any;

        // Retry with exponential backoff
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const response = await fetch(
              "https://api.openai.com/v1/embeddings",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${OPENAI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: EMBEDDING_MODEL,
                  input: chunks[i],
                  dimensions: EMBEDDING_DIMENSIONS, // Request reduced dimensions
                }),
                signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              lastError = new Error(
                `OpenAI Embedding ${response.status}: ${errorText.slice(
                  0,
                  200
                )}`
              );

              // Retry on rate limit or server errors
              if (
                response.status === 429 ||
                (response.status >= 500 && response.status < 600)
              ) {
                console.warn(
                  `Embedding attempt ${attempt}/${MAX_RETRIES} failed for post ${
                    post.id
                  } chunk ${i + 1}: ${response.status} - retrying...`
                );
                await sleep(1000 * attempt * attempt); // Exponential backoff
                continue;
              }
              throw lastError;
            }

            const data: any = await response.json();
            const vector = data?.data?.[0]?.embedding;

            if (Array.isArray(vector) && vector.length === 1536) {
              vectors.push(vector);
              break; // Success - exit retry loop
            } else {
              console.error(
                `Invalid vector dimensions for post ${post.id} chunk ${
                  i + 1
                }: expected 1536, got ${vector?.length}`
              );
              break;
            }
          } catch (error) {
            lastError = error;
            console.warn(
              `Embedding attempt ${attempt}/${MAX_RETRIES} error for post ${
                post.id
              } chunk ${i + 1}:`,
              error
            );

            if (attempt < MAX_RETRIES) {
              await sleep(1000 * attempt * attempt);
            }
          }
        }

        if (lastError && vectors.length === 0) {
          console.error(
            `All embedding attempts failed for post ${post.id} chunk ${i + 1}:`,
            lastError
          );
        }
      }

      // Use mean of vectors if multiple chunks, or default if no valid vectors
      if (vectors.length > 0) {
        allEmbeddings.push(meanVectors(vectors));
      } else {
        console.warn(`No valid embeddings for post ${post.id}, using default`);
        allEmbeddings.push(new Array(1536).fill(0.001));
      }
    } catch (error) {
      console.error(`Embedding generation failed for post ${post.id}:`, error);
      allEmbeddings.push(new Array(1536).fill(0.001));
    }
  }

  console.log(
    `Generated ${allEmbeddings.length} embeddings for ${posts.length} posts`
  );
  return allEmbeddings;
}

// Generate embedding for single post - simpler and more reliable
async function generateSingleEmbedding(post: PostData): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key required for embeddings");
  }

  try {
    const fullText = `${post.title || ""}\n${post.body || ""}`.trim();
    if (!fullText) {
      throw new Error("Post has no content for embedding");
    }

    const cleaned = cleanForEmbedding(fullText);
    const truncated = cleaned.slice(0, EMBED_CHAR_LIMIT); // Simple truncation instead of chunking

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: truncated,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.status}`);
    }

    const data: any = await response.json();
    const vector = data?.data?.[0]?.embedding;

    if (Array.isArray(vector) && vector.length === EXPECTED_EMBED_DIM) {
      return vector;
    } else {
      throw new Error(`Invalid embedding dimensions: got ${vector?.length}, expected ${EXPECTED_EMBED_DIM}`);
    }

  } catch (error: any) {
    console.error(`Embedding failed for post ${post.id}:`, error.message);
    throw error; // Don't use fallback embeddings
  }
}


// Process single post - simple and reliable
async function processSinglePost(post: PostData): Promise<EnrichmentResult | null> {
  console.log(`Processing post ${post.id}`);

  try {
    // Analyze and generate embedding for single post
    const [analysis, embedding] = await Promise.all([
      analyzeSinglePost(post),
      generateSingleEmbedding(post)
    ]);


    const result: EnrichmentResult = {
      post_id: post.id,
      sentiment: analysis.sentiment || 0,
      sentiment_label: analysis.sentiment_label || "neutral",
      is_complaint: analysis.is_complaint || false,
      keywords: analysis.keywords || [],
      embedding: embedding || [],
      confidence: 0.9, // Higher confidence for single-post processing
      saas_score: analysis.saas_opportunity_score || 0,
      pain_points: analysis.pain_points || []
    };

    console.log(`✅ Post ${post.id} enriched successfully`);
    return result;

  } catch (error: any) {
    console.error(`❌ Post ${post.id} failed:`, error.message);
    return null; // Return null for failed posts
  }
}

// Process batch using single-post approach with delays
async function processSinglePostBatch(posts: PostData[], batchIndex: number): Promise<EnrichmentResult[]> {
  console.log(`Starting batch ${batchIndex} with ${posts.length} posts`);
  
  const results: EnrichmentResult[] = [];
  
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    try {
      const result = await processSinglePost(post);
      if (result) {
        results.push(result);
      }
      
      // Add delay between posts to avoid overwhelming OpenAI
      if (i < posts.length - 1) {
        await sleep(INTER_POST_DELAY);
      }
      
    } catch (error: any) {
      console.error(`Batch ${batchIndex}, post ${i} failed:`, error.message);
    }
  }
  
  console.log(`✅ Batch ${batchIndex} completed: ${results.length}/${posts.length} posts successful`);
  return results;
}

async function saveEnrichmentResults(
  results: EnrichmentResult[]
): Promise<void> {
  if (results.length === 0) return;

  console.log(`Saving ${results.length} enrichment results to database...`);

  let saved = 0;
  let skipped = 0;

  // Update posts in batches to avoid memory issues
  const batchSize = 100;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);

    for (const result of batch) {
      // Validate embedding before saving
      if (!result.embedding || result.embedding.length === 0) {
        console.warn(`Skipping post ${result.post_id} - invalid embedding`);
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("posts")
        .update({
          sentiment: result.sentiment,
          is_complaint: result.is_complaint,
          keywords: result.keywords,
          embedding: result.embedding,
          pain_points: result.pain_points,
          saas_score: result.saas_score,
          enriched_at: new Date().toISOString(),
          enrich_status: "completed",
        })
        .eq("id", result.post_id);

      if (error) {
        console.error(`Failed to update post ${result.post_id}:`, error);
        // If it's a vector dimension error, skip this post
        if (error.message.includes("vector must have at least 1 dimension")) {
          console.warn(
            `Skipping post ${result.post_id} due to embedding dimension error`
          );
          skipped++;
        }
      } else {
        saved++;
      }
    }

    // Small delay between database batches
    if (i + batchSize < results.length) {
      await sleep(50);
    }
  }

  console.log(
    `Successfully saved ${saved} enrichment results, skipped ${skipped} invalid`
  );
}

// CONTINUOUS ENRICHMENT LISTENER
async function checkForUnenrichedPosts(): Promise<number> {
  try {
    // Simple query: posts where enrich_status is 'pending' or null
    const { count, error } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .or("enrich_status.is.null,enrich_status.eq.pending");

    if (error) {
      console.error("Error counting unenriched posts:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Exception counting unenriched posts:", error);
    return 0;
  }
}

async function runContinuousEnrichment(): Promise<void> {
  if (isProcessing) {
    console.log("🔄 Enrichment already in progress, skipping...");
    return;
  }

  isProcessing = true;
  const startTime = Date.now();

  try {
    console.log("🚀 TURBO LISTENER: Checking for unenriched posts...");

    const unenrichedCount = await checkForUnenrichedPosts();
    console.log(`📊 Found ${unenrichedCount} posts needing enrichment`);

    if (unenrichedCount < MIN_POSTS_TO_PROCESS) {
      console.log(
        `⏸️  Not enough posts to process (min: ${MIN_POSTS_TO_PROCESS})`
      );
      listenerStats.consecutiveErrors = 0; // Reset error count on success
      return;
    }

    // Fetch posts to process in turbo batches
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, title, body, platform, created_at")
      .or("enrich_status.is.null,enrich_status.eq.pending")
      .order("created_at", { ascending: false })
      .limit(LISTENER_BATCH_SIZE * LISTENER_CONCURRENCY); // Get enough for all concurrent batches

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      console.log("✅ No posts found to enrich");
      return;
    }

    console.log(
      `⚡ TURBO: Processing ${posts.length} posts with MAXIMUM concurrency...`
    );

    console.log(`🔥 Processing ${posts.length} posts one by one with controlled concurrency`);

    // Process posts with limited concurrency to avoid overwhelming OpenAI
    const allResults: EnrichmentResult[] = [];
    
    for (let i = 0; i < posts.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = posts.slice(i, i + MAX_CONCURRENT_REQUESTS);
      
      console.log(`Processing posts ${i + 1}-${Math.min(i + MAX_CONCURRENT_REQUESTS, posts.length)} of ${posts.length}`);
      
      // Process small batch concurrently
      const batchPromises = batch.map(post => processSinglePost(post));
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out null results (failed posts)
      const successfulResults = batchResults.filter(result => result !== null) as EnrichmentResult[];
      allResults.push(...successfulResults);
      
      console.log(`✅ Batch completed: ${successfulResults.length}/${batch.length} posts successful`);
      
      // Add delay between batches to avoid rate limits
      if (i + MAX_CONCURRENT_REQUESTS < posts.length) {
        console.log(`Waiting ${INTER_POST_DELAY}ms before next batch...`);
        await sleep(INTER_POST_DELAY);
      }
    }

    // Save all results
    await saveEnrichmentResults(allResults);

    const duration = Date.now() - startTime;
    const processed = allResults.length;

    listenerStats.totalProcessed += processed;
    listenerStats.lastRunTime = new Date();
    listenerStats.consecutiveErrors = 0;
    listenerStats.status = "running";

    console.log(
      `✅ TURBO LISTENER: Processed ${processed} posts in ${duration}ms (${Math.round(
        processed / (duration / 1000)
      )} posts/sec)`
    );
    console.log(
      `📈 Total processed by listener: ${listenerStats.totalProcessed}`
    );
  } catch (error: any) {
    listenerStats.consecutiveErrors++;
    listenerStats.status = "error";
    console.error(`❌ TURBO LISTENER ERROR:`, error.message);

    // If too many consecutive errors, slow down
    if (listenerStats.consecutiveErrors >= 3) {
      console.warn(
        `⚠️  ${listenerStats.consecutiveErrors} consecutive errors, adding delay...`
      );
      await sleep(60000); // Wait 1 minute before next attempt
    }
  } finally {
    isProcessing = false;
  }
}

function startContinuousListener(): void {
  if (isListenerRunning) {
    console.log("🔄 Listener already running");
    return;
  }

  if (!LISTENER_ENABLED) {
    console.log("🚫 Continuous listener disabled via ENABLE_LISTENER=false");
    return;
  }

  console.log(
    `🚀 Starting TURBO enrichment listener (interval: ${
      LISTENER_INTERVAL_MS / 1000
    }s, min posts: ${MIN_POSTS_TO_PROCESS})`
  );

  isListenerRunning = true;
  listenerStats.status = "running";

  // Run immediately, then start interval
  runContinuousEnrichment();

  setInterval(async () => {
    if (isListenerRunning) {
      await runContinuousEnrichment();
    }
  }, LISTENER_INTERVAL_MS);
}

function stopContinuousListener(): void {
  console.log("🛑 Stopping continuous enrichment listener");
  isListenerRunning = false;
  listenerStats.status = "stopped";
}

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "Railway High-Performance Enrichment Service",
    version: "1.0.0",
    platform: "Railway",
    status: "running",
    capabilities: [
      "Aggressive batching (50-100 posts/batch)",
      "Ultra-high concurrency (20-30 parallel batches)",
      "Fast processing (10k posts/run)",
      "Optimized for 99k posts",
      "Parallel analysis and embeddings",
      "Concurrent batch processing",
      "Turbo mode available",
    ],
    performance: {
      max_posts_per_run: MAX_POSTS_PER_RUN,
      batch_size: AGGRESSIVE_BATCH_SIZE,
      concurrent_requests: MAX_CONCURRENT_REQUESTS,
      turbo_mode: {
        batch_size: TURBO_BATCH_SIZE,
        concurrent_requests: TURBO_CONCURRENT_REQUESTS,
      },
      estimated_time_99k: "~10 runs at 10k posts each = ~30-60 minutes total",
    },
    endpoints: {
      health: "/health",
      enrich: "/enrich-posts",
      turbo: "/enrich-posts-turbo",
      listener_start: "/listener/start",
      listener_stop: "/listener/stop",
      listener_status: "/listener/status",
    },
    listener: {
      enabled: LISTENER_ENABLED,
      status: listenerStats.status,
      interval_seconds: LISTENER_INTERVAL_MS / 1000,
      total_processed: listenerStats.totalProcessed,
      last_run: listenerStats.lastRunTime,
      consecutive_errors: listenerStats.consecutiveErrors,
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

app.post("/enrich-posts", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const {
      job_id = `enrich_${Date.now()}`,
      limit = MAX_POSTS_PER_RUN,
      batch_size = AGGRESSIVE_BATCH_SIZE,
      concurrent_requests = MAX_CONCURRENT_REQUESTS,
    } = req.body;

    console.log(
      `Starting high-performance enrichment: ${limit} posts, ${batch_size} batch size, ${concurrent_requests} concurrent`
    );

    // Fetch unenriched posts
    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select("id, title, body, platform, created_at")
      .or("enrich_status.is.null,enrich_status.eq.pending") // Only unenriched posts
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError || !posts) {
      throw new Error(`Failed to fetch posts: ${fetchError?.message}`);
    }

    console.log(`Fetched ${posts.length} unenriched posts`);

    if (posts.length === 0) {
      res.json({
        success: true,
        message: "No posts need enrichment",
        posts_processed: 0,
        duration_ms: Date.now() - startTime,
      });
      return;
    }

    // Create batches
    const batches: PostData[][] = [];
    for (let i = 0; i < posts.length; i += batch_size) {
      batches.push(posts.slice(i, i + batch_size));
    }

    console.log(`Created ${batches.length} batches for processing`);

    // Process batches with CONCURRENT BATCH PROCESSING for maximum speed
    const allResults: EnrichmentResult[] = [];

    console.log(
      `🚀 Starting concurrent batch processing: ${concurrent_requests} batches in parallel`
    );

    // Process batches in parallel groups
    const batchPromises: Promise<EnrichmentResult[]>[] = [];

    for (let i = 0; i < batches.length; i += concurrent_requests) {
      const batchGroup = batches.slice(i, i + concurrent_requests);

      // Start all batches in this group concurrently
      const groupPromises = batchGroup.map((batch, groupIndex) =>
        processSinglePostBatch(batch, i + groupIndex)
      );

      batchPromises.push(...groupPromises);

      // If we've queued enough batches or reached the end, process them
      if (
        batchPromises.length >= concurrent_requests ||
        i + concurrent_requests >= batches.length
      ) {
        console.log(
          `⚡ Processing ${batchPromises.length} batches concurrently...`
        );

        const groupResults = await Promise.all(batchPromises);

        // Flatten and save results immediately
        const flatResults = groupResults.flat();
        allResults.push(...flatResults);

        await saveEnrichmentResults(flatResults);

        console.log(
          `✅ Completed ${groupResults.length} concurrent batches. Total processed: ${allResults.length} posts`
        );

        // Clear the promises array for next group
        batchPromises.length = 0;

        // Small delay between concurrent groups
        if (i + concurrent_requests < batches.length) {
          await sleep(MIN_INTER_BATCH_DELAY);
        }
      }
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: `Successfully enriched ${allResults.length} posts`,
      job_id,
      posts_processed: allResults.length,
      posts_enriched: allResults.filter((r) => r.embedding.length > 0).length,
      batches_processed: batches.length,
      duration_ms: duration,
      duration_readable: `${Math.round(duration / 1000)}s`,
      performance: {
        posts_per_second: Math.round(allResults.length / (duration / 1000)),
        avg_batch_time: Math.round(duration / batches.length),
      },
      platform_info: {
        name: "railway",
        service: "high-performance-enrichment",
        version: "1.0.0",
        optimizations: [
          "Aggressive batching",
          "High concurrency",
          "Parallel API calls",
          "Immediate saves",
          "Minimal delays",
        ],
      },
    });
  } catch (error) {
    console.error("High-performance enrichment error:", error);
    const duration = Date.now() - startTime;

    res.status(500).json({
      success: false,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "railway",
        service: "high-performance-enrichment",
        version: "1.0.0",
      },
    });
  }
});

// TURBO MODE - Ultra-fast enrichment with maximum concurrency
app.post("/enrich-posts-turbo", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { job_id = `enrich_turbo_${Date.now()}`, limit = MAX_POSTS_PER_RUN } =
      req.body;

    console.log(
      `🔥 TURBO MODE: Starting ultra-fast enrichment with ${TURBO_CONCURRENT_REQUESTS} concurrent batches`
    );

    // Fetch unenriched posts
    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select("id, title, body, platform, created_at")
      .or("enrich_status.is.null,enrich_status.eq.pending") // Only unenriched posts
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchError || !posts) {
      throw new Error(`Failed to fetch posts: ${fetchError?.message}`);
    }

    if (posts.length === 0) {
      res.json({
        success: true,
        message: "No posts need enrichment",
        posts_processed: 0,
        duration_ms: Date.now() - startTime,
        mode: "turbo",
      });
      return;
    }

    // Create larger batches for turbo mode
    const batches: PostData[][] = [];
    for (let i = 0; i < posts.length; i += TURBO_BATCH_SIZE) {
      batches.push(posts.slice(i, i + TURBO_BATCH_SIZE));
    }

    console.log(
      `🚀 TURBO: Created ${batches.length} batches of ${TURBO_BATCH_SIZE} posts each`
    );

    // Process with maximum concurrency
    const allResults: EnrichmentResult[] = [];
    const batchPromises: Promise<EnrichmentResult[]>[] = [];

    for (let i = 0; i < batches.length; i += TURBO_CONCURRENT_REQUESTS) {
      const batchGroup = batches.slice(i, i + TURBO_CONCURRENT_REQUESTS);

      const groupPromises = batchGroup.map((batch, groupIndex) =>
        processSinglePostBatch(batch, i + groupIndex)
      );

      batchPromises.push(...groupPromises);

      if (
        batchPromises.length >= TURBO_CONCURRENT_REQUESTS ||
        i + TURBO_CONCURRENT_REQUESTS >= batches.length
      ) {
        console.log(
          `⚡ TURBO: Processing ${batchPromises.length} batches with MAXIMUM concurrency...`
        );

        const groupResults = await Promise.all(batchPromises);
        const flatResults = groupResults.flat();
        allResults.push(...flatResults);

        await saveEnrichmentResults(flatResults);

        console.log(
          `🔥 TURBO: Completed ${groupResults.length} concurrent batches. Total: ${allResults.length} posts`
        );

        batchPromises.length = 0;

        // Minimal delay in turbo mode
        if (i + TURBO_CONCURRENT_REQUESTS < batches.length) {
          await sleep(25); // Even shorter delay
        }
      }
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      message: `🔥 TURBO MODE: Successfully enriched ${allResults.length} posts`,
      job_id,
      posts_processed: allResults.length,
      posts_enriched: allResults.filter((r) => r.embedding.length > 0).length,
      batches_processed: batches.length,
      duration_ms: duration,
      duration_readable: `${Math.round(duration / 1000)}s`,
      performance: {
        posts_per_second: Math.round(allResults.length / (duration / 1000)),
        avg_batch_time: Math.round(duration / batches.length),
        mode: "TURBO",
      },
      platform_info: {
        name: "railway",
        service: "turbo-enrichment",
        version: "1.0.0",
        mode: "MAXIMUM_PERFORMANCE",
        optimizations: [
          "Ultra-large batches (100 posts)",
          "Maximum concurrency (30 parallel)",
          "Parallel API calls",
          "Immediate saves",
          "Minimal delays (25ms)",
        ],
      },
    });
  } catch (error) {
    console.error("Turbo enrichment error:", error);
    const duration = Date.now() - startTime;

    res.status(500).json({
      success: false,
      error: String(error),
      duration_ms: duration,
      mode: "turbo",
      platform_info: {
        name: "railway",
        service: "turbo-enrichment",
        version: "1.0.0",
      },
    });
  }
});

// CONTINUOUS LISTENER CONTROL ROUTES
app.post("/listener/start", (_req: Request, res: Response) => {
  try {
    startContinuousListener();
    res.json({
      message: "🚀 TURBO listener started successfully",
      status: "started",
      config: {
        interval_seconds: LISTENER_INTERVAL_MS / 1000,
        batch_size: LISTENER_BATCH_SIZE,
        concurrency: LISTENER_CONCURRENCY,
        min_posts: MIN_POSTS_TO_PROCESS,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to start listener",
      message: error.message,
    });
  }
});

app.post("/listener/stop", (_req: Request, res: Response) => {
  try {
    stopContinuousListener();
    res.json({
      message: "🛑 TURBO listener stopped successfully",
      status: "stopped",
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to stop listener",
      message: error.message,
    });
  }
});

app.get("/listener/status", (_req: Request, res: Response) => {
  res.json({
    enabled: LISTENER_ENABLED,
    running: isListenerRunning,
    processing: isProcessing,
    stats: listenerStats,
    config: {
      interval_seconds: LISTENER_INTERVAL_MS / 1000,
      batch_size: LISTENER_BATCH_SIZE,
      concurrency: LISTENER_CONCURRENCY,
      min_posts_threshold: MIN_POSTS_TO_PROCESS,
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 High-Performance Enrichment Service running on port ${PORT}`);
  console.log(`⚡ Optimized for 99k posts with concurrent batch processing:`);
  console.log(
    `   - Normal mode: ${AGGRESSIVE_BATCH_SIZE} posts/batch, ${MAX_CONCURRENT_REQUESTS} concurrent batches`
  );
  console.log(
    `   - Turbo mode: ${TURBO_BATCH_SIZE} posts/batch, ${TURBO_CONCURRENT_REQUESTS} concurrent batches`
  );
  console.log(`   - Max per run: ${MAX_POSTS_PER_RUN} posts`);
  console.log(
    `   - Estimated time for 99k posts: ~30-60 minutes with turbo mode`
  );
  console.log(`📡 Endpoints:`);
  console.log(`   - Regular: /enrich-posts`);
  console.log(`   - Turbo: /enrich-posts-turbo`);
  console.log(
    `   - Listener: /listener/start, /listener/stop, /listener/status`
  );

  // Auto-start continuous listener
  if (LISTENER_ENABLED) {
    console.log(`🚀 Auto-starting TURBO continuous enrichment listener...`);
    startContinuousListener();
  } else {
    console.log(
      `⏸️  Continuous listener disabled (set ENABLE_LISTENER=true to enable)`
    );
  }
});

export default app;
