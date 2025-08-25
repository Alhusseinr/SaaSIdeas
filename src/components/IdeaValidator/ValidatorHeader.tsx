"use client";

import { IconBrain, IconX } from "@tabler/icons-react";

interface ValidatorHeaderProps {
  hasFormData: boolean;
  onClearForm: () => void;
}

export function ValidatorHeader({ hasFormData, onClearForm }: ValidatorHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white">
            <IconBrain size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              AI Idea Validator
            </h2>
            <p className="text-white text-opacity-90 text-sm">
              Test your SaaS idea against real market data and user complaints
            </p>
          </div>
        </div>
        {hasFormData && (
          <button
            onClick={onClearForm}
            className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 text-white border border-white border-opacity-30 rounded-lg text-sm font-medium hover:bg-opacity-30 transition-all"
          >
            <IconX size={16} />
            Clear Form
          </button>
        )}
      </div>
    </div>
  );
}