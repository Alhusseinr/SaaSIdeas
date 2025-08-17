// Shared utilities for platform ingest functions
export interface PostData {
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

export interface PlatformResponse {
  success: boolean;
  posts: PostData[];
  filtered: number;
  message?: string;
  error?: string;
  duration_ms?: number;
  platform_info?: {
    name: string;
    version: string;
    last_updated: string;
  };
}

// Physical product keywords to filter out (focus on SaaS/software only)
export const physicalProductKeywords = [
  'shipping', 'delivery', 'warehouse', 'inventory', 'manufacturing', 'factory',
  'physical product', 'printed', 'printing', 'packaging', 'retail store',
  'brick and mortar', 'restaurant', 'food', 'kitchen', 'clothing', 'apparel',
  'jewelry', 'furniture', 'hardware', 'device', 'gadget', 'machine',
  'equipment', 'vehicle', 'car', 'truck', 'real estate', 'property',
  'construction', 'building', 'plumbing', 'electrical', 'hvac',
  'cleaning service', 'lawn care', 'landscaping', 'moving', 'storage unit'
];

// SaaS/Software positive keywords
export const softwareKeywords = [
  'app', 'software', 'platform', 'dashboard', 'api', 'saas', 'web',
  'mobile', 'automation', 'integration', 'analytics', 'tool',
  'system', 'service', 'online', 'digital', 'cloud', 'database',
  'algorithm', 'ai', 'machine learning', 'workflow', 'crm', 'cms'
];

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key"
  };
}

export function isSoftwareFocused(title: string, body: string): boolean {
  const content = `${title} ${body}`.toLowerCase();
  
  // Strong physical product indicators - immediate filter out
  const hasPhysicalKeywords = physicalProductKeywords.some(keyword => 
    content.includes(keyword.toLowerCase())
  );
  
  if (hasPhysicalKeywords) {
    return false;
  }
  
  // Check for software/digital indicators
  const hasSoftwareKeywords = softwareKeywords.some(keyword => 
    content.includes(keyword.toLowerCase())
  );
  
  // Additional heuristics for software focus
  const hasUrlsOrTech = /\b(\.com|\.net|\.io|github|api|webhook|json|xml|sql|database|server|cloud|code|programming|developer|tech|digital)\b/i.test(content);
  const hasProductivityTerms = /\b(productivity|efficiency|automate|streamline|organize|manage|track|analyze|report|dashboard)\b/i.test(content);
  const hasBusinessTerms = /\b(crm|erp|saas|subscription|recurring|billing|invoice|payment|customer|client|user|account)\b/i.test(content);
  
  // Return true if we have software keywords OR multiple supporting indicators
  return hasSoftwareKeywords || (hasUrlsOrTech && hasProductivityTerms) || (hasBusinessTerms && hasProductivityTerms);
}

export async function makeHash(platform: string, postId: string, text: string, createdAt: string): Promise<string> {
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const data = `${platform}:${postId}:${normalizedText.substring(0, 500)}:${createdAt}`;
  const buf = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  
  return "unknown";
}

export function validateRequest(req: Request): { valid: boolean; error?: string; clientIP: string } {
  const clientIP = getClientIP(req);
  
  if (req.method !== "POST") {
    return {
      valid: false,
      error: "Only POST requests are supported",
      clientIP
    };
  }
  
  return { valid: true, clientIP };
}

export function createSuccessResponse(data: PlatformResponse): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}

export function createErrorResponse(error: string, status: number = 500): Response {
  return new Response(JSON.stringify({
    success: false,
    posts: [],
    filtered: 0,
    error
  }), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}