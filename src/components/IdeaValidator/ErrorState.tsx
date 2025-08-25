"use client";

import { IconX } from "@tabler/icons-react";

interface ErrorStateProps {
  error: string;
}

export function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
          <IconX size={16} className="text-white" />
        </div>
        <div>
          <h4 className="text-red-900 font-semibold mb-1">
            Validation Error
          </h4>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    </div>
  );
}