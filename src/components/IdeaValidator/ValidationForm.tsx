"use client";

import {
  IconBolt,
  IconBulb,
  IconChartBar,
  IconCurrencyDollar,
  IconInfoCircle,
  IconLock,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";

interface IdeaForm {
  name: string;
  description: string;
  target_user: string;
  core_features: string;
  pricing_model: string;
}

interface ValidationFormProps {
  ideaForm: IdeaForm;
  onInputChange: (field: string, value: string) => void;
  onValidate: () => void;
  isValidating: boolean;
  canValidateIdea: boolean;
  getCurrentPlan: () => any;
  getRemainingValidations: () => number;
}

export function ValidationForm({
  ideaForm,
  onInputChange,
  onValidate,
  isValidating,
  canValidateIdea,
  getCurrentPlan,
  getRemainingValidations,
}: ValidationFormProps) {
  const isDisabled = 
    isValidating ||
    !ideaForm.name.trim() ||
    !ideaForm.description.trim() ||
    !canValidateIdea;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
      <div className="space-y-6">
        {/* Idea Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <IconBulb size={16} className="text-green-500" />
            Idea Name *
          </label>
          <input
            type="text"
            placeholder="e.g., Project Management for Remote Teams"
            value={ideaForm.name}
            onChange={(e) => onInputChange("name", e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <IconInfoCircle size={16} className="text-green-500" />
            Description & Value Proposition *
          </label>
          <textarea
            placeholder="Describe what your SaaS does and what problem it solves..."
            value={ideaForm.description}
            onChange={(e) => onInputChange("description", e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all resize-none"
          />
        </div>

        {/* Target User */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <IconUser size={16} className="text-green-500" />
            Target User
          </label>
          <input
            type="text"
            placeholder="e.g., Small business owners, Freelancers, Marketing teams"
            value={ideaForm.target_user}
            onChange={(e) => onInputChange("target_user", e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Core Features */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <IconSettings size={16} className="text-green-500" />
            Core Features
          </label>
          <textarea
            placeholder="List the main features (one per line or comma-separated)"
            value={ideaForm.core_features}
            onChange={(e) => onInputChange("core_features", e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all resize-none"
          />
        </div>

        {/* Pricing Model */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <IconCurrencyDollar size={16} className="text-green-500" />
            Pricing Model
          </label>
          <input
            type="text"
            placeholder="e.g., $29/month per user, Freemium, One-time purchase"
            value={ideaForm.pricing_model}
            onChange={(e) => onInputChange("pricing_model", e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Usage Indicator */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <IconChartBar size={16} className="text-green-500" />
              <span className="text-sm font-semibold text-gray-900">Validation Credits</span>
            </div>
            <span className={`text-sm font-semibold ${
              getRemainingValidations() === -1
                ? "text-green-500"
                : getRemainingValidations() <= 5
                ? "text-red-500"
                : "text-green-500"
            }`}>
              {getRemainingValidations() === -1
                ? "Unlimited"
                : `${getRemainingValidations()} remaining`}
            </span>
          </div>
          {getCurrentPlan() && (
            <p className="text-xs text-gray-600">
              {getCurrentPlan()?.display_name} plan
              {getRemainingValidations() <= 5 && getRemainingValidations() > 0 && (
                <span className="text-orange-500 ml-1">• Running low on credits</span>
              )}
            </p>
          )}
        </div>

        {/* Validate Button */}
        <button
          onClick={onValidate}
          disabled={isDisabled}
          className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-lg font-semibold transition-all ${
            isDisabled
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          } text-white`}
        >
          {isValidating ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : isDisabled ? (
            <IconLock size={20} />
          ) : (
            <IconBolt size={20} />
          )}
          {isValidating
            ? "Analyzing Against Market Data..."
            : !canValidateIdea
            ? "Upgrade Plan to Continue"
            : (!ideaForm.name.trim() || !ideaForm.description.trim())
            ? "Fill Required Fields"
            : "Validate My Idea"}
        </button>
      </div>
    </div>
  );
}