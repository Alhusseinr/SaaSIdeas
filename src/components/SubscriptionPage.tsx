"use client";

import { useState } from "react";
import {
  IconCreditCard,
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconSettings,
  IconTrendingUp,
  IconFileText,
  IconClock,
  IconExclamationCircle,
} from "@tabler/icons-react";
import { usePricingActions } from "@/contexts/PricingContext";
import { formatPrice, isUnlimitedPlan } from "@/types/pricing";

export default function SubscriptionPage() {
  const {
    currentSubscription,
    getCurrentPlan,
    getUsageForType,
    getRemainingValidations,
    getUsagePercentage,
    isOnTrial,
    hasActiveSubscription,
    getTrialDaysRemaining,
    isLoading,
  } = usePricingActions();

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const [showUsageDetails, setShowUsageDetails] = useState(true);
  const [isManaging, setIsManaging] = useState(false);

  const handleManageSubscription = async () => {
    setIsManaging(true);

    try {
      // Create Stripe customer portal session
      const response = await fetch("/api/customer-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { url, error } = await response.json();

      if (error) {
        throw new Error(error);
      }

      // Redirect to Stripe customer portal
      window.location.href = url;
    } catch (error) {
      console.error("Customer portal error:", error);
      alert("Unable to open subscription management. Please try again.");
    } finally {
      setIsManaging(false);
    }
  };

  const handleUpgradePlan = () => {
    // Redirect to landing page pricing section
    window.location.href = "/#pricing";
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-6"
            >
              <div className="space-y-4">
                <div className="h-5 bg-gray-200 rounded animate-pulse w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentPlan = getCurrentPlan();
  const usedValidations = getUsageForType("idea_validation");
  const remainingValidations = getRemainingValidations();
  const usagePercentage = getUsagePercentage();
  const trialDaysRemaining = getTrialDaysRemaining();

  const getUsageBarColor = () => {
    if (usagePercentage >= 90) return "#EF4444";
    if (usagePercentage >= 75) return "#F59E0B";
    return "#10B981";
  };

  const getStatusBadgeColor = () => {
    if (isOnTrial()) return "#10B981";
    if (currentSubscription?.status === "active") return "#10B981";
    if (currentSubscription?.status === "past_due") return "#EF4444";
    return "#6B7280";
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="space-y-6">
        {/* Current Subscription Status */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div
            className="border-b border-gray-200 p-6"
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-md flex items-center justify-center">
                  <IconCreditCard size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Current Subscription
                  </h3>
                  <p className="text-white/80 text-sm">
                    Your plan and usage overview
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUsageDetails(!showUsageDetails)}
                className="px-4 py-2 bg-white/20 text-white border border-white/30 rounded-md hover:bg-white/30 transition-colors flex items-center gap-2 text-sm"
              >
                {showUsageDetails ? (
                  <IconEyeOff size={16} />
                ) : (
                  <IconEye size={16} />
                )}
                {showUsageDetails ? "Hide Details" : "View Details"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {!hasActiveSubscription() ? (
              <div className="bg-orange-50 border border-orange-200 rounded-xl text-center p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                    <IconAlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    No Active Subscription
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Subscribe to start validating your SaaS ideas
                  </p>
                  <button
                    onClick={handleUpgradePlan}
                    className="px-6 py-3 text-lg rounded-lg text-white border-none hover:opacity-90 transition-opacity"
                    style={{
                      background:
                        "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    }}
                  >
                    View Pricing Plans
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Plan Info */}
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {currentPlan?.display_name}
                      </h2>
                      <span
                        className="px-3 py-1 rounded-full text-sm font-medium text-white"
                        style={{
                          backgroundColor: getStatusBadgeColor(),
                        }}
                      >
                        {isOnTrial()
                          ? `Trial (${trialDaysRemaining} days left)`
                          : currentSubscription?.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">
                      {currentPlan?.description}
                    </p>
                    {currentSubscription && (
                      <p className="text-sm text-gray-500">
                        {formatPrice(
                          currentSubscription.billing_cycle === "yearly"
                            ? currentPlan?.price_yearly || 0
                            : currentPlan?.price_monthly || 0
                        )}
                        /{" "}
                        {currentSubscription.billing_cycle === "yearly"
                          ? "year"
                          : "month"}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">
                      {isUnlimitedPlan(currentPlan?.validations_per_month || 0)
                        ? "∞"
                        : remainingValidations}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isUnlimitedPlan(currentPlan?.validations_per_month || 0)
                        ? "Unlimited"
                        : "remaining"}
                    </p>
                  </div>
                </div>

                {/* Usage Progress */}
                {!isUnlimitedPlan(currentPlan?.validations_per_month || 0) && (
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-900">
                        Idea Validations This Month
                      </p>
                      <p className="text-sm text-gray-600">
                        {usedValidations} / {currentPlan?.validations_per_month}
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-md h-3">
                      <div
                        className="h-3 rounded-md transition-all duration-300"
                        style={{
                          width: `${Math.min(100, usagePercentage)}%`,
                          backgroundColor: getUsageBarColor(),
                        }}
                      />
                    </div>
                    {usagePercentage >= 80 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-md p-4 flex items-start gap-3">
                        <IconExclamationCircle size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-orange-700">
                          You're approaching your monthly limit. Consider
                          upgrading your plan.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Trial Warning */}
                {isOnTrial() && trialDaysRemaining <= 3 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-8">
                    <div className="flex items-start gap-3">
                      <IconClock size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-gray-900 font-medium mb-1">
                          Your trial expires in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}
                        </h4>
                        <p className="text-sm text-yellow-700">
                          Choose a plan below to continue using IdeaValidator without
                          interruption.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 mb-8 flex-wrap">
                  <button
                    onClick={handleManageSubscription}
                    disabled={isManaging}
                    className="px-4 py-2 rounded-md text-white border-none flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{
                      background:
                        "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    }}
                  >
                    {isManaging ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <IconSettings size={16} />
                    )}
                    {isManaging ? "Opening..." : "Manage Subscription"}
                  </button>
                  {currentPlan?.name !== "enterprise" && (
                    <button
                      onClick={handleUpgradePlan}
                      className="px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <IconTrendingUp size={16} />
                      Upgrade Plan
                    </button>
                  )}
                  <button className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <IconFileText size={16} />
                    Download Invoice
                  </button>
                </div>

                {/* Detailed Usage (Expandable) */}
                {showUsageDetails && (
                  <>
                    <div className="border-t border-gray-200 mb-8 pt-8">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">
                        Usage Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">API Calls</p>
                            <p className="text-lg font-bold text-gray-900">
                              {getUsageForType("api_call") || 0}
                            </p>
                          </div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">Exports</p>
                            <p className="text-lg font-bold text-gray-900">
                              {getUsageForType("export") || 0}
                            </p>
                          </div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-600">Team Members</p>
                            <p className="text-lg font-bold text-gray-900">
                              {getUsageForType("team_member") || 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      {currentSubscription && (
                        <div className="space-y-1 mt-4">
                          <p className="text-xs text-gray-500">
                            Billing cycle:{" "}
                            {formatDate(currentSubscription.current_period_start)} to{" "}
                            {formatDate(currentSubscription.current_period_end)}
                          </p>
                          {currentSubscription.cancel_at_period_end && (
                            <div className="flex items-center gap-2">
                              <IconExclamationCircle size={14} className="text-red-500" />
                              <p className="text-xs text-red-500">
                                Subscription will cancel at the end of this period
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}