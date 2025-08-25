// Database monitoring and automatic cleanup to prevent overload
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Database limits to prevent overload
const MAX_POSTS = 50000; // Maximum posts to keep
const CLEANUP_THRESHOLD = 45000; // Trigger cleanup when this many posts
const RETENTION_DAYS = 30; // Keep posts for 30 days

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", 
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function monitorAndCleanup(): Promise<{
  current_posts: number;
  deleted_posts: number;
  cleanup_triggered: boolean;
  database_health: string;
  message: string;
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check current post count
  const { data: countData, error: countError } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Failed to count posts: ${countError.message}`);
  }

  const currentPosts = countData?.length || 0;
  let deletedPosts = 0;
  let cleanupTriggered = false;

  console.log(`Current database size: ${currentPosts} posts`);

  // Determine database health
  let health = "healthy";
  if (currentPosts > MAX_POSTS) {
    health = "critical";
  } else if (currentPosts > CLEANUP_THRESHOLD) {
    health = "warning";
  }

  // Trigger cleanup if needed
  if (currentPosts > CLEANUP_THRESHOLD) {
    console.log(`Cleanup triggered: ${currentPosts} > ${CLEANUP_THRESHOLD}`);
    cleanupTriggered = true;

    // Calculate how many posts to delete
    const targetPosts = Math.floor(MAX_POSTS * 0.8); // Keep 80% of max
    const postsToDelete = currentPosts - targetPosts;

    if (postsToDelete > 0) {
      // Delete oldest posts in batches
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
      const cutoffISO = cutoffDate.toISOString();

      console.log(`Deleting oldest posts before ${cutoffISO}...`);

      const BATCH_SIZE = 2000;
      let totalDeleted = 0;
      
      while (totalDeleted < postsToDelete) {
        const { data: deletedData, error: deleteError } = await supabase
          .from("posts")
          .delete()
          .lt("created_at", cutoffISO)
          .limit(BATCH_SIZE)
          .select("id");

        if (deleteError) {
          console.error("Batch delete error:", deleteError);
          break;
        }

        const batchDeleted = deletedData?.length || 0;
        totalDeleted += batchDeleted;

        console.log(`Deleted batch: ${batchDeleted} (total: ${totalDeleted})`);

        if (batchDeleted < BATCH_SIZE) {
          break; // No more posts to delete
        }

        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      deletedPosts = totalDeleted;
    }
  }

  return {
    current_posts: currentPosts - deletedPosts,
    deleted_posts: deletedPosts,
    cleanup_triggered: cleanupTriggered,
    database_health: health,
    message: cleanupTriggered 
      ? `Cleanup completed: deleted ${deletedPosts} old posts`
      : `Database healthy: ${currentPosts} posts (limit: ${MAX_POSTS})`
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    console.log("Starting database monitoring...");
    
    const result = await monitorAndCleanup();

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        limits: {
          max_posts: MAX_POSTS,
          cleanup_threshold: CLEANUP_THRESHOLD,
          retention_days: RETENTION_DAYS
        },
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Database monitoring error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        message: "Database monitoring failed",
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});