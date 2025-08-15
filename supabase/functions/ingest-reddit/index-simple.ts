// Simple test version of ingest-reddit
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
const USER_AGENT = "complaint-scanner/1.0";

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
    console.log("Starting simple test...");

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Test database connection
    console.log("Testing database connection...");
    const { data: testData, error: testError } = await supabase
      .from("saas_idea_items")
      .select("count")
      .limit(1);

    if (testError) {
      console.error("Database test failed:", testError);
      throw new Error(`Database connection failed: ${testError.message}`);
    }

    console.log("Database connection successful");

    // Get Reddit token
    const basic = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
    const tokenResp = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT
      },
      body: new URLSearchParams({
        grant_type: "client_credentials"
      })
    });

    if (!tokenResp.ok) {
      throw new Error(`Reddit token error: ${tokenResp.status}`);
    }

    const { access_token } = await tokenResp.json();
    console.log("Reddit token obtained");

    // Test a single Reddit API call
    const testUrl = "https://oauth.reddit.com/r/entrepreneur/search?limit=5&sort=new&restrict_sr=1&q=frustrated";
    const resp = await fetch(testUrl, {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "User-Agent": USER_AGENT
      }
    });

    if (!resp.ok) {
      throw new Error(`Reddit API error: ${resp.status}`);
    }

    const data = await resp.json();
    const posts = data?.data?.children || [];
    
    console.log(`Found ${posts.length} test posts`);

    return new Response(JSON.stringify({
      status: "success",
      message: "Simple test completed successfully",
      posts_found: posts.length,
      database_connected: true,
      reddit_api_connected: true,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("Test failed:", error);
    return new Response(JSON.stringify({
      status: "error",
      error: String(error),
      message: error.message || "Unknown error occurred",
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json"
      }
    });
  }
});