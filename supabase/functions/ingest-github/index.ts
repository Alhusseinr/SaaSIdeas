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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}

async function makeHash(
  platform: string,
  postId: string,
  text: string,
  createdAt: string
): Promise<string> {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, " ");
  const data = `${platform}:${postId}:${normalizedText.substring(
    0,
    500
  )}:${createdAt}`;
  const buf = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGitHubIssues(
  maxIssues: number = 50
): Promise<{ posts: PostData[]; filtered: number }> {
  const posts: PostData[] = [];
  const nowISO = new Date().toISOString();
  let filteredCount = 0;
  let requestCount = 0;
  const maxRequestsPerMinute = 28; // GitHub Search API: 30/min, leaving small buffer

  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token not configured");
  }
  
  console.log(`GitHub: Starting with target of ${maxIssues} issues`);

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
    "vercel[bot]",
  ];

  console.log("Fetching GitHub issues...");

  // Common qualifiers: open issues, no PRs, exclude bots/archived, show active threads
  const QUAL =
    "is:issue is:open -is:pr archived:false -author:dependabot[bot] -author:github-actions[bot] comments:>0";

  // Buckets of phrases
  const bugReliability = [
    "bug",
    "crash",
    "crashes",
    "glitch",
    "hang",
    "hangs",
    "freeze",
    "frozen",
    "timeout",
    "race condition",
    "memory leak",
    "leak",
    "deadlock",
    "regression",
    '"doesn\'t work"',
    '"not working"',
    '"stopped working"',
    "error",
    "exception",
    "npe",
    '"null pointer"',
    "segfault",
  ];

  const perfScalability = [
    "slow",
    "laggy",
    "latency",
    "throughput",
    "inefficient",
    "performance",
    '"high cpu"',
    '"high memory"',
    "oom",
    '"out of memory"',
    "scale",
    "scalability",
    "bottleneck",
    '"takes too long"',
  ];

  const usabilityDX = [
    "confusing",
    "unclear",
    '"hard to use"',
    "frustrating",
    "annoying",
    '"poor ux"',
    '"bad ux"',
    '"hard to configure"',
    '"difficult to configure"',
    '"too complicated"',
    "complex",
    '"steep learning curve"',
  ];

  const unmetNeeds = [
    '"missing feature"',
    '"lack of"',
    '"would be nice"',
    '"wish there was"',
    '"need a way to"',
    '"no way to"',
    '"is there a way"',
    '"feature request"',
    "enhancement",
  ];

  const docsOnboarding = [
    '"missing docs"',
    '"missing documentation"',
    '"not documented"',
    '"docs unclear"',
    '"docs outdated"',
    '"readme unclear"',
    '"installation issue"',
    '"setup issue"',
    '"config issue"',
  ];

  const integrationAuth = [
    "integration",
    "webhook",
    "api",
    "sdk",
    '"oauth"',
    '"sso"',
    '"saml"',
    '"jwt"',
    '"rate limit"',
    '"throttling"',
    '"callback fails"',
  ];

  const costLicensing = [
    '"license issue"',
    '"licensing issue"',
    '"pricing"',
    '"too expensive"',
    '"overpriced"',
    '"billing"',
    '"quota"',
    '"usage limit"',
  ];

  // Exclude PRs in some, exclude dependency housekeeping labels in others
  const depNoiseExcl = "-label:dependencies -label:dependency -label:automated";
  const botLabelExcl = '-label:bot -label:"github-actions"';

  // Helper to attach qualifiers and optional extras
  const withQual = (term: string, extra = "") =>
    `${term} ${QUAL} ${extra}`.trim();

  // Note: Full searchQueries array removed to reduce API calls and avoid rate limits

  // Optional: constrain freshness/quality at API level
  const sort = "created"; // or 'comments', 'reactions'
  const order = "desc";
  const per_page = 50; // max 100
  // API endpoint: GET https://api.github.com/search/issues?q=<ENCODED> &sort=&order=&per_page=&page=

  // Limit queries to avoid rate limits - prioritize most valuable searches
  const prioritizedQueries = [
    // High-value frustration signals
    withQual("frustrating", botLabelExcl),
    withQual("annoying", botLabelExcl),
    withQual("broken", depNoiseExcl),
    withQual('"doesn\'t work"', depNoiseExcl),
    // Top unmet needs
    withQual('"missing feature"', depNoiseExcl),
    withQual('"feature request"', depNoiseExcl),
    withQual('"need a way to"', depNoiseExcl),
    // Critical bugs
    withQual("bug", depNoiseExcl),
    withQual("crash", depNoiseExcl),
    withQual("error", depNoiseExcl),
    // Performance issues
    withQual("slow", "-label:performance"),
    withQual("performance", "-label:benchmarks"),
  ].slice(0, Math.min(25, maxRequestsPerMinute - 2)); // Leave buffer for retries

  console.log(`GitHub: Using ${prioritizedQueries.length} prioritized queries to avoid rate limits`);

  for (const query of prioritizedQueries) {
    // Check if we have enough posts already
    if (posts.length >= maxIssues) {
      console.log(`GitHub: Reached target of ${maxIssues} posts, stopping`);
      break;
    }
    
    // Rate limit check - wait if we're approaching the limit
    if (requestCount >= maxRequestsPerMinute) {
      console.log("GitHub: Rate limit approaching, waiting 60 seconds...");
      await sleep(60000);
      requestCount = 0;
    }

    try {
      const searchUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(
        query
      )} type:issue created:>=${
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      }&sort=${sort}&order=${order}&per_page=${per_page}`;

      console.log(`GitHub: Query ${requestCount + 1}/${prioritizedQueries.length}: ${query.substring(0, 50)}...`);

      const response = await fetch(searchUrl, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": USER_AGENT,
        },
      });
      
      requestCount++;
      
      // Check rate limit headers
      const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
      const rateLimitReset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
      
      if (!response.ok) {
        if (response.status === 403) {
          console.warn(`GitHub: Rate limited (403). Remaining: ${rateLimitRemaining}, Reset: ${new Date(rateLimitReset * 1000)}`);
          if (rateLimitRemaining === 0) {
            const waitTime = Math.max(60000, (rateLimitReset * 1000 - Date.now()) + 5000); // Add 5s buffer
            console.log(`GitHub: Waiting ${waitTime/1000}s for rate limit reset...`);
            await sleep(waitTime);
            requestCount = 0;
            continue;
          }
        }
        
        console.warn(
          `GitHub API error: ${response.status} - ${response.statusText}. Remaining: ${rateLimitRemaining}`
        );
        await sleep(2000); // Longer wait on errors
        continue;
      }
      
      console.log(`GitHub: Rate limit remaining: ${rateLimitRemaining}`);

      const data = await response.json();
      const issues = data.items || [];

      console.log(
        `GitHub: Processing ${
          issues.length
        } issues for query: ${query.substring(0, 50)}...`
      );

      for (const issue of issues) {
        const title = issue.title || "";
        const body = issue.body || "";
        const author = issue.user?.login || "";
        const content = `${title} ${body}`.toLowerCase();

        // Filter out bots
        if (
          botAuthors.includes(author) ||
          author.toLowerCase().includes("bot")
        ) {
          filteredCount++;
          continue;
        }

        // Basic content filtering
        if (
          body.length < 50 ||
          /\b(crypto|bitcoin|nft|gambling)\b/i.test(content)
        ) {
          filteredCount++;
          continue;
        }

        const createdAt = issue.created_at
          ? new Date(issue.created_at).toISOString()
          : nowISO;
        const hash = await makeHash(
          "github",
          String(issue.id),
          `${title} ${body}`,
          createdAt
        );

        posts.push({
          platform: "github",
          platform_post_id: String(issue.id),
          author: issue.user?.login || null,
          url: issue.html_url,
          created_at: createdAt,
          fetched_at: nowISO,
          title: title || null,
          body: body || title,
          hash: hash,
        });

        await sleep(50);
      }

      // Rate limiting - GitHub Search API: 30 requests/minute (more restrictive than REST API's 5000/hour)
      // Use adaptive delay based on remaining search quota
      const delayMs = rateLimitRemaining < 5 ? 4000 : rateLimitRemaining < 15 ? 2000 : 1000;
      console.log(`GitHub: Waiting ${delayMs}ms before next request (search remaining: ${rateLimitRemaining})`);
      await sleep(delayMs);
    } catch (queryError) {
      console.error(
        `Error fetching GitHub issues for query "${query}":`,
        queryError
      );
      
      // On error, add some backoff to avoid hitting limits further
      await sleep(5000);
      
      // If we get multiple errors, it might be a token issue
      if (queryError instanceof Error && queryError.message.includes('401')) {
        console.error('GitHub: Authentication failed - check GITHUB_TOKEN');
        throw new Error('GitHub authentication failed. Please verify GITHUB_TOKEN.');
      }
    }
  }

  console.log(
    `GitHub: Found ${posts.length} relevant posts, filtered ${filteredCount}`
  );
  return { posts, filtered: filteredCount };
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
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          posts: [],
          filtered: 0,
          error: "Only POST requests are supported",
        }),
        {
          status: 405,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const maxIssues = Math.min(body.max_issues || 50, 100);

    console.log(`GitHub: Processing up to ${maxIssues} issues`);

    const result = await fetchGitHubIssues(maxIssues);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        posts: result.posts,
        filtered: result.filtered,
        message: `Successfully fetched ${result.posts.length} GitHub issues, filtered ${result.filtered}`,
        duration_ms: duration,
        platform_info: {
          name: "github",
          version: "1.0.0",
          last_updated: "2025-01-17T11:00:00Z",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("GitHub platform function error:", error);
    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        posts: [],
        filtered: 0,
        error: String(error),
        duration_ms: duration,
        platform_info: {
          name: "github",
          version: "1.0.0",
          last_updated: "2025-01-17T11:00:00Z",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      }
    );
  }
});
