'use client'

import SubscriptionPage from '@/components/SubscriptionPage'

export default function SubscriptionManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Subscription Management</h2>
        <p className="text-lg text-gray-600">
          Manage your subscription plan and billing information.
        </p>
      </div>
      <SubscriptionPage />
    </div>
  )
}