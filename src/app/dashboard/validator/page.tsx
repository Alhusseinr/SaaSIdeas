'use client'

import IdeaValidator from '@/components/IdeaValidator'

export default function ValidatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Opportunity Validator</h2>
        <p className="text-lg text-gray-600">
          Validate your SaaS ideas using our AI-powered analysis engine.
        </p>
      </div>
      <IdeaValidator />
    </div>
  )
}