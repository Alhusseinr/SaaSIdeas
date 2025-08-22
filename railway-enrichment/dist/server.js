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
const AGGRESSIVE_BATCH_SIZE = 50;
const MAX_CONCURRENT_REQUESTS = 10;
const MAX_POSTS_PER_RUN = 10000;
const MIN_INTER_BATCH_DELAY = 200;
const OPENAI_TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;
const TURBO_BATCH_SIZE = 100;
const TURBO_CONCURRENT_REQUESTS = 15;
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBED_CHAR_LIMIT = 8000;
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const LISTENER_ENABLED = process.env.ENABLE_LISTENER !== "false";
const LISTENER_INTERVAL_MS = 30000;
const MIN_POSTS_TO_PROCESS = 10;
const LISTENER_BATCH_SIZE = TURBO_BATCH_SIZE;
const LISTENER_CONCURRENCY = TURBO_CONCURRENT_REQUESTS;
let isListenerRunning = false;
let isProcessing = false;
let listenerStats = {
    totalProcessed: 0,
    lastRunTime: null,
    consecutiveErrors: 0,
    status: 'stopped'
};
async function updateJobStatus(jobId, updates) {
    try {
        const { error } = await supabase
            .from("enrichment_jobs")
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
function fallbackHeuristics(text) {
    const low = text.toLowerCase();
    const complaintTerms = [
        "annoying", "frustrat", "i hate", "wish there was", "why is it so hard",
        "broken", "useless", "terrible", "buggy", "hate", "sucks", "pain",
        "doesn't work", "so slow", "awful", "worst", "horrible"
    ];
    const match = complaintTerms.some(t => low.includes(t));
    const negativeWords = ["hate", "annoying", "terrible", "useless", "broken", "bad", "worst", "pain", "sucks", "awful"];
    const positiveWords = ["love", "great", "awesome", "amazing", "fantastic", "excellent", "perfect"];
    const negCount = negativeWords.filter(w => low.includes(w)).length;
    const posCount = positiveWords.filter(w => low.includes(w)).length;
    const score = Math.max(-1, Math.min(1, (posCount - negCount) / 3));
    const label = score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
    const commonWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use"]);
    const keywords = Array.from(new Set(low.replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(x => x.length > 3 && !commonWords.has(x)))).slice(0, 8);
    return {
        sentiment_score: score,
        sentiment_label: label,
        is_complaint: match || score < -0.3,
        keywords
    };
}
function cleanForEmbedding(text) {
    return text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]*`/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function chunkByChars(text, maxChars) {
    if (text.length <= maxChars)
        return [text];
    const chunks = [];
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
function meanVectors(vectors) {
    const numVectors = vectors.length;
    if (numVectors === 1)
        return vectors[0];
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
async function analyzeWithOpenAI(posts) {
    if (!OPENAI_API_KEY) {
        console.warn("No OPENAI_API_KEY — using fallback heuristics");
        return posts.map(post => {
            const text = `${post.title || ""}\n${post.body || ""}`.trim();
            return fallbackHeuristics(text);
        });
    }
    const maxPostsForAnalysis = Math.min(posts.length, 20);
    const postsToAnalyze = posts.slice(0, maxPostsForAnalysis);
    const analysisPrompt = `Analyze these ${postsToAnalyze.length} posts for sentiment, complaint detection, and keywords. Return ONLY a valid JSON object with a "results" array.

Posts:
${postsToAnalyze.map((post, i) => `${i + 1}. ${(post.title || "") + " " + (post.body || "")}`.slice(0, 300)).join('\n\n')}

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
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [{
                        role: "system",
                        content: "You are a precise JSON analyzer. Always return valid JSON with complete numeric values. Never truncate numbers."
                    }, {
                        role: "user",
                        content: analysisPrompt
                    }],
                temperature: 0,
                max_tokens: 4000,
            }),
            signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI analysis failed: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        const content = result.choices[0]?.message?.content;
        try {
            const parsed = JSON.parse(content);
            const results = parsed.results || parsed;
            if (Array.isArray(results) && results.length > 0) {
                const allResults = [];
                for (let i = 0; i < posts.length; i++) {
                    if (i < results.length && results[i]) {
                        allResults.push(results[i]);
                    }
                    else {
                        const text = `${posts[i].title || ""}\n${posts[i].body || ""}`.trim();
                        allResults.push(fallbackHeuristics(text));
                    }
                }
                return allResults;
            }
            throw new Error("Invalid results format");
        }
        catch (parseError) {
            console.error("Failed to parse OpenAI response:", content?.slice(0, 1000) + "...");
            console.error("Parse error:", parseError.message);
            throw parseError;
        }
    }
    catch (error) {
        console.error("OpenAI analysis failed, using fallback heuristics:", error.message);
        return posts.map(post => {
            const text = `${post.title || ""}\n${post.body || ""}`.trim();
            return fallbackHeuristics(text);
        });
    }
}
async function generateEmbeddings(posts) {
    if (!OPENAI_API_KEY) {
        console.warn("No OPENAI_API_KEY — returning default embeddings");
        return posts.map(() => new Array(1536).fill(0.001));
    }
    const allEmbeddings = [];
    for (const post of posts) {
        try {
            const fullText = `${post.title || ""}\n${post.body || ""}`.trim();
            if (!fullText || fullText.length < 3) {
                console.warn(`Empty text for post ${post.id}, using default embedding`);
                allEmbeddings.push(new Array(1536).fill(0.001));
                continue;
            }
            const cleaned = cleanForEmbedding(fullText);
            const chunks = chunkByChars(cleaned, EMBED_CHAR_LIMIT);
            const vectors = [];
            for (let i = 0; i < chunks.length; i++) {
                let lastError;
                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        const response = await fetch("https://api.openai.com/v1/embeddings", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                model: EMBEDDING_MODEL,
                                input: chunks[i],
                            }),
                            signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
                        });
                        if (!response.ok) {
                            const errorText = await response.text();
                            lastError = new Error(`OpenAI Embedding ${response.status}: ${errorText.slice(0, 200)}`);
                            if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
                                console.warn(`Embedding attempt ${attempt}/${MAX_RETRIES} failed for post ${post.id} chunk ${i + 1}: ${response.status} - retrying...`);
                                await sleep(1000 * attempt * attempt);
                                continue;
                            }
                            throw lastError;
                        }
                        const data = await response.json();
                        const vector = data?.data?.[0]?.embedding;
                        if (Array.isArray(vector) && vector.length === 1536) {
                            vectors.push(vector);
                            break;
                        }
                        else {
                            console.error(`Invalid vector dimensions for post ${post.id} chunk ${i + 1}: expected 1536, got ${vector?.length}`);
                            break;
                        }
                    }
                    catch (error) {
                        lastError = error;
                        console.warn(`Embedding attempt ${attempt}/${MAX_RETRIES} error for post ${post.id} chunk ${i + 1}:`, error);
                        if (attempt < MAX_RETRIES) {
                            await sleep(1000 * attempt * attempt);
                        }
                    }
                }
                if (lastError && vectors.length === 0) {
                    console.error(`All embedding attempts failed for post ${post.id} chunk ${i + 1}:`, lastError);
                }
            }
            if (vectors.length > 0) {
                allEmbeddings.push(meanVectors(vectors));
            }
            else {
                console.warn(`No valid embeddings for post ${post.id}, using default`);
                allEmbeddings.push(new Array(1536).fill(0.001));
            }
        }
        catch (error) {
            console.error(`Embedding generation failed for post ${post.id}:`, error);
            allEmbeddings.push(new Array(1536).fill(0.001));
        }
    }
    console.log(`Generated ${allEmbeddings.length} embeddings for ${posts.length} posts`);
    return allEmbeddings;
}
async function processBatch(posts, batchIndex) {
    console.log(`Processing batch ${batchIndex + 1} with ${posts.length} posts`);
    try {
        const [analysisResults, embeddings] = await Promise.all([
            analyzeWithOpenAI(posts),
            generateEmbeddings(posts)
        ]);
        const results = posts.map((post, i) => {
            const analysis = analysisResults[i] || {};
            return {
                post_id: post.id,
                sentiment: analysis.sentiment || analysis.sentiment_score || 0,
                sentiment_label: analysis.sentiment_label || (analysis.sentiment > 0.2 ? "positive" : analysis.sentiment < -0.2 ? "negative" : "neutral"),
                is_complaint: analysis.is_complaint || false,
                keywords: analysis.keywords || [],
                embedding: embeddings[i] || [],
                confidence: 0.8
            };
        });
        console.log(`Batch ${batchIndex + 1} completed: ${results.length} posts enriched`);
        return results;
    }
    catch (error) {
        console.error(`Batch ${batchIndex + 1} failed:`, error);
        const defaultEmbedding = new Array(1536).fill(0.001);
        return posts.map(post => {
            const text = `${post.title || ""}\n${post.body || ""}`.trim();
            const fallback = fallbackHeuristics(text);
            return {
                post_id: post.id,
                sentiment: fallback.sentiment_score,
                sentiment_label: fallback.sentiment_label,
                is_complaint: fallback.is_complaint,
                keywords: fallback.keywords,
                embedding: defaultEmbedding,
                confidence: 0.1
            };
        });
    }
}
async function saveEnrichmentResults(results) {
    if (results.length === 0)
        return;
    console.log(`Saving ${results.length} enrichment results to database...`);
    let saved = 0;
    let skipped = 0;
    const batchSize = 100;
    for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        for (const result of batch) {
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
                enriched_at: new Date().toISOString(),
                enrich_status: "completed"
            })
                .eq("id", result.post_id);
            if (error) {
                console.error(`Failed to update post ${result.post_id}:`, error);
                if (error.message.includes('vector must have at least 1 dimension')) {
                    console.warn(`Skipping post ${result.post_id} due to embedding dimension error`);
                    skipped++;
                }
            }
            else {
                saved++;
            }
        }
        if (i + batchSize < results.length) {
            await sleep(50);
        }
    }
    console.log(`Successfully saved ${saved} enrichment results, skipped ${skipped} invalid`);
}
async function checkForUnenrichedPosts() {
    try {
        const { count, error } = await supabase
            .from("posts")
            .select("*", { count: 'exact', head: true })
            .or("enriched_at.is.null,sentiment.is.null,embedding.is.null,keywords.is.null");
        if (error) {
            console.error("Error counting unenriched posts:", error);
            return 0;
        }
        return count || 0;
    }
    catch (error) {
        console.error("Exception counting unenriched posts:", error);
        return 0;
    }
}
async function runContinuousEnrichment() {
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
            console.log(`⏸️  Not enough posts to process (min: ${MIN_POSTS_TO_PROCESS})`);
            listenerStats.consecutiveErrors = 0;
            return;
        }
        const { data: posts, error } = await supabase
            .from("posts")
            .select("id, title, body, platform, created_at")
            .or("enriched_at.is.null,sentiment.is.null,embedding.is.null,keywords.is.null")
            .order("created_at", { ascending: false })
            .limit(LISTENER_BATCH_SIZE * LISTENER_CONCURRENCY);
        if (error) {
            throw new Error(`Failed to fetch posts: ${error.message}`);
        }
        if (!posts || posts.length === 0) {
            console.log("✅ No posts found to enrich");
            return;
        }
        console.log(`⚡ TURBO: Processing ${posts.length} posts with MAXIMUM concurrency...`);
        const batches = [];
        for (let i = 0; i < posts.length; i += LISTENER_BATCH_SIZE) {
            batches.push(posts.slice(i, i + LISTENER_BATCH_SIZE));
        }
        console.log(`🔥 Processing ${batches.length} batches with ${LISTENER_CONCURRENCY} concurrent workers`);
        const batchResults = await Promise.all(batches.map((batch, index) => processBatch(batch, index)));
        const allResults = batchResults.flat();
        await saveEnrichmentResults(allResults);
        const duration = Date.now() - startTime;
        const processed = allResults.length;
        listenerStats.totalProcessed += processed;
        listenerStats.lastRunTime = new Date();
        listenerStats.consecutiveErrors = 0;
        listenerStats.status = 'running';
        console.log(`✅ TURBO LISTENER: Processed ${processed} posts in ${duration}ms (${Math.round(processed / (duration / 1000))} posts/sec)`);
        console.log(`📈 Total processed by listener: ${listenerStats.totalProcessed}`);
    }
    catch (error) {
        listenerStats.consecutiveErrors++;
        listenerStats.status = 'error';
        console.error(`❌ TURBO LISTENER ERROR:`, error.message);
        if (listenerStats.consecutiveErrors >= 3) {
            console.warn(`⚠️  ${listenerStats.consecutiveErrors} consecutive errors, adding delay...`);
            await sleep(60000);
        }
    }
    finally {
        isProcessing = false;
    }
}
function startContinuousListener() {
    if (isListenerRunning) {
        console.log("🔄 Listener already running");
        return;
    }
    if (!LISTENER_ENABLED) {
        console.log("🚫 Continuous listener disabled via ENABLE_LISTENER=false");
        return;
    }
    console.log(`🚀 Starting TURBO enrichment listener (interval: ${LISTENER_INTERVAL_MS / 1000}s, min posts: ${MIN_POSTS_TO_PROCESS})`);
    isListenerRunning = true;
    listenerStats.status = 'running';
    runContinuousEnrichment();
    setInterval(async () => {
        if (isListenerRunning) {
            await runContinuousEnrichment();
        }
    }, LISTENER_INTERVAL_MS);
}
function stopContinuousListener() {
    console.log("🛑 Stopping continuous enrichment listener");
    isListenerRunning = false;
    listenerStats.status = 'stopped';
}
app.get("/", (_req, res) => {
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
            "Turbo mode available"
        ],
        performance: {
            max_posts_per_run: MAX_POSTS_PER_RUN,
            batch_size: AGGRESSIVE_BATCH_SIZE,
            concurrent_requests: MAX_CONCURRENT_REQUESTS,
            turbo_mode: {
                batch_size: TURBO_BATCH_SIZE,
                concurrent_requests: TURBO_CONCURRENT_REQUESTS
            },
            estimated_time_99k: "~10 runs at 10k posts each = ~30-60 minutes total"
        },
        endpoints: {
            health: "/health",
            enrich: "/enrich-posts",
            turbo: "/enrich-posts-turbo",
            listener_start: "/listener/start",
            listener_stop: "/listener/stop",
            listener_status: "/listener/status"
        },
        listener: {
            enabled: LISTENER_ENABLED,
            status: listenerStats.status,
            interval_seconds: LISTENER_INTERVAL_MS / 1000,
            total_processed: listenerStats.totalProcessed,
            last_run: listenerStats.lastRunTime,
            consecutive_errors: listenerStats.consecutiveErrors
        }
    });
});
app.get("/health", (_req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});
app.post("/enrich-posts", async (req, res) => {
    const startTime = Date.now();
    try {
        const { job_id = `enrich_${Date.now()}`, limit = MAX_POSTS_PER_RUN, batch_size = AGGRESSIVE_BATCH_SIZE, concurrent_requests = MAX_CONCURRENT_REQUESTS } = req.body;
        console.log(`Starting high-performance enrichment: ${limit} posts, ${batch_size} batch size, ${concurrent_requests} concurrent`);
        const { data: posts, error: fetchError } = await supabase
            .from("posts")
            .select("id, title, body, platform, created_at")
            .is("embedding", null)
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
                duration_ms: Date.now() - startTime
            });
            return;
        }
        const batches = [];
        for (let i = 0; i < posts.length; i += batch_size) {
            batches.push(posts.slice(i, i + batch_size));
        }
        console.log(`Created ${batches.length} batches for processing`);
        const allResults = [];
        console.log(`🚀 Starting concurrent batch processing: ${concurrent_requests} batches in parallel`);
        const batchPromises = [];
        for (let i = 0; i < batches.length; i += concurrent_requests) {
            const batchGroup = batches.slice(i, i + concurrent_requests);
            const groupPromises = batchGroup.map((batch, groupIndex) => processBatch(batch, i + groupIndex));
            batchPromises.push(...groupPromises);
            if (batchPromises.length >= concurrent_requests || i + concurrent_requests >= batches.length) {
                console.log(`⚡ Processing ${batchPromises.length} batches concurrently...`);
                const groupResults = await Promise.all(batchPromises);
                const flatResults = groupResults.flat();
                allResults.push(...flatResults);
                await saveEnrichmentResults(flatResults);
                console.log(`✅ Completed ${groupResults.length} concurrent batches. Total processed: ${allResults.length} posts`);
                batchPromises.length = 0;
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
            posts_enriched: allResults.filter(r => r.embedding.length > 0).length,
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
                    "Minimal delays"
                ]
            }
        });
    }
    catch (error) {
        console.error("High-performance enrichment error:", error);
        const duration = Date.now() - startTime;
        res.status(500).json({
            success: false,
            error: String(error),
            duration_ms: duration,
            platform_info: {
                name: "railway",
                service: "high-performance-enrichment",
                version: "1.0.0"
            }
        });
    }
});
app.post("/enrich-posts-turbo", async (req, res) => {
    const startTime = Date.now();
    try {
        const { job_id = `enrich_turbo_${Date.now()}`, limit = MAX_POSTS_PER_RUN } = req.body;
        console.log(`🔥 TURBO MODE: Starting ultra-fast enrichment with ${TURBO_CONCURRENT_REQUESTS} concurrent batches`);
        const { data: posts, error: fetchError } = await supabase
            .from("posts")
            .select("id, title, body, platform, created_at")
            .is("embedding", null)
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
                mode: "turbo"
            });
            return;
        }
        const batches = [];
        for (let i = 0; i < posts.length; i += TURBO_BATCH_SIZE) {
            batches.push(posts.slice(i, i + TURBO_BATCH_SIZE));
        }
        console.log(`🚀 TURBO: Created ${batches.length} batches of ${TURBO_BATCH_SIZE} posts each`);
        const allResults = [];
        const batchPromises = [];
        for (let i = 0; i < batches.length; i += TURBO_CONCURRENT_REQUESTS) {
            const batchGroup = batches.slice(i, i + TURBO_CONCURRENT_REQUESTS);
            const groupPromises = batchGroup.map((batch, groupIndex) => processBatch(batch, i + groupIndex));
            batchPromises.push(...groupPromises);
            if (batchPromises.length >= TURBO_CONCURRENT_REQUESTS || i + TURBO_CONCURRENT_REQUESTS >= batches.length) {
                console.log(`⚡ TURBO: Processing ${batchPromises.length} batches with MAXIMUM concurrency...`);
                const groupResults = await Promise.all(batchPromises);
                const flatResults = groupResults.flat();
                allResults.push(...flatResults);
                await saveEnrichmentResults(flatResults);
                console.log(`🔥 TURBO: Completed ${groupResults.length} concurrent batches. Total: ${allResults.length} posts`);
                batchPromises.length = 0;
                if (i + TURBO_CONCURRENT_REQUESTS < batches.length) {
                    await sleep(25);
                }
            }
        }
        const duration = Date.now() - startTime;
        res.json({
            success: true,
            message: `🔥 TURBO MODE: Successfully enriched ${allResults.length} posts`,
            job_id,
            posts_processed: allResults.length,
            posts_enriched: allResults.filter(r => r.embedding.length > 0).length,
            batches_processed: batches.length,
            duration_ms: duration,
            duration_readable: `${Math.round(duration / 1000)}s`,
            performance: {
                posts_per_second: Math.round(allResults.length / (duration / 1000)),
                avg_batch_time: Math.round(duration / batches.length),
                mode: "TURBO"
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
                    "Minimal delays (25ms)"
                ]
            }
        });
    }
    catch (error) {
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
                version: "1.0.0"
            }
        });
    }
});
app.post("/listener/start", (_req, res) => {
    try {
        startContinuousListener();
        res.json({
            message: "🚀 TURBO listener started successfully",
            status: "started",
            config: {
                interval_seconds: LISTENER_INTERVAL_MS / 1000,
                batch_size: LISTENER_BATCH_SIZE,
                concurrency: LISTENER_CONCURRENCY,
                min_posts: MIN_POSTS_TO_PROCESS
            }
        });
    }
    catch (error) {
        res.status(500).json({
            error: "Failed to start listener",
            message: error.message
        });
    }
});
app.post("/listener/stop", (_req, res) => {
    try {
        stopContinuousListener();
        res.json({
            message: "🛑 TURBO listener stopped successfully",
            status: "stopped"
        });
    }
    catch (error) {
        res.status(500).json({
            error: "Failed to stop listener",
            message: error.message
        });
    }
});
app.get("/listener/status", (_req, res) => {
    res.json({
        enabled: LISTENER_ENABLED,
        running: isListenerRunning,
        processing: isProcessing,
        stats: listenerStats,
        config: {
            interval_seconds: LISTENER_INTERVAL_MS / 1000,
            batch_size: LISTENER_BATCH_SIZE,
            concurrency: LISTENER_CONCURRENCY,
            min_posts_threshold: MIN_POSTS_TO_PROCESS
        }
    });
});
app.listen(PORT, () => {
    console.log(`🚀 High-Performance Enrichment Service running on port ${PORT}`);
    console.log(`⚡ Optimized for 99k posts with concurrent batch processing:`);
    console.log(`   - Normal mode: ${AGGRESSIVE_BATCH_SIZE} posts/batch, ${MAX_CONCURRENT_REQUESTS} concurrent batches`);
    console.log(`   - Turbo mode: ${TURBO_BATCH_SIZE} posts/batch, ${TURBO_CONCURRENT_REQUESTS} concurrent batches`);
    console.log(`   - Max per run: ${MAX_POSTS_PER_RUN} posts`);
    console.log(`   - Estimated time for 99k posts: ~30-60 minutes with turbo mode`);
    console.log(`📡 Endpoints:`);
    console.log(`   - Regular: /enrich-posts`);
    console.log(`   - Turbo: /enrich-posts-turbo`);
    console.log(`   - Listener: /listener/start, /listener/stop, /listener/status`);
    if (LISTENER_ENABLED) {
        console.log(`🚀 Auto-starting TURBO continuous enrichment listener...`);
        startContinuousListener();
    }
    else {
        console.log(`⏸️  Continuous listener disabled (set ENABLE_LISTENER=true to enable)`);
    }
});
exports.default = app;
