"use client";

import { IconBolt, IconCheck } from "@tabler/icons-react";

export function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-6 max-w-md text-center">
          <div className="w-20 h-20 bg-green-600 rounded-2xl flex items-center justify-center text-white">
            <IconBolt size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            Ready to Validate Your Idea?
          </h3>
          <p className="text-gray-600 leading-relaxed">
            Fill out the form above and click "Validate My Idea" to get
            comprehensive market insights powered by AI analysis of real user
            complaints and market data.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <IconCheck size={16} className="text-green-600" />
              <span className="text-gray-600">Real market data</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck size={16} className="text-green-600" />
              <span className="text-gray-600">AI-powered analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCheck size={16} className="text-green-600" />
              <span className="text-gray-600">Instant results</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}