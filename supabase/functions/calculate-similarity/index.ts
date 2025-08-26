// Supabase Edge Function: Calculate Similarity Scores
// Runs periodically to calculate similarity between posts using pgvector
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("🔑 Using service role key:", supabaseKey.slice(0, 20) + "...");

    console.log("🔄 Starting similarity calculation...");

    // Debug: Test basic database access
    const { count: totalPosts, error: countError } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("❌ Database access error:", countError.message);
      throw new Error(`Database access failed: ${countError.message}`);
    }

    console.log(`📊 Total posts accessible: ${totalPosts}`);

    // Configuration
    const BATCH_SIZE = 50; // Process posts in batches
    const MIN_SIMILARITY_THRESHOLD = 0.5; // Only store high similarity scores
    const MAX_SIMILAR_POSTS = 4000; // Top N similar posts per post

    // Debug: Check posts with completed enrichment
    const { count: completedCount, error: completedError } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("enrich_status", "completed");

    console.log(`📊 Posts with enrich_status='completed': ${completedCount}`);

    // Debug: Check posts with embeddings
    const { count: embeddingCount, error: embeddingError } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .not("embedding", "is", null);

    console.log(`📊 Posts with embeddings: ${embeddingCount}`);

    // Get posts that need similarity calculation - match the SQL query logic
    const { data: targetPosts, error: fetchError } = await supabase
      .from("posts")
      .select("id, embedding, similarity_scores")
      .eq("enrich_status", "completed")
      .not("embedding", "is", null)
      .or("similarity_scores.is.null, similarity_scores.eq.[]") // [] for empty jsonb array
      .order("enriched_at", { ascending: false })
      .limit(500); // or BATCH_SIZE if you have a const

    if (fetchError) {
      console.error("❌ Fetch error:", fetchError);
      throw new Error(`Failed to fetch target posts: ${fetchError.message}`);
    }

    console.log(
      `Fetched ${
        targetPosts?.length || 0
      } posts needing similarity processing from database`
    );

    console.log(
      "Sample post:",
      targetPosts?.[0]
        ? {
            id: targetPosts[0].id,
            has_embedding: !!targetPosts[0].embedding,
            embedding_length: targetPosts[0].embedding?.length,
          }
        : "none"
    );

    if (!targetPosts || targetPosts.length === 0) {
      console.log("✅ No posts need similarity calculation");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No posts need similarity calculation",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `📊 Processing ${targetPosts.length} posts needing similarity calculation`
    );

    let totalProcessed = 0;
    let totalSimilarities = 0;

    // Process each target post - handle both valid and invalid embeddings
    for (const targetPost of targetPosts) {
      // Basic validation
      if (!targetPost.embedding) {
        console.warn(
          `Marking post ${targetPost.id} as processed - no embedding data`
        );

        // Mark as processed with empty similarity scores
        await supabase
          .from("posts")
          .update({
            similarity_scores: [],
            similarity_calculated_at: new Date().toISOString(),
          })
          .eq("id", targetPost.id);

        totalProcessed++;
        continue;
      }

      try {
        const { data: similarPosts, error: similarityError } =
          await supabase.rpc("find_similar_posts_1536", {
            target_embedding: targetPost.embedding,
            target_post_id: targetPost.id,
            similarity_threshold: MIN_SIMILARITY_THRESHOLD,
            max_results: MAX_SIMILAR_POSTS,
          });

        if (similarityError) {
          console.warn(
            `Similarity calculation failed for post ${targetPost.id}:`,
            similarityError.message
          );
          continue;
        }

        

        // Format similarity scores
        const similarityScores =
          similarPosts?.map((post: any) => ({
            post_id: post.id,
            score: Math.round(post.similarity * 1000) / 1000, // Round to 3 decimal places
          })) || [];

        // Update the post with similarity scores
        const { error: updateError } = await supabase
          .from("posts")
          .update({
            similarity_scores: similarityScores,
            similarity_calculated_at: new Date().toISOString(),
          })
          .eq("id", targetPost.id);

        if (updateError) {
          console.error(
            `Failed to update similarity for post ${targetPost.id}:`,
            updateError.message
          );
        } else {
          totalProcessed++;
          totalSimilarities += similarityScores.length;

          if (similarityScores.length > 1) {
            console.log(`Post ${targetPost.id}: ${similarityScores.length} similar posts found`);
          }
        }

        // Bidirectional update: Add targetPost to similarity_scores of each similar post
        for (const similarPost of similarPosts || []) {
          try {
            // Get current similarity scores for the similar post
            const { data: currentPost, error: fetchCurrentError } = await supabase
              .from("posts")
              .select("similarity_scores")
              .eq("id", similarPost.id)
              .single();

            if (fetchCurrentError) {
              console.warn(`Failed to fetch current scores for post ${similarPost.id}:`, fetchCurrentError.message);
              continue;
            }

            const currentScores = currentPost?.similarity_scores || [];
            
            // Check if targetPost is already in the similarity scores
            const existingIndex = currentScores.findIndex((score: any) => score.post_id === targetPost.id);
            
            const newScore = {
              post_id: targetPost.id,
              score: Math.round(similarPost.similarity * 1000) / 1000
            };

            let updatedScores;
            if (existingIndex >= 0) {
              // Update existing score
              updatedScores = [...currentScores];
              updatedScores[existingIndex] = newScore;
            } else {
              // Add new score
              updatedScores = [...currentScores, newScore];
            }

            // Update the similar post with the bidirectional relationship
            const { error: bidirectionalUpdateError } = await supabase
              .from("posts")
              .update({
                similarity_scores: updatedScores,
                similarity_calculated_at: new Date().toISOString(),
              })
              .eq("id", similarPost.id);

            if (bidirectionalUpdateError) {
              console.warn(`Failed bidirectional update for post ${similarPost.id}:`, bidirectionalUpdateError.message);
            }
          } catch (error: any) {
            console.warn(`Error in bidirectional update for post ${similarPost.id}:`, error.message);
          }
        }
      } catch (error: any) {
        console.error(`Error processing post ${targetPost.id}:`, error.message);
      }
    }

    const duration = Date.now();
    console.log(
      `🎉 Similarity calculation completed: ${totalProcessed} posts processed, ${totalSimilarities} similarities found`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Similarity calculation completed",
        processed: totalProcessed,
        totalSimilarities: totalSimilarities,
        duration: `${duration}ms`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error('Similarity calculation failed:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});