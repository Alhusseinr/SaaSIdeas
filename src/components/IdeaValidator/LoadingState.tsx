"use client";

export function LoadingState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
          <h3 className="text-xl font-bold text-gray-900">
            Analyzing Your Idea
          </h3>
          <p className="text-sm text-gray-600 text-center max-w-md">
            Our AI is searching through millions of social media posts,
            complaints, and market signals to validate your SaaS concept...
          </p>
          <p className="text-xs text-gray-500">
            Processing market data...
          </p>
        </div>
      </div>
    </div>
  );
}