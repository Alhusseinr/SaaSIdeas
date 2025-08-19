// Simple diagnostic function to understand your posts data
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get basic stats
    const { data: allPosts } = await supabase
      .from("posts")
      .select("platform, is_complaint, sentiment, summary, created_at")
      .limit(1000);

    if (!allPosts) {
      return new Response(JSON.stringify({
        error: "No posts found in database"
      }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Analyze the data
    const platformCounts = allPosts.reduce((acc, post) => {
      acc[post.platform || 'unknown'] = (acc[post.platform || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const complaintCounts = allPosts.reduce((acc, post) => {
      const key = post.is_complaint ? 'complaints' : 'non_complaints';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryCounts = allPosts.reduce((acc, post) => {
      const key = post.summary ? 'with_summary' : 'no_summary';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sentimentStats = allPosts.filter(p => p.sentiment !== null).reduce((acc, post) => {
      if (post.sentiment < -0.5) acc.very_negative++;
      else if (post.sentiment < -0.1) acc.negative++;
      else if (post.sentiment < 0.1) acc.neutral++;
      else if (post.sentiment < 0.5) acc.positive++;
      else acc.very_positive++;
      return acc;
    }, { very_negative: 0, negative: 0, neutral: 0, positive: 0, very_positive: 0 });

    // Date range analysis
    const dates = allPosts.map(p => new Date(p.created_at)).filter(d => !isNaN(d.getTime()));
    const oldestDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const newestDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

    // Sample posts that match the orchestrator criteria
    const { data: matchingPosts } = await supabase
      .from("posts")
      .select("id, platform, summary, sentiment, created_at")
      .eq("is_complaint", true)
      .lt("sentiment", -0.1)
      .not("summary", "is", null)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(5);

    const result = {
      total_posts: allPosts.length,
      platform_breakdown: platformCounts,
      complaint_breakdown: complaintCounts,
      summary_breakdown: summaryCounts,
      sentiment_distribution: sentimentStats,
      date_range: {
        oldest: oldestDate?.toISOString(),
        newest: newestDate?.toISOString(),
        days_span: oldestDate && newestDate ? 
          Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
      },
      orchestrator_criteria_matches: {
        count: matchingPosts?.length || 0,
        sample_posts: matchingPosts?.map(p => ({
          id: p.id,
          platform: p.platform,
          sentiment: p.sentiment,
          has_summary: !!p.summary,
          created_at: p.created_at
        })) || []
      },
      recommendations: []
    };

    // Add recommendations based on analysis
    if (result.total_posts === 0) {
      result.recommendations.push("No posts found in database - check data ingestion");
    } else {
      if (complaintCounts.complaints === 0) {
        result.recommendations.push("No posts marked as complaints - check is_complaint field logic");
      }
      if (summaryCounts.with_summary === 0) {
        result.recommendations.push("No posts have summaries - run summarization process first");
      }
      if (sentimentStats.negative + sentimentStats.very_negative === 0) {
        result.recommendations.push("No posts with negative sentiment - check sentiment analysis");
      }
      if (result.orchestrator_criteria_matches.count === 0) {
        result.recommendations.push(`Try: platform=reddit&days=${result.date_range.days_span || 90}&enable_validation=false`);
      }
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Diagnostics error:", error);
    
    return new Response(JSON.stringify({
      error: String(error),
      message: "Failed to run diagnostics"
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});