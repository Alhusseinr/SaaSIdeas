'use client'

import EdgeFunctions from '@/components/EdgeFunctions'

export default function EdgeFunctionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Edge Functions</h2>
        <p className="text-lg text-gray-600">
          Monitor and manage serverless functions for data processing and analysis.
        </p>
      </div>
      <EdgeFunctions />
    </div>
  )
}