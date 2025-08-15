// Test schema version
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  try {
    console.log("Testing table schemas...");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Test posts table
    console.log("Testing posts table...");
    const { data: postsTest, error: postsError } = await supabase
      .from("posts")
      .select("*")
      .limit(1);

    // Test saas_idea_items table
    console.log("Testing saas_idea_items table...");
    const { data: saasTest, error: saasError } = await supabase
      .from("saas_idea_items")
      .select("*")
      .limit(1);

    const result = {
      status: "success",
      tables: {
        posts: {
          exists: !postsError,
          error: postsError?.message || null,
          sample_columns: postsTest?.[0] ? Object.keys(postsTest[0]) : []
        },
        saas_idea_items: {
          exists: !saasError,
          error: saasError?.message || null,
          sample_columns: saasTest?.[0] ? Object.keys(saasTest[0]) : []
        }
      }
    };

    console.log("Schema test results:", result);

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("Schema test failed:", error);
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: error.message || "Unknown error occurred"
    }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
  }
});