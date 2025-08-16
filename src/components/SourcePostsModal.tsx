"use client";

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SourcePost {
  id: string
  platform: string
  platform_post_id: string
  author: string | null
  url: string | null
  created_at: string
  title: string | null
  body: string | null
  upvotes?: number
}

interface SourcePostsModalProps {
  ideaId: string
  isOpen: boolean
  onClose: () => void
  representativePostIds?: string[]
}

export default function SourcePostsModal({ ideaId, isOpen, onClose, representativePostIds }: SourcePostsModalProps) {
  const [sourcePosts, setSourcePosts] = useState<SourcePost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && representativePostIds && representativePostIds.length > 0) {
      fetchSourcePosts()
    }
  }, [isOpen, representativePostIds])

  const fetchSourcePosts = async () => {
    if (!representativePostIds || representativePostIds.length === 0) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Using the exported supabase instance
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('id', representativePostIds)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        throw error
      }

      setSourcePosts(data || [])
    } catch (err) {
      console.error('Error fetching source posts:', err)
      setError('Failed to load source posts')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    })
  }

  const truncateText = (text: string, maxLength: number = 300) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'reddit':
        return (
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
        )
      case 'twitter':
        return (
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">𝕏</span>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">?</span>
          </div>
        )
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Source Posts & User Complaints</h2>
              <p className="text-blue-100 text-sm">Real user problems that inspired this opportunity</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-300 rounded w-full"></div>
                      <div className="h-3 bg-gray-300 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Posts</h3>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : sourcePosts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Source Posts Found</h3>
              <p className="text-gray-600">We couldn't find the original posts for this opportunity.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-medium text-blue-900 mb-2">About These Posts</h3>
                <p className="text-sm text-blue-800">
                  These are real complaints and pain points from users across Reddit and Twitter. Our AI analyzed these posts to identify the underlying business opportunity and market demand.
                </p>
              </div>

              {sourcePosts.map((post) => (
                <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start space-x-3">
                    {getPlatformIcon(post.platform)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-gray-900">
                          {post.author ? `@${post.author}` : 'Anonymous User'}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{formatDate(post.created_at)}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full capitalize">
                          {post.platform}
                        </span>
                      </div>
                      
                      {post.title && (
                        <h4 className="font-medium text-gray-900 mb-2 leading-tight">
                          {post.title}
                        </h4>
                      )}
                      
                      <p className="text-gray-700 leading-relaxed mb-3">
                        {truncateText(post.body || '', 400)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          {post.upvotes && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                              </svg>
                              {post.upvotes} upvotes
                            </div>
                          )}
                          <span className="text-xs text-gray-400">
                            ID: {post.platform_post_id}
                          </span>
                        </div>
                        
                        {post.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View Original
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}