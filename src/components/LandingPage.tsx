'use client'

import TodaysOpportunityCard from './TodaysOpportunityCard'

export default function LandingPage({ onGetStarted, onSignIn }: { onGetStarted: (planId?: string) => void, onSignIn?: () => void }) {

  const coreFeatures = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'AI-Powered Market Analysis',
      description: 'Discover validated SaaS opportunities from real user complaints and market pain points using advanced AI analysis.'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Real-Time Data Ingestion',
      description: 'Continuously monitor Reddit, Twitter, and other platforms for emerging problems that need solving.'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Validation Scoring',
      description: 'Get AI-generated validation scores and comprehensive market analysis for every idea opportunity.'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Implementation Guidance',
      description: 'Generate detailed technical specifications and business plans to turn ideas into reality.'
    }
  ]

  const phaseFeatures = {
    phase1: [
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        title: 'Real Source Posts',
        description: 'View the actual Reddit and Twitter posts that inspired each opportunity. See real user complaints with links to originals.'
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        title: 'Basic Market Analysis',
        description: 'Essential market validation metrics and opportunity scoring for core idea assessment.'
      },
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        ),
        title: 'Search & Filters',
        description: 'Filter by industry, build time, difficulty level, and score ranges across all validated opportunities.'
      }
    ],
    phase2: [
      {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      title: 'Competitive Intelligence',
      description: 'Understand the competitive landscape and identify white space opportunities in any market.'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      title: 'Revenue Modeling',
      description: 'AI-generated pricing strategies and revenue models based on market analysis and user willingness to pay.'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: 'Advanced Analytics',
      description: 'Deep market opportunity analysis with TAM, SAM, and SOM breakdowns based on real demand indicators.'
    }
  ],
  phase3: [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      title: 'API Access',
      description: 'Full programmatic access to our opportunity database and analysis engine for custom integrations.'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'Team Collaboration',
      description: 'Advanced team features with shared workspaces, custom roles, and collaborative opportunity tracking.'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      ),
      title: 'White-Label Solutions',
      description: 'Custom branding and deployment options for agencies, VCs, and enterprise clients.'
    }
  ]
}

  const pricingPlans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 49,
      period: 'month',
      description: 'Perfect for individual entrepreneurs and side projects',
      features: [
        '25 idea validations per month',
        'AI-powered market analysis',
        'Reddit data integration',
        'Email support',
        'Implementation prompts',
        'Basic competitive analysis',
        'Export to CSV'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 99,
      period: 'month',
      description: 'Ideal for serious builders and small teams',
      features: [
        '100 idea validations per month',
        'Advanced AI analysis with GPT-4',
        'Reddit + Twitter integration',
        'Priority support & live chat',
        'Custom implementation plans',
        'Advanced competitive intelligence',
        'Revenue modeling & pricing analysis',
        'API access',
        'Advanced export capabilities',
        'Team collaboration (up to 3 users)'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 199,
      period: 'month',
      description: 'For agencies, VCs, and large teams',
      features: [
        'Unlimited idea validations',
        'Multi-platform data integration',
        'White-label options',
        'Dedicated account manager',
        'Custom AI training',
        'Advanced analytics dashboard',
        'Team collaboration (unlimited users)',
        'Priority feature requests',
        'Custom integrations',
        'SLA guarantee',
        'On-premise deployment option'
      ],
      popular: false
    }
  ]

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Serial Entrepreneur',
      company: 'TechStorm Ventures',
      content: 'This platform helped me identify 3 validated SaaS opportunities in my first month. The AI analysis is incredibly thorough.',
      avatar: '👩‍💻'
    },
    {
      name: 'Marcus Rodriguez',
      role: 'Product Manager',
      company: 'InnovateX',
      content: 'The real-time market intelligence gives us a massive competitive advantage. We\'ve launched 2 successful products using insights from this platform.',
      avatar: '👨‍💼'
    },
    {
      name: 'Emily Watson',
      role: 'Startup Founder',
      company: 'CloudSync Pro',
      content: 'The implementation guidance feature is game-changing. It\'s like having a technical co-founder and business strategist in one tool.',
      avatar: '👩‍🚀'
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">IdeaValidator</span>
            </div>
            <div className="flex items-center space-x-6">
              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-6">
                <a
                  href="#about"
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                >
                  How It Works
                </a>
                <a
                  href="#pricing"
                  className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                >
                  Pricing
                </a>
              </nav>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onSignIn && onSignIn()}
                  className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onGetStarted()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with 50/50 Split */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Value Proposition */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Discover Your Next
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Million-Dollar </span>
                SaaS Idea
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Stop guessing what to build. Our AI analyzes millions of real user complaints and market signals 
                to surface validated SaaS opportunities with proven demand. We transform genuine pain points from 
                Reddit, Twitter, and other platforms into actionable business opportunities, complete with market 
                analysis, competitive intelligence, and implementation roadmaps. Skip months of market research 
                and start building solutions that people are already asking for.
              </p>
              
              {/* Key Benefits */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center lg:justify-start">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Real problems from actual Reddit users</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">AI-powered market analysis & validation</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Complete implementation roadmaps</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => onGetStarted()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  Get Instant Access
                </button>
                <button className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors">
                  View Today's Opportunity →
                </button>
              </div>
            </div>

            {/* Right Side - Today's Validated Opportunity */}
            <TodaysOpportunityCard onGetStarted={onGetStarted} />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">10M+</div>
              <div className="text-gray-600">Posts Analyzed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">2,500+</div>
              <div className="text-gray-600">Ideas Generated</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">89%</div>
              <div className="text-gray-600">Validation Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">150+</div>
              <div className="text-gray-600">Successful Launches</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Core Platform Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The essential tools every SaaS entrepreneur needs to discover, validate, and build successful products.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {coreFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Phased Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Feature Roadmap: Built for Growth
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform evolves with your needs. Start with essential validation tools and scale up to advanced analytics and enterprise features.
            </p>
          </div>

          {/* Phase 1 - Foundation */}
          <div className="mb-16">
            <div className="text-center mb-10">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mb-4">
                Phase 1: Foundation
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Essential Validation & Discovery</h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Everything you need to start finding and validating SaaS opportunities from real user data.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {phaseFeatures.phase1.map((feature, index) => (
                <div key={index} className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white mb-4">
                    {feature.icon}
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h4>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 2 - Growth */}
          <div className="mb-16">
            <div className="text-center mb-10">
              <div className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold mb-4">
                Phase 2: Growth
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Advanced Analysis & Intelligence</h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Deep market insights, competitive analysis, and revenue modeling for serious builders.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {phaseFeatures.phase2.map((feature, index) => (
                <div key={index} className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white mb-4">
                    {feature.icon}
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h4>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 3 - Scale */}
          <div>
            <div className="text-center mb-10">
              <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-4">
                Phase 3: Scale
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Enterprise & Integration</h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Advanced collaboration, API access, and white-label solutions for teams and enterprises.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {phaseFeatures.phase3.map((feature, index) => (
                <div key={index} className="bg-green-50 p-6 rounded-xl border border-green-200">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white mb-4">
                    {feature.icon}
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h4>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works: From Reddit Complaints to SaaS Success
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI-powered platform transforms real user frustrations into validated business opportunities. 
              Here's the complete process behind finding your next SaaS idea.
            </p>
          </div>

          {/* Process Flow */}
          <div className="mb-20">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Data Collection</h3>
                <p className="text-sm text-gray-600">Monitor Reddit, Twitter/X, and other platforms for user complaints and pain points</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. AI Analysis</h3>
                <p className="text-sm text-gray-600">Advanced AI processes complaints to identify software-solvable problems and market gaps</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Validation</h3>
                <p className="text-sm text-gray-600">Generate validation scores, market analysis, and feasibility assessments for each opportunity</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">4. Actionable Insights</h3>
                <p className="text-sm text-gray-600">Receive detailed implementation plans, cost estimates, and go-to-market strategies</p>
              </div>
            </div>
          </div>

          {/* Detailed Features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Left Column - Core Features */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">🎯 Core Platform Features</h3>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Real Source Posts</h4>
                    <p className="text-gray-600 text-sm">View the actual Reddit and Twitter posts that inspired each opportunity. See real user complaints with links to originals for credibility.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Transparent Scoring</h4>
                    <p className="text-gray-600 text-sm">Click "How is this calculated?" on any score to see the exact methodology, weighted factors, and data sources behind our AI analysis.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Advanced Search & Filters</h4>
                    <p className="text-gray-600 text-sm">Filter by industry, build time, difficulty level, product type, and score ranges. Search across 200+ validated opportunities.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Market Opportunity Analysis</h4>
                    <p className="text-gray-600 text-sm">Get realistic market size estimates based on user demand indicators, not fictional revenue projections. See TAM, SAM, and SOM breakdowns.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Analysis Features */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 Deep Analysis & Guidance</h3>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Transparent Cost Breakdown</h4>
                    <p className="text-gray-600 text-sm">See detailed investment estimates with methodology: Development timeline × $8K/month + infrastructure costs. Includes bootstrap-friendly alternatives.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Competitive Intelligence</h4>
                    <p className="text-gray-600 text-sm">Discover existing solutions, market gaps, and differentiation opportunities. Understand what competitors are missing.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Build Time Estimates</h4>
                    <p className="text-gray-600 text-sm">Realistic development timelines in weeks, not months. Based on feature complexity, technical requirements, and team composition.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-4 mt-1">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">SaaS-Only Focus</h4>
                    <p className="text-gray-600 text-sm">Intelligent filtering removes physical products, restaurants, and non-software ideas. Every opportunity is digitally implementable.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Sources & Quality */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">📡 Data Sources & Quality Standards</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">R</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Reddit Integration</h4>
                <p className="text-sm text-gray-600">Monitor 10+ business subreddits for real user frustrations. OAuth2 authenticated API access with rate limiting.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">𝕏</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Twitter/X API v2</h4>
                <p className="text-sm text-gray-600">Track startup conversations and pain points. Intelligent quota management for all API tiers including free tier limits.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">AI Processing</h4>
                <p className="text-sm text-gray-600">Advanced sentiment analysis and opportunity detection. Filters out physical products and focuses on software-solvable problems.</p>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="font-semibold text-blue-900 mb-2">Quality Guarantees:</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Real user posts with source links
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  SaaS/software opportunities only
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Transparent scoring methodology
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Daily updates with fresh opportunities
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that scales with your ambition. All plans include our core AI validation engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <div 
                key={index} 
                className={`relative bg-white rounded-2xl border-2 p-8 ${
                  plan.popular 
                    ? 'border-blue-500 shadow-xl scale-105' 
                    : 'border-gray-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-6">{plan.description}</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-600 ml-2">/{plan.period}</span>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => onGetStarted(plan.id)}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transform hover:scale-105'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Get Started with {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Trusted by Successful Entrepreneurs
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of builders who've found their next big opportunity
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{testimonial.avatar}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Find Your Next SaaS Opportunity?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of entrepreneurs who use our platform to discover, validate, and build successful SaaS products.
          </p>
          <button
            onClick={() => onGetStarted()}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Get Instant Access
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xl font-bold">IdeaValidator</span>
              </div>
              <p className="text-gray-400">
                Discover validated SaaS opportunities powered by AI and real market data.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 IdeaValidator. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}