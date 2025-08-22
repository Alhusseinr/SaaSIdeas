'use client'

import React from 'react'
import {
  IconRocket,
  IconSearch,
  IconCheck,
  IconStar,
  IconDatabase,
  IconTarget,
  IconBolt,
  IconTrendingUp
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
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800"></div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-20"></div>
        <div className="absolute bottom-10 left-5 w-48 h-48 bg-green-600 rounded-full mix-blend-multiply filter blur-xl opacity-20"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-2 text-sm font-medium text-green-400 bg-green-900/20 border border-green-400/20 rounded-full backdrop-blur-sm">
                🚀 Skip the Guesswork. Start with Validation.
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
                Find Your Next{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">
                  SaaS Idea
                </span>{' '}
                in Minutes, Not Months
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Access 15,000+ validated problems from real users. Our AI analyzes Reddit, Twitter, and forums to find profitable opportunities before your competition does.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-gradient-to-r from-green-600 to-blue-600 border border-transparent rounded-xl hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-lg"
                  onClick={() => onGetStarted()}
                >
                  <IconRocket size={20} className="mr-2" />
                  Start Finding Ideas Now
                </button>
                {onSignIn && (
                  <button
                    className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-yellow-400 bg-transparent border-2 border-yellow-400 rounded-xl hover:bg-yellow-400 hover:text-gray-900 transition-all duration-200"
                    onClick={onSignIn}
                  >
                    Access Platform
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-md p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl">
                <div className="text-center text-white">
                  <h3 className="text-lg font-semibold mb-4">Problem of the Day</h3>
                  <div className="space-y-4 text-sm">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">R</span>
                        </div>
                        <span className="text-xs opacity-70">r/SaaS • 2 hours ago</span>
                      </div>
                      <p className="text-left text-sm leading-relaxed mb-3">
                        "Why is it so hard to find a project management tool that doesn't feel bloated? I just need simple task tracking without 50 features I'll never use..."
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="opacity-60">47 upvotes • 23 comments</span>
                        <span className="text-green-400 font-medium">💡 Opportunity</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="text-center">
                        <div className="text-green-400 font-semibold">8.9/10</div>
                        <div className="opacity-70">Demand</div>
                      </div>
                      <div className="text-center">
                        <div className="text-blue-400 font-semibold">Low</div>
                        <div className="opacity-70">Competition</div>
                      </div>
                      <div className="text-center">
                        <div className="text-yellow-400 font-semibold">$2M+</div>
                        <div className="opacity-70">Potential</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-b from-slate-50 to-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-green-600 mb-2">
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
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              From Problem to Profitable SaaS in 3 Steps
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI scans millions of conversations daily to find real problems people are willing to pay to solve. No more guessing what to build.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {coreFeatures.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-600 to-blue-600 rounded-2xl flex items-center justify-center">
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

      {/* Platform Sources Section */}
      <div className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
              We Monitor Every Platform Where Problems Are Shared
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI scans 14+ major platforms continuously to capture real problems as they emerge across the entire internet ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { 
                name: 'Twitter/X', 
                icon: '𝕏', 
                bgColor: 'bg-black', 
                description: 'Tech complaints & startup discussions',
                volume: '50K+ daily posts'
              },
              { 
                name: 'Hacker News', 
                icon: 'Y', 
                bgColor: 'bg-orange-500', 
                description: 'Ask HN & tech problems',
                volume: '5K+ daily comments'
              },
              { 
                name: 'ProductHunt', 
                icon: 'P', 
                bgColor: 'bg-orange-400', 
                description: 'Product feedback & reviews',
                volume: '2K+ daily comments'
              },
              { 
                name: 'Discord', 
                icon: 'D', 
                bgColor: 'bg-indigo-500', 
                description: 'Real-time dev discussions',
                volume: '25K+ messages/day'
              },
              { 
                name: 'GitHub', 
                icon: 'G', 
                bgColor: 'bg-gray-800', 
                description: 'Open source pain points',
                volume: '15K+ issues daily'
              },
              { 
                name: 'Stack Overflow', 
                icon: 'S', 
                bgColor: 'bg-orange-600', 
                description: 'Developer frustrations',
                volume: '8K+ questions/day'
              },
              { 
                name: 'LinkedIn', 
                icon: 'in', 
                bgColor: 'bg-blue-600', 
                description: 'Professional complaints',
                volume: '30K+ posts daily'
              },
              { 
                name: 'Forums', 
                icon: 'F', 
                bgColor: 'bg-green-600', 
                description: 'Industry discussions',
                volume: '10K+ posts daily'
              },
              { 
                name: 'Stack Overflow', 
                icon: '📋', 
                bgColor: 'bg-orange-400', 
                description: 'Developer pain points',
                volume: '50K+ questions/day'
              },
              { 
                name: 'Quora', 
                icon: '❓', 
                bgColor: 'bg-red-600', 
                description: '"Why doesn\'t X exist?" questions',
                volume: '20K+ questions/day'
              },
              { 
                name: 'Medium', 
                icon: '📝', 
                bgColor: 'bg-gray-900', 
                description: 'Technical problem discussions',
                volume: '15K+ articles/day'
              },
              { 
                name: 'Dev.to', 
                icon: '👨‍💻', 
                bgColor: 'bg-purple-600', 
                description: 'Developer pain points & tools',
                volume: '5K+ posts/day'
              },
              { 
                name: 'Lobsters', 
                icon: '🦞', 
                bgColor: 'bg-red-700', 
                description: 'High-quality tech discussions',
                volume: '100+ posts/day'
              },
              { 
                name: 'Indie Hackers', 
                icon: '🚀', 
                bgColor: 'bg-blue-600', 
                description: 'Direct entrepreneur problems',
                volume: '500+ posts/day'
              }
            ].map((platform, index) => (
              <div key={index} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 group">
                <div className="text-center">
                  <div className={`w-12 h-12 mx-auto mb-3 ${platform.bgColor} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <span className="text-white font-bold text-sm">{platform.icon}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">
                    {platform.name}
                  </h3>
                  <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                    {platform.description}
                  </p>
                  <div className="text-xs text-green-600 font-medium">
                    {platform.volume}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-200">
              <IconDatabase size={16} />
              <span>Processing 150K+ data points daily across all platforms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
              We Monitor 50+ Communities for Real Problems
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI scans the most active entrepreneurship, tech, and business communities to find validated problems with built-in demand.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { name: 'r/SaaS', members: '180K', category: 'Business' },
              { name: 'r/Entrepreneur', members: '1.2M', category: 'Business' },
              { name: 'r/startups', members: '1.5M', category: 'Business' },
              { name: 'r/webdev', members: '1.8M', category: 'Tech' },
              { name: 'r/programming', members: '4.2M', category: 'Tech' },
              { name: 'r/productivity', members: '1.1M', category: 'Lifestyle' },
              { name: 'r/freelance', members: '285K', category: 'Work' },
              { name: 'r/remotework', members: '180K', category: 'Work' },
              { name: 'r/personalfinance', members: '15.8M', category: 'Finance' },
              { name: 'r/investing', members: '1.9M', category: 'Finance' },
              { name: 'r/smallbusiness', members: '1.4M', category: 'Business' },
              { name: 'r/marketing', members: '780K', category: 'Business' },
              { name: 'r/cscareerquestions', members: '1.3M', category: 'Tech' },
              { name: 'r/digitalnomad', members: '1.8M', category: 'Lifestyle' },
              { name: 'r/sideproject', members: '200K', category: 'Business' }
            ].map((subreddit, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all duration-200 group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                    <span className="text-white text-xs font-bold">R</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{subreddit.name}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{subreddit.members} members</span>
                  <span className="text-orange-600 font-medium">{subreddit.category}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-full">
              <IconDatabase size={16} />
              <span>+ 35 more communities analyzed daily</span>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof Section */}
      <div className="bg-gradient-to-b from-gray-100 to-slate-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Join 2,000+ Entrepreneurs Finding Their Next Big Idea
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
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
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              Simple Pricing That Pays for Itself
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              One validated idea can generate 6-7 figures in revenue. Our users typically find profitable opportunities within their first week.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan) => (
              <div key={plan.id} className="relative h-full">
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className={`bg-white p-8 rounded-2xl h-full flex flex-col ${plan.popular ? 'border-2 border-green-500 shadow-xl' : 'border border-gray-200 shadow-sm'}`}>
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

                  <ul className="space-y-4 mb-8 flex-grow">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <IconCheck size={16} className="text-green-600 mt-1 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 mt-auto ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg hover:from-green-700 hover:to-blue-700 hover:shadow-xl' 
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
      <div className="relative bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800"></div>
        <div className="absolute top-1/2 left-20 w-48 h-48 bg-yellow-600 rounded-full mix-blend-multiply filter blur-xl opacity-10"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Stop Building Products Nobody Wants
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Join 2,000+ entrepreneurs who found their profitable SaaS idea using real market data. Start with validation, not guesswork.
          </p>
          <button
            className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-gray-900 bg-gradient-to-r from-green-400 to-yellow-400 border border-transparent rounded-xl hover:from-green-500 hover:to-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-lg"
            onClick={() => onGetStarted()}
          >
            <IconSearch size={24} className="mr-2" />
            Find My Next Idea Now
          </button>
        </div>
      </div>
    </div>
  )
}