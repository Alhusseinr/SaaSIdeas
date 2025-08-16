"use client";

import { useState, useMemo, useEffect } from "react";
import { SaasIdeaItem } from "@/lib/supabase";
import { generateEnhancedAnalysis } from "@/lib/enhancedAnalysis";
import EnhancedAnalysis from "./EnhancedAnalysis";
import ScoreBreakdown from "./ScoreBreakdown";

interface DataTableProps {
  items: SaasIdeaItem[];
}

export default function DataTable({ items }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof SaasIdeaItem>("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<SaasIdeaItem | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
  const [enhancedItem, setEnhancedItem] = useState<SaasIdeaItem | null>(null);
  const [scoreBreakdownItem, setScoreBreakdownItem] = useState<SaasIdeaItem | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Generate enhanced analysis when an item is selected
  useEffect(() => {
    if (selectedItem && !selectedItem.competitive_landscape) {
      const enhanced = generateEnhancedAnalysis(selectedItem);
      setEnhancedItem({ ...selectedItem, ...enhanced });
    } else {
      setEnhancedItem(selectedItem);
    }
  }, [selectedItem]);

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
    if (score >= 80) return "bg-gradient-to-br from-green-100 to-green-200 text-green-800 border border-green-300";
    if (score >= 60) return "bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300";
    if (score >= 40) return "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-300";
    return "bg-gradient-to-br from-red-100 to-red-200 text-red-800 border border-red-300";
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
        {/* Enhanced Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search ideas by name, description, or target user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Responsive Data Display */}
        <div className="space-y-4">
          {/* Desktop Table Header - Hidden on Mobile */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-12 gap-4 items-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <div 
                  className="col-span-1 cursor-pointer hover:text-gray-800 transition-colors"
                  onClick={() => handleSort("score")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Score</span>
                    <SortIcon field="score" />
                  </div>
                </div>
                <div 
                  className="col-span-3 cursor-pointer hover:text-gray-800 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Idea Name</span>
                    <SortIcon field="name" />
                  </div>
                </div>
                <div className="col-span-4 lg:block">Value Proposition</div>
                <div className="col-span-2">Target User</div>
                <div 
                  className="col-span-1 cursor-pointer hover:text-gray-800 transition-colors"
                  onClick={() => handleSort("created_at")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    <SortIcon field="created_at" />
                  </div>
                </div>
                <div className="col-span-1">Actions</div>
              </div>
            </div>

            {/* Desktop Table Body */}
            <div className="divide-y divide-gray-100">
              {filteredAndSortedItems.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  {/* Score */}
                  <div className="col-span-1">
                    <button
                      onClick={() => setScoreBreakdownItem(item)}
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 cursor-pointer ${getScoreColor(item.score)}`}
                      title="Click to see score breakdown"
                    >
                      {item.score}
                    </button>
                  </div>

                  {/* Idea Name */}
                  <div className="col-span-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            #{item.run_id}
                          </span>
                          {item.core_features && item.core_features.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {item.core_features.length} features
                            </span>
                          )}
                          {item.representative_post_ids && item.representative_post_ids.length > 1 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {item.representative_post_ids.length} posts
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Value Proposition */}
                  <div className="col-span-4">
                    <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                      {item.one_liner || (
                        <span className="text-gray-400 italic">No description available</span>
                      )}
                    </p>
                  </div>

                  {/* Target User */}
                  <div className="col-span-2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm text-gray-600 truncate">
                        {item.target_user || "Not specified"}
                      </span>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="col-span-1">
                    <div className="text-xs text-gray-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })
                        : "-"}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 transition-all duration-200 group"
                      title="View Details"
                    >
                      <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {/* Mobile Sort Options */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSort("score")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      sortField === "score" 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Score {sortField === "score" && (sortDirection === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    onClick={() => handleSort("name")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      sortField === "name" 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    onClick={() => handleSort("created_at")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      sortField === "created_at" 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Date {sortField === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Cards */}
            {filteredAndSortedItems.map((item) => (
              <div 
                key={item.id}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-900 truncate leading-tight">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                        #{item.run_id}
                      </span>
                      {item.core_features && item.core_features.length > 0 && (
                        <span className="text-xs text-gray-500 truncate">
                          {item.core_features.length} features
                        </span>
                      )}
                      {item.representative_post_ids && item.representative_post_ids.length > 1 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {item.representative_post_ids.length} posts
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setScoreBreakdownItem(item)}
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 cursor-pointer ${getScoreColor(item.score)} flex-shrink-0`}
                    title="Click to see score breakdown"
                  >
                    {item.score}
                  </button>
                </div>

                {/* Card Content */}
                <div className="space-y-2 min-w-0">
                  {item.one_liner && (
                    <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                      {item.one_liner}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="truncate">
                        {item.target_user || "Not specified"}
                      </span>
                    </div>
                    <span className="flex-shrink-0">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })
                        : "-"}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="w-full inline-flex items-center justify-center px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-blue-700 text-sm font-medium rounded-lg border border-blue-200 transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="truncate">View Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Empty State */}
        {filteredAndSortedItems.length === 0 && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm ? 'No matching ideas found' : 'No SaaS ideas yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm 
                  ? `Try adjusting your search terms or clear the search to see all ideas.`
                  : 'Start by running the data pipeline to discover new SaaS opportunities.'
                }
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Search
                </button>
              )}
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
            className="relative top-2 sm:top-8 mx-auto p-2 sm:p-4 w-full sm:w-11/12 max-w-4xl max-h-[96vh] sm:max-h-[90vh] overflow-y-auto scrollbar-hide animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-6 py-4 sm:py-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-1 leading-tight">
                      {selectedItem.name}
                    </h3>
                    <div className="flex items-center space-x-3">
                      <p className="text-white/70 text-sm">SaaS Idea Analysis</p>
                      <div className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-bold ${getScoreColor(selectedItem.score)}`}>
                        {selectedItem.score}
                      </div>
                    </div>
                  </div>
                  <button
                    className="text-white/80 hover:text-white transition-colors p-1 sm:p-2 hover:bg-white/10 rounded-lg flex-shrink-0"
                    onClick={() => setSelectedItem(null)}
                  >
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
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

              {/* Enhanced Analysis */}
              {enhancedItem && (
                <div className="p-3 sm:p-6">
                  <EnhancedAnalysis 
                    idea={enhancedItem}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                  />
                </div>
              )}

              {/* Simplified Mobile-Friendly Content */}
              <div className="p-3 sm:p-6 space-y-4">
                {/* Key Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-3 text-center border border-blue-200">
                    <div className="text-lg sm:text-xl font-bold text-blue-900">
                      {selectedItem.representative_post_ids?.length || 0}
                    </div>
                    <div className="text-xs text-blue-700">Source Posts</div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-3 text-center border border-purple-200">
                    <div className="text-lg sm:text-xl font-bold text-purple-900">
                      {selectedItem.core_features?.length || 0}
                    </div>
                    <div className="text-xs text-purple-700">Features</div>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-3 text-center border border-green-200">
                    <div className="text-lg sm:text-xl font-bold text-green-900">
                      #{selectedItem.run_id}
                    </div>
                    <div className="text-xs text-green-700">Run ID</div>
                  </div>
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3 text-center border border-orange-200">
                    <div className="text-lg sm:text-xl font-bold text-orange-900">
                      {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                    </div>
                    <div className="text-xs text-orange-700">Created</div>
                  </div>
                </div>

                {/* Collapsible Sections */}
                {selectedItem.one_liner && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleSection('description')}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-gray-900">Value Proposition</span>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.description ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.description && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {selectedItem.one_liner}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.target_user && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleSection('target')}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium text-gray-900">Target User</span>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.target ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.target && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {selectedItem.target_user}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.core_features && selectedItem.core_features.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleSection('features')}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-gray-900">Core Features ({selectedItem.core_features.length})</span>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.features ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.features && (
                      <div className="px-4 pb-4">
                        <ul className="space-y-2">
                          {selectedItem.core_features.map((feature, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-start">
                              <span className="text-purple-500 mr-2 mt-1 text-xs">▶</span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}


                {selectedItem.why_now && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleSection('timing')}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-gray-900">Why Now?</span>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.timing ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.timing && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {selectedItem.why_now}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.rationale && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleSection('analysis')}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="font-medium text-gray-900">AI Analysis</span>
                      </div>
                      <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.analysis ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedSections.analysis && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {selectedItem.rationale}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Build This Idea Section */}
              <div className="p-3 sm:p-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 sm:p-6 border border-blue-200">
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
                  <div className="flex flex-col sm:flex-row gap-3">
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
                  <div className="mt-4 bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
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

      {/* Score Breakdown Modal */}
      {scoreBreakdownItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-sm font-bold mr-3 ${getScoreColor(scoreBreakdownItem.score)}`}>
                  {scoreBreakdownItem.score}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{scoreBreakdownItem.name}</h3>
                  <p className="text-sm text-gray-600">Score breakdown and calculation details</p>
                </div>
              </div>
              <button
                onClick={() => setScoreBreakdownItem(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <ScoreBreakdown idea={scoreBreakdownItem} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}