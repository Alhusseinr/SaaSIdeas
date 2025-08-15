import { supabase, SaasIdeaItem } from './supabase'
import { generateEnhancedAnalysis } from './enhancedAnalysis'

export interface DailyIdeaData extends SaasIdeaItem {
  userComplaints: number
  yearOneRevenue: number
  buildTime: number
  founderFit: number
  isNew: boolean
  trendScore: number
}

/**
 * Gets today's featured opportunity - rotates daily based on date
 * Ensures variety by cycling through high-scoring ideas
 */
export async function getTodaysValidatedOpportunity(): Promise<DailyIdeaData | null> {
  try {
    // Get today's date as seed for consistent daily rotation
    const today = new Date()
    const dateString = today.toISOString().split('T')[0] // YYYY-MM-DD
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    
    // Query high-scoring ideas from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: ideas, error } = await supabase
      .from('saas_idea_items')
      .select('*')
      .gte('score', 70) // High-quality ideas only
      .gte('created_at', thirtyDaysAgo)
      .order('score', { ascending: false })
      .limit(50) // Get top 50 to rotate through
    
    if (error || !ideas || ideas.length === 0) {
      console.warn('No high-scoring ideas found, using fallback')
      return getFallbackIdea()
    }
    
    // Use day of year to deterministically select an idea
    // This ensures the same idea shows all day but changes daily
    const selectedIdea = ideas[dayOfYear % ideas.length]
    
    // Check if idea was created today (within last 24 hours)
    const isNew = new Date(selectedIdea.created_at!).getTime() > Date.now() - 24 * 60 * 60 * 1000
    
    // Generate enhanced analysis if not already present
    let enhancedIdea = selectedIdea
    if (!selectedIdea.competitive_landscape || !selectedIdea.revenue_projection) {
      const enhanced = generateEnhancedAnalysis(selectedIdea)
      enhancedIdea = { ...selectedIdea, ...enhanced }
      
      // Optionally update the database with enhanced data
      await supabase
        .from('saas_idea_items')
        .update({
          competitive_landscape: enhanced.competitive_landscape,
          founder_market_fit_score: enhanced.founder_market_fit_score,
          revenue_projection: enhanced.revenue_projection,
          technical_feasibility_score: enhanced.technical_feasibility_score,
          go_to_market_difficulty: enhanced.go_to_market_difficulty,
          market_size_estimate: enhanced.market_size_estimate,
          development_timeline_months: enhanced.development_timeline_months,
          required_skills: enhanced.required_skills,
          investment_required: enhanced.investment_required
        })
        .eq('id', selectedIdea.id)
    }
    
    // Calculate additional metrics for display
    const userComplaints = selectedIdea.representative_post_ids?.length || Math.floor(Math.random() * 50) + 10
    const yearOneRevenue = enhancedIdea.revenue_projection?.monthly_recurring_revenue?.month_12 * 12 || 
                          generateRevenueEstimate(enhancedIdea.score)
    // Convert months to weeks (1 month ≈ 4.33 weeks)
    const buildTimeMonths = enhancedIdea.development_timeline_months || Math.ceil(enhancedIdea.score / 15)
    const buildTime = Math.round(buildTimeMonths * 4.33)
    const founderFit = enhancedIdea.founder_market_fit_score || Math.min(enhancedIdea.score + 10, 100)
    const trendScore = calculateTrendScore(enhancedIdea, isNew)
    
    return {
      ...enhancedIdea,
      userComplaints,
      yearOneRevenue,
      buildTime,
      founderFit,
      isNew,
      trendScore
    }
  } catch (error) {
    console.error('Error fetching today\'s idea:', error)
    return getFallbackIdea()
  }
}

/**
 * Gets the latest trending ideas for the trending section
 */
export async function getTrendingIdeas(limit: number = 5): Promise<DailyIdeaData[]> {
  try {
    // Get ideas from the last 7 days, scored by recency and quality
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: ideas, error } = await supabase
      .from('saas_idea_items')
      .select('*')
      .gte('score', 60)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .order('score', { ascending: false })
      .limit(limit * 2) // Get more to have variety
    
    if (error || !ideas) {
      console.warn('Error fetching trending ideas:', error)
      return []
    }
    
    // Enhance and format ideas
    const enhancedIdeas = await Promise.all(
      ideas.slice(0, limit).map(async (idea) => {
        let enhancedIdea = idea
        if (!idea.competitive_landscape || !idea.revenue_projection) {
          const enhanced = generateEnhancedAnalysis(idea)
          enhancedIdea = { ...idea, ...enhanced }
        }
        
        const isNew = new Date(idea.created_at!).getTime() > Date.now() - 24 * 60 * 60 * 1000
        const userComplaints = idea.representative_post_ids?.length || Math.floor(Math.random() * 40) + 15
        const yearOneRevenue = enhancedIdea.revenue_projection?.monthly_recurring_revenue?.month_12 * 12 || 
                              generateRevenueEstimate(enhancedIdea.score)
        // Convert months to weeks (1 month ≈ 4.33 weeks)
        const buildTimeMonths = enhancedIdea.development_timeline_months || Math.ceil(enhancedIdea.score / 15)
        const buildTime = Math.round(buildTimeMonths * 4.33)
        const founderFit = enhancedIdea.founder_market_fit_score || Math.min(enhancedIdea.score + 10, 100)
        const trendScore = calculateTrendScore(enhancedIdea, isNew)
        
        return {
          ...enhancedIdea,
          userComplaints,
          yearOneRevenue,
          buildTime,
          founderFit,
          isNew,
          trendScore
        }
      })
    )
    
    // Sort by trend score (combination of recency, score, and engagement potential)
    return enhancedIdeas.sort((a, b) => b.trendScore - a.trendScore)
  } catch (error) {
    console.error('Error fetching trending ideas:', error)
    return []
  }
}

/**
 * Generate revenue estimate based on idea score and market factors
 */
function generateRevenueEstimate(score: number): number {
  const baseRevenue = score * 1000 // $1k per score point as baseline
  const marketMultiplier = 0.8 + (Math.random() * 0.4) // 0.8x to 1.2x variation
  return Math.round(baseRevenue * marketMultiplier)
}

/**
 * Calculate trend score based on various factors
 */
function calculateTrendScore(idea: SaasIdeaItem, isNew: boolean): number {
  let score = idea.score // Base score
  
  // Boost for recent ideas
  if (isNew) score += 15
  
  // Boost for high market potential
  if (idea.market_size_estimate && idea.market_size_estimate > 100000000) score += 10
  
  // Boost for fast-to-build ideas (≤ 6 months = ≤ 26 weeks)
  if (idea.development_timeline_months && idea.development_timeline_months <= 6) score += 8
  
  // Boost for high founder-market fit
  if (idea.founder_market_fit_score && idea.founder_market_fit_score >= 80) score += 12
  
  // Add some randomness for variety
  score += Math.random() * 10
  
  return Math.min(score, 100)
}

/**
 * Fallback idea when no real data is available
 */
function getFallbackIdea(): DailyIdeaData {
  const fallbackIdeas = [
    {
      id: 9999,
      run_id: 0,
      name: "Smart Email Scheduler for Busy Professionals",
      score: 87,
      one_liner: "AI-powered tool that automatically schedules emails at optimal times based on recipient behavior patterns and time zones.",
      target_user: "Remote workers and global teams",
      core_features: ["AI timing optimization", "Timezone detection", "Behavior analysis", "Calendar integration"],
      why_now: "Remote work is permanent but email timing across global teams is still manual and ineffective.",
      pricing_hint: "$20-40/month per user",
      rationale: "High demand for productivity tools with proven willingness to pay",
      representative_post_ids: [1, 2, 3, 4, 5],
      payload: {},
      created_at: new Date().toISOString(),
      competitive_landscape: null,
      founder_market_fit_score: 82,
      revenue_projection: null,
      technical_feasibility_score: 85,
      go_to_market_difficulty: 40,
      market_size_estimate: 500000000,
      development_timeline_months: 8,
      required_skills: ["AI/ML", "Email APIs", "Frontend Development"],
      investment_required: 150000,
      userComplaints: 47,
      yearOneRevenue: 75000,
      buildTime: 35, // 8 months × 4.33 ≈ 35 weeks
      founderFit: 82,
      isNew: false,
      trendScore: 85
    },
    {
      id: 9998,
      run_id: 0,
      name: "Automated Invoice Follow-up Assistant",
      score: 84,
      one_liner: "AI assistant that automatically follows up on overdue invoices with personalized messages and payment reminders.",
      target_user: "Small business owners and freelancers",
      core_features: ["Smart follow-up sequences", "Payment tracking", "Client communication", "Integration with accounting software"],
      why_now: "Cash flow is critical for small businesses, but invoice follow-up is time-consuming and awkward.",
      pricing_hint: "$30-50/month",
      rationale: "Universal pain point with clear ROI and willingness to pay",
      representative_post_ids: [6, 7, 8, 9, 10],
      payload: {},
      created_at: new Date().toISOString(),
      competitive_landscape: null,
      founder_market_fit_score: 88,
      revenue_projection: null,
      technical_feasibility_score: 90,
      go_to_market_difficulty: 35,
      market_size_estimate: 300000000,
      development_timeline_months: 6,
      required_skills: ["Backend Development", "Payment APIs", "Email automation"],
      investment_required: 120000,
      userComplaints: 52,
      yearOneRevenue: 84000,
      buildTime: 26, // 6 months × 4.33 ≈ 26 weeks
      founderFit: 88,
      isNew: false,
      trendScore: 88
    }
  ]
  
  // Rotate fallback ideas based on day
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  
  return fallbackIdeas[dayOfYear % fallbackIdeas.length]
}

/**
 * Trigger the data pipeline to fetch new ideas
 * This should be called daily or when user requests fresh data
 */
export async function refreshIdeasPipeline(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('Starting ideas pipeline refresh...')
    
    // First, ingest new Reddit data
    const ingestResult = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-reddit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      }
    })
    
    if (!ingestResult.ok) {
      throw new Error(`Ingest failed: ${ingestResult.statusText}`)
    }
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Then generate new ideas from summaries
    const ideasResult = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ideas-from-summaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      }
    })
    
    if (!ideasResult.ok) {
      throw new Error(`Ideas generation failed: ${ideasResult.statusText}`)
    }
    
    const result = await ideasResult.json()
    
    return {
      success: true,
      message: `Pipeline refreshed successfully. Generated ${result.stats?.ideas_inserted || 0} new ideas.`
    }
  } catch (error) {
    console.error('Pipeline refresh error:', error)
    return {
      success: false,
      message: `Pipeline refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}