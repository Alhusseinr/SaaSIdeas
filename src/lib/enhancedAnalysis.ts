import { SaasIdeaItem, CompetitiveLandscape, RevenueProjection } from './supabase'

// Enhanced Analysis Framework Functions

export const calculateFounderMarketFit = (idea: SaasIdeaItem, founderSkills: string[] = []): number => {
  let score = 0;
  
  // Base score from idea validation
  score += Math.min(idea.score, 40); // Max 40 points from validation score
  
  // Technical feasibility bonus
  if (idea.technical_feasibility_score) {
    score += Math.min(idea.technical_feasibility_score * 0.2, 20); // Max 20 points
  }
  
  // Skills match bonus
  if (idea.required_skills && founderSkills.length > 0) {
    const skillsMatch = idea.required_skills.filter(skill => 
      founderSkills.some(fs => fs.toLowerCase().includes(skill.toLowerCase()))
    );
    score += Math.min((skillsMatch.length / idea.required_skills.length) * 25, 25); // Max 25 points
  }
  
  // Market timing bonus
  if (idea.why_now) {
    score += 15; // Max 15 points for having market timing rationale
  }
  
  return Math.min(Math.round(score), 100);
};

export const generateRevenueProjection = (idea: SaasIdeaItem): RevenueProjection => {
  // Base pricing estimation from score and market size
  const basePrice = idea.market_size_estimate 
    ? Math.min(Math.max(idea.score * 2, 20), 200) 
    : Math.min(Math.max(idea.score * 1.5, 15), 150);
  
  // Customer acquisition estimation
  const baseCustomers = Math.round(idea.score * 10);
  const monthlyGrowthRate = 1.15; // 15% month-over-month growth
  
  // Calculate projections
  const month6Customers = Math.round(baseCustomers * Math.pow(monthlyGrowthRate, 6));
  const month12Customers = Math.round(baseCustomers * Math.pow(monthlyGrowthRate, 12));
  const month24Customers = Math.round(baseCustomers * Math.pow(monthlyGrowthRate, 24));
  
  return {
    monthly_recurring_revenue: {
      month_6: month6Customers * basePrice,
      month_12: month12Customers * basePrice,
      month_24: month24Customers * basePrice
    },
    pricing_model: "subscription",
    target_customers: month12Customers,
    average_revenue_per_user: basePrice,
    churn_rate: Math.max(5 - (idea.score / 20), 2), // Lower churn for higher scored ideas
    customer_acquisition_cost: Math.round(basePrice * 2), // 2x monthly price as CAC
    lifetime_value: Math.round(basePrice * (1 / (Math.max(5 - (idea.score / 20), 2) / 100)) * 0.8) // LTV calculation
  };
};

export const analyzeCompetitiveLandscape = (idea: SaasIdeaItem): CompetitiveLandscape => {
  // Mock competitive analysis - in real implementation, this would use AI/APIs
  const commonCompetitors: { [key: string]: string[] } = {
    'productivity': ['Notion', 'Airtable', 'Monday.com'],
    'communication': ['Slack', 'Discord', 'Teams'],
    'analytics': ['Google Analytics', 'Mixpanel', 'Amplitude'],
    'ecommerce': ['Shopify', 'WooCommerce', 'BigCommerce'],
    'marketing': ['HubSpot', 'Mailchimp', 'ConvertKit'],
    'finance': ['QuickBooks', 'FreshBooks', 'Wave'],
    'development': ['GitHub', 'GitLab', 'Bitbucket'],
    'design': ['Figma', 'Sketch', 'Adobe XD']
  };
  
  // Simple keyword matching for demo
  let directCompetitors: string[] = [];
  let category = 'general';
  
  const ideaText = `${idea.name} ${idea.one_liner} ${idea.core_features?.join(' ')}`.toLowerCase();
  
  for (const [cat, competitors] of Object.entries(commonCompetitors)) {
    if (ideaText.includes(cat) || competitors.some(comp => ideaText.includes(comp.toLowerCase()))) {
      directCompetitors = competitors.slice(0, 3);
      category = cat;
      break;
    }
  }
  
  // Generate market gap score
  const marketGapScore = Math.min(100 - (directCompetitors.length * 15) + (idea.score * 0.5), 95);
  
  return {
    direct_competitors: directCompetitors,
    indirect_competitors: ['Custom solutions', 'Manual processes', 'Generic tools'],
    market_gap_score: Math.round(marketGapScore),
    differentiation_opportunities: [
      'Better user experience',
      'Industry-specific features',
      'Lower pricing',
      'Superior integration capabilities'
    ],
    competitive_advantage: `First mover advantage in ${category} space with validated user demand`
  };
};

export const calculateTechnicalFeasibility = (idea: SaasIdeaItem): number => {
  let score = 90; // Start optimistic
  
  // Reduce score based on complexity indicators
  const complexityKeywords = [
    'AI', 'machine learning', 'blockchain', 'AR', 'VR', 'IoT', 
    'real-time', 'high-frequency', 'scalable', 'enterprise'
  ];
  
  const ideaText = `${idea.name} ${idea.one_liner} ${idea.core_features?.join(' ')}`.toLowerCase();
  const complexityCount = complexityKeywords.filter(keyword => 
    ideaText.includes(keyword.toLowerCase())
  ).length;
  
  score -= complexityCount * 10; // Reduce 10 points per complexity keyword
  
  // Boost score for simpler concepts
  const simpleKeywords = ['dashboard', 'form', 'directory', 'list', 'tracker'];
  const simplicityCount = simpleKeywords.filter(keyword => 
    ideaText.includes(keyword.toLowerCase())
  ).length;
  
  score += simplicityCount * 5; // Add 5 points per simplicity keyword
  
  return Math.max(Math.min(score, 100), 20); // Clamp between 20-100
};

export const calculateGoToMarketDifficulty = (idea: SaasIdeaItem): number => {
  let difficulty = 50; // Base difficulty
  
  // Increase difficulty for B2B vs B2C
  const ideaText = `${idea.target_user} ${idea.one_liner}`.toLowerCase();
  if (ideaText.includes('business') || ideaText.includes('company') || ideaText.includes('enterprise')) {
    difficulty += 20; // B2B is harder
  }
  
  // Reduce difficulty if there's clear pain point validation
  if (idea.representative_post_ids && idea.representative_post_ids.length > 10) {
    difficulty -= 15; // Strong validation reduces difficulty
  }
  
  // Adjust based on market timing
  if (idea.why_now) {
    difficulty -= 10; // Good timing reduces difficulty
  }
  
  // Adjust based on competition
  if (idea.competitive_landscape) {
    difficulty += idea.competitive_landscape.direct_competitors.length * 5;
  }
  
  return Math.max(Math.min(difficulty, 90), 10); // Clamp between 10-90
};

export const estimateMarketSize = (idea: SaasIdeaItem): number => {
  // Base estimation on validation score and user complaints
  const baseSize = idea.score * 1000000; // $1M per score point
  
  // Boost for high engagement (more posts = bigger market)
  const engagementMultiplier = idea.representative_post_ids 
    ? Math.min(1 + (idea.representative_post_ids.length * 0.1), 3) 
    : 1;
  
  return Math.round(baseSize * engagementMultiplier);
};

export const estimateDevelopmentTimeline = (idea: SaasIdeaItem): number => {
  const baseDevelopmentTime = 6; // 6 months base
  
  // Adjust based on technical feasibility
  const feasibilityAdjustment = idea.technical_feasibility_score 
    ? (100 - idea.technical_feasibility_score) * 0.05 
    : 2;
  
  // Adjust based on feature complexity
  const featureCount = idea.core_features?.length || 3;
  const featureAdjustment = Math.max(featureCount - 3, 0) * 0.5;
  
  return Math.round(baseDevelopmentTime + feasibilityAdjustment + featureAdjustment);
};

export const identifyRequiredSkills = (idea: SaasIdeaItem): string[] => {
  const skills: string[] = ['Product Management', 'UI/UX Design'];
  
  const ideaText = `${idea.name} ${idea.one_liner} ${idea.core_features?.join(' ')}`.toLowerCase();
  
  // Technical skills based on keywords
  if (ideaText.includes('web') || ideaText.includes('dashboard') || ideaText.includes('platform')) {
    skills.push('Frontend Development', 'Backend Development');
  }
  
  if (ideaText.includes('mobile') || ideaText.includes('app')) {
    skills.push('Mobile Development');
  }
  
  if (ideaText.includes('ai') || ideaText.includes('machine learning') || ideaText.includes('analytics')) {
    skills.push('Data Science', 'Machine Learning');
  }
  
  if (ideaText.includes('payment') || ideaText.includes('finance') || ideaText.includes('billing')) {
    skills.push('Payment Integration', 'Financial Compliance');
  }
  
  if (ideaText.includes('api') || ideaText.includes('integration')) {
    skills.push('API Development', 'Systems Integration');
  }
  
  // Business skills
  if (idea.target_user?.toLowerCase().includes('business') || 
      idea.target_user?.toLowerCase().includes('enterprise')) {
    skills.push('B2B Sales', 'Enterprise Marketing');
  } else {
    skills.push('Digital Marketing', 'Growth Hacking');
  }
  
  return Array.from(new Set(skills)); // Remove duplicates
};

export const estimateInvestmentRequired = (idea: SaasIdeaItem): number => {
  let investment = 50000; // Base $50k
  
  // Adjust based on development timeline
  if (idea.development_timeline_months) {
    investment += idea.development_timeline_months * 8000; // $8k per month
  }
  
  // Adjust based on technical complexity
  if (idea.technical_feasibility_score && idea.technical_feasibility_score < 70) {
    investment += 25000; // Additional $25k for complex projects
  }
  
  // Adjust based on go-to-market difficulty
  if (idea.go_to_market_difficulty && idea.go_to_market_difficulty > 60) {
    investment += 30000; // Additional $30k for difficult GTM
  }
  
  // Adjust based on required skills
  if (idea.required_skills && idea.required_skills.length > 6) {
    investment += (idea.required_skills.length - 6) * 5000; // $5k per additional skill
  }
  
  return Math.round(investment);
};

// Main function to generate comprehensive enhanced analysis
export const generateEnhancedAnalysis = (idea: SaasIdeaItem, founderSkills: string[] = []): Partial<SaasIdeaItem> => {
  const requiredSkills = identifyRequiredSkills(idea);
  const technicalFeasibility = calculateTechnicalFeasibility(idea);
  const competitiveLandscape = analyzeCompetitiveLandscape(idea);
  const goToMarketDifficulty = calculateGoToMarketDifficulty(idea);
  const marketSize = estimateMarketSize(idea);
  const developmentTimeline = estimateDevelopmentTimeline(idea);
  const investmentRequired = estimateInvestmentRequired(idea);
  const revenueProjection = generateRevenueProjection(idea);
  const founderMarketFit = calculateFounderMarketFit(idea, founderSkills);
  
  return {
    competitive_landscape: competitiveLandscape,
    founder_market_fit_score: founderMarketFit,
    revenue_projection: revenueProjection,
    technical_feasibility_score: technicalFeasibility,
    go_to_market_difficulty: goToMarketDifficulty,
    market_size_estimate: marketSize,
    development_timeline_months: developmentTimeline,
    required_skills: requiredSkills,
    investment_required: investmentRequired
  };
};