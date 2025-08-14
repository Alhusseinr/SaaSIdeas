'use client'

import { useState, useEffect } from 'react'
import { supabase, SaasIdeaItem } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import DataTable from './DataTable'
import EdgeFunctions from './EdgeFunctions'
import ScheduledJobs from './ScheduledJobs'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [items, setItems] = useState<SaasIdeaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    setError('')
    
    try {
      const { data, error } = await supabase
        .from('saas_idea_items')
        .select('*')
        .order('score', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setItems(data || [])
      }
    } catch (err) {
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">SaaS Ideas Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.email}</span>
              <button
                onClick={signOut}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {process.env.NEXT_PUBLIC_SHOW_EDGE_FUNCTIONS === 'true' && <EdgeFunctions />}
          
          <ScheduledJobs />
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">Error: {error}</div>
            </div>
          ) : (
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    SaaS Ideas ({items.length})
                  </h2>
                  <button
                    onClick={fetchItems}
                    disabled={loading}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                    title="Refresh data"
                  >
                    <svg
                      className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <DataTable items={items} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}