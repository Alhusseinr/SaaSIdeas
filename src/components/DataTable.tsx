"use client";

import { useState, useMemo } from "react";
import { SaasIdeaItem } from "@/lib/supabase";

interface DataTableProps {
  items: SaasIdeaItem[];
}

export default function DataTable({ items }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof SaasIdeaItem>("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<SaasIdeaItem | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleSort = (field: keyof SaasIdeaItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.one_liner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.target_user?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [items, sortField, sortDirection, searchTerm]);

  const SortIcon = ({ field }: { field: keyof SaasIdeaItem }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return (
      <span className="text-blue-600">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800";
    if (score >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const generateImplementationPrompt = (item: SaasIdeaItem) => {
    return `I want you to help me build this SaaS idea. Here are the details:

**Project Name:** ${item.name}

**Value Proposition:** ${item.one_liner || "Not specified"}

**Target User:** ${item.target_user || "Not specified"}

**Core Features:**
${
  item.core_features && item.core_features.length > 0
    ? item.core_features.map((feature) => `- ${feature}`).join("\n")
    : "- Not specified"
}

**Market Opportunity:** ${item.why_now || "Not specified"}

**Pricing Strategy:** ${item.pricing_hint || "Not specified"}

**Business Rationale:** ${item.rationale || "Not specified"}

**Validation Score:** ${item.score}/100

Please help me build this SaaS application by providing:

1. **Technical Architecture:** Recommend the best tech stack, database design, and system architecture for this specific use case
2. **MVP Features:** Break down the core features into a prioritized roadmap for an MVP
3. **Implementation Plan:** Step-by-step development plan with realistic timelines
4. **Database Schema:** Design the core database tables and relationships needed
5. **User Experience:** Outline the key user flows and interface requirements
6. **Business Strategy:** Go-to-market approach, pricing model details, and customer acquisition strategy
7. **Technical Challenges:** Identify potential technical hurdles and solutions
8. **Scalability Considerations:** How to build this to handle growth

Focus on being specific and actionable. I want to start building this as soon as possible with a clear roadmap to launch.`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      alert("Implementation prompt copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert("Failed to copy to clipboard");
    }
  };

  return (
    <>
      <div className="p-6">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search ideas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("score")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Score</span>
                    <SortIcon field="score" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  One Liner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target User
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("created_at")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Created</span>
                    <SortIcon field="created_at" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreColor(
                        item.score
                      )}`}
                    >
                      {item.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {item.one_liner || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.target_user || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedItems.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              No items found matching your search.
            </div>
          </div>
        )}
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 backdrop-blur-md flex items-start justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="relative top-8 mx-auto p-6 w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto scrollbar-hide animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {selectedItem.name}
                    </h3>
                    <p className="text-white/70 text-sm">SaaS Idea Analysis</p>
                  </div>
                  <button
                    className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    onClick={() => setSelectedItem(null)}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Analytics Dashboard */}
              <div className="p-6">
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center mb-6">
                    <svg
                      className="w-6 h-6 mr-3 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <h4 className="text-lg font-semibold text-gray-900">
                      Analytics Overview
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Validation Score
                        </span>
                        <svg
                          className="w-4 h-4 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedItem.score}
                      </div>
                      <div className="text-xs text-gray-500">out of 100</div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Source Posts
                        </span>
                        <svg
                          className="w-4 h-4 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedItem.representative_post_ids?.length || 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        complaints analyzed
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Core Features
                        </span>
                        <svg
                          className="w-4 h-4 text-purple-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedItem.core_features?.length || 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        identified features
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Analysis Run
                        </span>
                        <svg
                          className="w-4 h-4 text-orange-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        #{selectedItem.run_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        session identifier
                      </div>
                    </div>
                  </div>

                  {/* Additional Analytics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {selectedItem.one_liner && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
                        <div className="flex items-center mb-3">
                          <svg
                            className="w-4 h-4 text-indigo-500 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Value Proposition
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 leading-relaxed">
                          {selectedItem.one_liner}
                        </div>
                      </div>
                    )}

                    {selectedItem.target_user && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
                        <div className="flex items-center mb-3">
                          <svg
                            className="w-4 h-4 text-emerald-500 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Target User
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 leading-relaxed">
                          {selectedItem.target_user}
                        </div>
                      </div>
                    )}

                    {selectedItem.pricing_hint && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
                        <div className="flex items-center mb-3">
                          <svg
                            className="w-4 h-4 text-green-500 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                            />
                          </svg>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Pricing Strategy
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 leading-relaxed">
                          {selectedItem.pricing_hint}
                        </div>
                      </div>
                    )}

                    {selectedItem.why_now && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
                        <div className="flex items-center mb-3">
                          <svg
                            className="w-4 h-4 text-amber-500 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Market Timing
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 leading-relaxed">
                          {selectedItem.why_now}
                        </div>
                      </div>
                    )}

                    {selectedItem.core_features &&
                      selectedItem.core_features.length > 0 && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
                          <div className="flex items-center mb-3">
                            <svg
                              className="w-4 h-4 text-purple-500 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Core Features
                            </span>
                          </div>
                            {selectedItem.core_features.map(
                              (feature, index) => (
                                <ul>
                                  <li key={index} className="text-sm text-gray-900 flex items-start">
                                    <span className="text-purple-500 mr-2 mt-1 text-xs">▶</span>
                                    {feature}
                                  </li>
                                </ul>
                              )
                            )}
                        </div>
                      )}

                    {selectedItem.rationale && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
                        <div className="flex items-center mb-3">
                          <svg
                            className="w-4 h-4 text-blue-500 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                          </svg>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            AI Analysis & Rationale
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 leading-relaxed">
                          {selectedItem.rationale}
                        </div>
                      </div>
                    )}

                    {selectedItem.representative_post_ids &&
                      selectedItem.representative_post_ids.length > 0 && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm md:col-span-2 lg:col-span-3">
                          <div className="flex items-center mb-3">
                            <svg
                              className="w-4 h-4 text-gray-600 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                              />
                            </svg>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Source Posts (
                              {selectedItem.representative_post_ids.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedItem.representative_post_ids.map(
                              (id, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300"
                                >
                                  #{id}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Build This Idea Section */}
              <div className="p-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                        <svg
                          className="w-5 h-5 mr-2 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        Ready to Build This?
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Get a comprehensive implementation plan from AI
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowPrompt(!showPrompt)}
                      className="inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-lg text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {showPrompt ? "Hide" : "Show"} Implementation Prompt
                    </button>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          generateImplementationPrompt(selectedItem)
                        )
                      }
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy Implementation Prompt
                    </button>
                  </div>
                </div>

                {showPrompt && (
                  <div className="mt-4 bg-white rounded-xl p-6 border border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900">
                          Implementation Prompt for AI Assistant
                        </h5>
                        <p className="text-xs text-gray-600">
                          Copy and paste this into Claude, ChatGPT, or any AI
                          assistant
                        </p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-4 rounded-lg border max-h-80 overflow-y-auto font-mono">
                        {generateImplementationPrompt(selectedItem)}
                      </pre>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start">
                        <svg
                          className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div>
                          <p className="text-xs font-medium text-blue-900 mb-1">
                            How to use this prompt:
                          </p>
                          <p className="text-xs text-blue-800 leading-relaxed">
                            Copy this entire prompt and paste it into Claude,
                            ChatGPT, or any AI assistant to get a comprehensive
                            implementation plan, technical architecture, and
                            step-by-step guide for building this SaaS idea.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
