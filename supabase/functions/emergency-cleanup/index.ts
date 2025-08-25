// Emergency database cleanup - Remove old posts to fix I/O overload
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function emergencyCleanup(): Promise<{
  success: boolean;
  deletedPosts: number;
  remainingPosts: number;
  message: string;
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // First, check current database size
    const { data: countData, error: countError } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("Error counting posts:", countError);
      throw countError;
    }

    const totalPosts = countData?.length || 0;
    console.log(`Current database size: ${totalPosts} posts`);

    // Delete posts older than 14 days in batches to avoid timeout
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`Deleting posts older than ${cutoffISO}...`);

    let totalDeleted = 0;
    const BATCH_SIZE = 5000; // Small batches to avoid timeouts
    let hasMoreToDelete = true;

    while (hasMoreToDelete && totalDeleted < 200000) { // Safety limit
      const { data: deletedData, error: deleteError } = await supabase
        .from("posts")
        .delete()
        .lt("created_at", cutoffISO)
        .limit(BATCH_SIZE)
        .select("id");

      if (deleteError) {
        console.error(`Batch delete error:`, deleteError);
        break;
      }

      const batchDeleted = deletedData?.length || 0;
      totalDeleted += batchDeleted;
      
      console.log(`Deleted batch: ${batchDeleted} posts (total: ${totalDeleted})`);

      if (batchDeleted < BATCH_SIZE) {
        hasMoreToDelete = false;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check final count
    const { data: finalCountData, error: finalCountError } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true });

    const remainingPosts = finalCountData?.length || 0;

    return {
      success: true,
      deletedPosts: totalDeleted,
      remainingPosts: remainingPosts,
      message: `Emergency cleanup completed. Deleted ${totalDeleted} old posts. ${remainingPosts} posts remain.`
    };

  } catch (error) {
    console.error("Emergency cleanup failed:", error);
    return {
      success: false,
      deletedPosts: 0,
      remainingPosts: 0,
      message: `Cleanup failed: ${String(error)}`
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const startTime = Date.now();

  try {
    console.log("🚨 Starting emergency database cleanup...");
    
    const result = await emergencyCleanup();
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        ...result,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      }),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Emergency cleanup error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        message: "Emergency cleanup failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});