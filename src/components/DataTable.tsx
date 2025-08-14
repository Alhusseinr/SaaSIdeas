'use client'

import { useState, useMemo } from 'react'
import { SaasIdeaItem } from '@/lib/supabase'

interface DataTableProps {
  items: SaasIdeaItem[]
}

export default function DataTable({ items }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof SaasIdeaItem>('score')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState<SaasIdeaItem | null>(null)

  const handleSort = (field: keyof SaasIdeaItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.one_liner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.target_user?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })
  }, [items, sortField, sortDirection, searchTerm])

  const SortIcon = ({ field }: { field: keyof SaasIdeaItem }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>
    }
    return <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <>
      <div className="p-6">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search ideas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('score')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Score</span>
                    <SortIcon field="score" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  One Liner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target User
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Created</span>
                    <SortIcon field="created_at" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(item.score)}`}>
                      {item.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {item.one_liner || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.target_user || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedItems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">No items found matching your search.</div>
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={() => setSelectedItem(null)}>
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white" onClick={e => e.stopPropagation()}>
            <div className="mt-3">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-gray-900">{selectedItem.name}</h3>
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setSelectedItem(null)}
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(selectedItem.score)}`}>
                    Score: {selectedItem.score}
                  </span>
                  <span className="text-sm text-gray-500">Run ID: {selectedItem.run_id}</span>
                </div>
                
                {selectedItem.one_liner && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">One Liner</h4>
                    <p className="text-sm text-gray-700">{selectedItem.one_liner}</p>
                  </div>
                )}
                
                {selectedItem.target_user && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Target User</h4>
                    <p className="text-sm text-gray-700">{selectedItem.target_user}</p>
                  </div>
                )}
                
                {selectedItem.core_features && selectedItem.core_features.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Core Features</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {selectedItem.core_features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedItem.why_now && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Why Now</h4>
                    <p className="text-sm text-gray-700">{selectedItem.why_now}</p>
                  </div>
                )}
                
                {selectedItem.pricing_hint && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Pricing Hint</h4>
                    <p className="text-sm text-gray-700">{selectedItem.pricing_hint}</p>
                  </div>
                )}
                
                {selectedItem.rationale && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Rationale</h4>
                    <p className="text-sm text-gray-700">{selectedItem.rationale}</p>
                  </div>
                )}
                
                {selectedItem.representative_post_ids && selectedItem.representative_post_ids.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Representative Post IDs</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.representative_post_ids.map((id, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}