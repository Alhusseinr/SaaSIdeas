// GitHub platform ingest function - simplified and self-contained for Edge Functions
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const USER_AGENT = "complaint-scanner/0.1";

interface PostData {
  platform: string;
  platform_post_id: string;
  author: string | null;
  url: string | null;
  created_at: string;
  fetched_at: string;
  title: string | null;
  body: string | null;
  hash: string;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
  };
}

async function makeHash(platform: string, postId: string, text: string, createdAt: string): Promise<string> {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const data = `${platform}:${postId}:${normalizedText.substring(0, 500)}:${createdAt}`;
  const buf = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGitHubIssues(maxIssues: number = 50): Promise<{posts: PostData[], filtered: number}> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;

  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token not configured");
  }

  // Complete bot authors list from original
  const botAuthors = [
    "github-actions[bot]",
    "dependabot[bot]", 
    "renovate[bot]",
    "greenkeeper[bot]",
    "codecov[bot]",
    "sonarcloud[bot]",
    "snyk-bot",
    "whitesource-bolt[bot]",
    "imgbot[bot]",
    "allcontributors[bot]",
    "semantic-release-bot",
    "netlify[bot]",
    "vercel[bot]"
  ];

  console.log("Fetching GitHub issues...");
  
  // Complete search queries from original
  const searchQueries = [
    "frustrating OR annoying OR broken OR \"doesn't work\" -author:dependabot -author:github-actions",
    "\"missing feature\" OR \"lack of\" OR \"wish there was\" OR \"would be nice\" -label:dependencies",
    "slow OR performance OR inefficient OR difficult OR \"hard to use\" -is:pull_request",
    "confusing OR unclear OR \"feature request\" OR enhancement -label:bot"
  ];

  for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries to avoid rate limits
    try {
      const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(query)} type:issue created:>=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&sort=created&order=desc&per_page=${Math.min(maxIssues / 3, 33)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": USER_AGENT
        }
      });

      if (!response.ok) {
        console.warn(`GitHub API error: ${response.status} - ${response.statusText}`);
        await sleep(1000);
        continue;
      }

      const data = await response.json();
      const issues = data.items || [];
      
      console.log(`GitHub: Processing ${issues.length} issues for query: ${query.substring(0, 50)}...`);

      for (const issue of issues) {
    const title = issue.title || "";
    const body = issue.body || "";
    const author = issue.user?.login || "";
    const content = `${title} ${body}`.toLowerCase();
    
    // Filter out bots
    if (botAuthors.includes(author) || author.toLowerCase().includes('bot')) {
      filteredCount++;
      continue;
    }
    
    // Basic content filtering
    if (body.length < 50 || /\b(crypto|bitcoin|nft|gambling)\b/i.test(content)) {
      filteredCount++;
      continue;
    }
    
    const createdAt = issue.created_at ? new Date(issue.created_at).toISOString() : nowISO;
    const hash = await makeHash("github", String(issue.id), `${title} ${body}`, createdAt);
    
    posts.push({
      platform: "github",
      platform_post_id: String(issue.id),
      author: issue.user?.login || null,
      url: issue.html_url,
      created_at: createdAt,
      fetched_at: nowISO,
      title: title || null,
      body: body || title,
      hash: hash
    });
    
        await sleep(50);
      }
      
      // Rate limiting - GitHub allows 5000 requests per hour for authenticated requests
      await sleep(200);
      
    } catch (queryError) {
      console.error(`Error fetching GitHub issues for query "${query}":`, queryError);
    }
  }
  
  console.log(`GitHub: Found ${posts.length} relevant posts, filtered ${filteredCount}`);
  return { posts, filtered: filteredCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const startTime = Date.now();
  
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        success: false,
        posts: [],
        filtered: 0,
        error: "Only POST requests are supported"
      }), {
        status: 405,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));
    const maxIssues = Math.min(body.max_issues || 50, 100);
    
    console.log(`GitHub: Processing up to ${maxIssues} issues`);

    const result = await fetchGitHubIssues(maxIssues);
    
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      posts: result.posts,
      filtered: result.filtered,
      message: `Successfully fetched ${result.posts.length} GitHub issues, filtered ${result.filtered}`,
      duration_ms: duration,
      platform_info: {
        name: "github",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("GitHub platform function error:", error);
    const duration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: false,
      posts: [],
      filtered: 0,
      error: String(error),
      duration_ms: duration,
      platform_info: {
        name: "github",
        version: "1.0.0",
        last_updated: "2025-01-17T11:00:00Z"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
});