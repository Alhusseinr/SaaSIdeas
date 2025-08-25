'use client'

import ScheduledJobs from '@/components/ScheduledJobs'

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">System Operations</h2>
        <p className="text-lg text-gray-600">
          Monitor and manage scheduled data collection and analysis jobs.
        </p>
      </div>
      <ScheduledJobs />
    </div>
  )
}