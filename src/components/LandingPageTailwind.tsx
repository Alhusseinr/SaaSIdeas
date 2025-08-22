'use client'

import React from 'react'
import {
  IconChartBar,
  IconBolt,
  IconEye,
  IconFilter,
  IconTag,
  IconCurrencyDollar,
  IconTrendingUp,
  IconUsers,
  IconRocket,
  IconBrain,
  IconSearch,
  IconCheck,
  IconStar,
  IconDatabase,
  IconTarget
} from '@tabler/icons-react'

interface LandingPageProps {
  onGetStarted: (planId?: string) => void
  onSignIn?: () => void
}

export default function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Indie Developer",
      avatar: "SC",
      content: "Found 3 validated ideas in my first week. The AI analysis saved me months of research.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "Serial Entrepreneur",
      avatar: "MR",
      content: "The market intelligence is incredible. Built a $50k MRR SaaS from an idea I found here.",
      rating: 5
    },
    {
      name: "Emily Watson",
      role: "Product Manager",
      avatar: "EW",
      content: "Best investment for product discovery. The implementation guidance is worth the price alone.",
      rating: 5
    }
  ]

  const stats = [
    { number: "15,000+", label: "Validated Problems" },
    { number: "8,500+", label: "Market Opportunities" },
    { number: "2,000+", label: "Active Entrepreneurs" },
    { number: "94%", label: "Success Rate" }
  ]

  const coreFeatures = [
    {
      icon: IconDatabase,
      title: 'Discover Real Problems',
      description: 'Access 15,000+ validated problems from Reddit, Twitter, and forums. Each problem includes frustrated users actively seeking solutions.'
    },
    {
      icon: IconTarget,
      title: 'Get Instant Validation',
      description: 'Our AI scores each opportunity based on market demand, competition level, and implementation difficulty. Skip months of research.'
    },
    {
      icon: IconBolt,
      title: 'Build with Confidence',
      description: 'Get detailed implementation guides, tech stack recommendations, and go-to-market strategies for every validated opportunity.'
    },
    {
      icon: IconTrendingUp,
      title: 'Track Market Trends',
      description: 'Monitor how problems evolve over time. Catch emerging opportunities before they become saturated markets.'
    }
  ]

  const phaseFeatures = {
    essential: [
      {
        icon: IconEye,
        title: 'Source Intelligence',
        description: 'Access original Reddit and Twitter posts driving each opportunity. Complete transparency with direct links to authentic user complaints and market signals.'
      },
      {
        icon: IconChartBar,
        title: 'Core Market Analysis',
        description: 'Essential market validation metrics and opportunity scoring framework for strategic idea assessment and prioritization.'
      },
      {
        icon: IconFilter,
        title: 'Advanced Filtering System',
        description: 'Sophisticated filtering by industry vertical, development complexity, market timing, and validation score ranges across our comprehensive opportunity database.'
      }
    ],
    professional: [
      {
        icon: IconTag,
        title: 'Competitive Intelligence',
        description: 'Comprehensive competitive landscape analysis and strategic white space opportunity identification across all market segments.'
      },
      {
        icon: IconCurrencyDollar,
        title: 'Revenue Strategy Modeling',
        description: 'AI-generated pricing strategies and revenue optimization models based on comprehensive market analysis and user value perception research.'
      },
      {
        icon: IconTrendingUp,
        title: 'Market Dynamics Analysis',
        description: 'Real-time tracking of market trends, user sentiment evolution, and opportunity maturation cycles for strategic timing optimization.'
      }
    ],
    enterprise: [
      {
        icon: IconUsers,
        title: 'Team Collaboration Suite',
        description: 'Advanced collaboration tools for distributed teams including shared workspaces, annotation systems, and strategic decision-making frameworks.'
      },
      {
        icon: IconRocket,
        title: 'Implementation Accelerator',
        description: 'Comprehensive implementation roadmaps, technical architecture recommendations, and go-to-market strategy development for rapid execution.'
      },
      {
        icon: IconBrain,
        title: 'Custom AI Analysis',
        description: 'Personalized AI models trained on your specific market focus areas, industry expertise, and strategic objectives for enhanced opportunity identification.'
      }
    ]
  }

  const pricingPlans = [
    {
      id: 'starter',
      name: 'Starter',
      price: 39,
      period: 'month',
      popular: false,
      description: 'Perfect for solo entrepreneurs testing the waters',
      features: [
        'Access to 5,000+ validated problems',
        'Basic AI validation scoring',
        'Implementation guides',
        'Reddit source links',
        'Email support'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 79,
      period: 'month',
      popular: true,
      description: 'For serious builders ready to launch',
      features: [
        'Full database (15,000+ problems)',
        'Advanced AI analysis with GPT-4',
        'Multi-platform data (Reddit + Twitter)',
        'Market trend tracking',
        'Priority support & live chat',
        'Custom filters & saved searches'
      ]
    },
    {
      id: 'enterprise',
      name: 'Team',
      price: 199,
      period: 'month',
      popular: false,
      description: 'For teams and agencies building multiple products',
      features: [
        'Everything in Professional',
        'Team collaboration workspace',
        'White-label reports',
        'API access',
        'Dedicated account manager',
        'Custom data sources'
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div 
        className="relative overflow-hidden py-24 lg:py-32"
        style={{ 
          background: 'linear-gradient(135deg, #0D0D0D 0%, #0A1F44 50%, #8A8D91 100%)'
        }}
      >
        {/* Abstract decorative elements */}
        <div
          className="absolute top-20 right-10 w-72 h-72 rounded-full opacity-20 blur-3xl transform rotate-45"
          style={{
            background: 'linear-gradient(45deg, rgba(0, 107, 60, 0.3) 0%, rgba(197, 164, 109, 0.3) 100%)'
          }}
        />
        <div
          className="absolute bottom-10 left-5 w-48 h-48 opacity-20 blur-2xl transform -rotate-12 rounded-3xl"
          style={{
            background: 'linear-gradient(45deg, rgba(10, 31, 68, 0.4) 0%, rgba(138, 141, 145, 0.2) 100%)'
          }}
        />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div 
                className="inline-block px-4 py-2 text-sm font-medium rounded-full backdrop-blur-sm border"
                style={{
                  backgroundColor: 'rgba(0, 107, 60, 0.2)',
                  color: '#006B3C',
                  borderColor: 'rgba(0, 107, 60, 0.3)'
                }}
              >
                🚀 Skip the Guesswork. Start with Validation.
              </div>
              <h1 
                className="text-4xl lg:text-5xl font-bold leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #F5F5F5 0%, #C5A46D 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Find Your Next SaaS Idea in Minutes, Not Months
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Access 15,000+ validated problems from real users. Our AI analyzes Reddit, Twitter, and forums to find profitable opportunities before your competition does.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  className="px-8 py-4 rounded-xl text-white font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #006B3C 0%, #0A1F44 100%)',
                    boxShadow: '0 8px 32px rgba(0, 107, 60, 0.3)'
                  }}
                  onClick={() => onGetStarted()}
                >
                  <IconRocket size={20} />
                  Start Finding Ideas Now
                </button>
                {onSignIn && (
                  <button
                    className="px-8 py-3 rounded-xl font-medium border-2 hover:bg-opacity-10 transition-all duration-300"
                    style={{ 
                      borderColor: '#C5A46D',
                      color: '#C5A46D'
                    }}
                    onClick={onSignIn}
                  >
                    Access Platform
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              {/* Placeholder for TodaysOpportunityCard - you'd need to convert this too */}
              <div className="w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="text-center text-white">
                  <h3 className="text-lg font-semibold mb-4">Today's Hot Opportunity</h3>
                  <div className="space-y-3 text-sm opacity-90">
                    <p>📊 Market Score: 8.9/10</p>
                    <p>💰 Revenue Potential: $2M+</p>
                    <p>⚡ Implementation: Medium</p>
                    <p className="text-xs mt-4">"People are frustrated with current project management tools..."</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white border-t border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Core Features */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 text-sm font-medium rounded-full mb-4 bg-green-50 text-green-700 border border-green-200">
              How It Works
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              From Problem to Profitable SaaS in 3 Steps
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI scans millions of conversations daily to find real problems people are willing to pay to solve. No more guessing what to build.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {coreFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="text-center">
                  <div 
                    className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #006B3C 0%, #0A1F44 100%)' }}
                  >
                    <feature.icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social Proof Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 text-sm font-medium rounded-full mb-4 bg-yellow-50 text-yellow-700 border border-yellow-200">
              Success Stories
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Join 2,000+ Entrepreneurs Finding Their Next Big Idea
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <IconStar key={i} size={16} className="text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 leading-relaxed">
                  "{testimonial.content}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 text-sm font-medium rounded-full mb-4 bg-yellow-50 text-yellow-700 border border-yellow-200">
              Investment Plans
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              Simple Pricing That Pays for Itself
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              One validated idea can generate 6-7 figures in revenue. Our users typically find profitable opportunities within their first week.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan) => (
              <div key={plan.id} className="relative">
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className={`bg-white p-8 rounded-2xl ${plan.popular ? 'border-2 border-green-600 shadow-xl' : 'border border-gray-200'}`}>
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-6">
                      {plan.description}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-green-600">
                        ${plan.price}
                      </span>
                      <span className="text-gray-600">
                        per {plan.period}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <IconCheck size={16} className="text-green-600 mt-1 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-green-600 to-blue-800 text-white shadow-lg hover:shadow-xl' 
                        : 'border border-yellow-600 text-yellow-600 hover:bg-yellow-50'
                    }`}
                    onClick={() => onGetStarted(plan.id)}
                  >
                    {plan.popular ? "Start 7-Day Free Trial" : `Try ${plan.name} Free`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div 
        className="relative overflow-hidden py-20"
        style={{ background: 'linear-gradient(135deg, #0D0D0D 0%, #0A1F44 50%, #8A8D91 100%)' }}
      >
        <div
          className="absolute top-1/2 left-20 w-48 h-48 rounded-full opacity-10 blur-2xl"
          style={{
            background: 'linear-gradient(45deg, rgba(197, 164, 109, 0.3) 0%, rgba(0, 107, 60, 0.3) 100%)'
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Stop Building Products Nobody Wants
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Join 2,000+ entrepreneurs who found their profitable SaaS idea using real market data. Start with validation, not guesswork.
          </p>
          <button
            className="px-8 py-4 rounded-xl text-gray-900 font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 mx-auto"
            style={{ 
              background: 'linear-gradient(135deg, #006B3C 0%, #C5A46D 100%)',
              boxShadow: '0 8px 32px rgba(197, 164, 109, 0.3)'
            }}
            onClick={() => onGetStarted()}
          >
            <IconSearch size={24} />
            Find My Next Idea Now
          </button>
        </div>
      </div>
    </div>
  )
}