"use client";

import { useState, useMemo } from "react";
import {
  IconChevronUp,
  IconChevronDown,
  IconExternalLink,
  IconEye,
  IconTarget,
  IconClock,
  IconTrendingUp,
  IconCode,
  IconX,
  IconChartBar,
  IconBulb,
  IconUsers,
  IconCurrencyDollar,
} from "@tabler/icons-react";
import { SaasIdeaItem } from "@/lib/supabase";

interface DataTableProps {
  items: SaasIdeaItem[];
  onItemSelect?: (item: SaasIdeaItem | null) => void;
  selectedItem?: SaasIdeaItem | null;
}

export default function DataTable({
  items,
  onItemSelect,
  selectedItem,
}: DataTableProps) {
  const [sortField, setSortField] = useState<keyof SaasIdeaItem>("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedItemModal, setSelectedItemModal] = useState<SaasIdeaItem | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'score'>('details');

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
    return sorted;
  }, [items, sortField, sortDirection]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);

  const handleSort = (field: keyof SaasIdeaItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    if (score >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getDifficultyColor = (months: number) => {
    if (months <= 3) return 'bg-green-100 text-green-800';
    if (months <= 6) return 'bg-yellow-100 text-yellow-800';
    if (months <= 12) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const SortableHeader = ({ field, children }: { field: keyof SaasIdeaItem; children: React.ReactNode }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Market Intelligence Database</h3>
            <p className="text-sm text-gray-500">
              {sortedItems.length} opportunities • Page {currentPage} of {totalPages}
            </p>
          </div>
          
          {/* Items per page selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="score">Score</SortableHeader>
              <SortableHeader field="name">Opportunity</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market Evidence
              </th>
              <SortableHeader field="development_timeline_months">Build Time</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                {/* Score */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(item.score)}`}>
                      {item.score}
                    </span>
                  </div>
                </td>

                {/* Opportunity Name & Description */}
                <td className="px-6 py-4">
                  <div className="max-w-sm">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </div>
                    {item.one_liner && (
                      <div className="text-sm text-gray-500 truncate mt-1">
                        {item.one_liner}
                      </div>
                    )}
                  </div>
                </td>

                {/* Market Evidence */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <IconUsers size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {item.representative_post_ids?.length || 0} posts
                    </span>
                  </div>
                </td>

                {/* Build Time */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${getDifficultyColor(item.development_timeline_months || 6)}`}>
                    {item.development_timeline_months || 6}mo
                  </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedItemModal(item)}
                      className="text-green-600 hover:text-green-900 transition-colors"
                      title="View Details"
                    >
                      <IconEye size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItemModal(item);
                        setActiveTab('score');
                      }}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                      title="Score Breakdown"
                    >
                      <IconChartBar size={16} />
                    </button>
                    {item.representative_post_ids && item.representative_post_ids.length > 0 && (
                      <button
                        onClick={() => window.open(`https://reddit.com/r/all/comments/${item.representative_post_ids?.[0]}`, '_blank')}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                        title="View Source Post"
                      >
                        <IconExternalLink size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedItems.length)} of {sortedItems.length} results
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            
            <span className="px-3 py-1 text-sm bg-green-600 text-white rounded-md">
              {currentPage}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Unified Modal */}
      {selectedItemModal && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedItemModal.name}</h3>
                <p className="text-sm text-gray-500 mt-1">Market Intelligence Analysis</p>
              </div>
              <button
                onClick={() => {
                  setSelectedItemModal(null);
                  setActiveTab('details');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <IconX size={24} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'details'
                    ? 'border-b-2 border-green-500 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('score')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'score'
                    ? 'border-b-2 border-green-500 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Score Breakdown
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {activeTab === 'details' && (
                <>
                  {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconTarget className="text-green-600" size={20} />
                    <span className="font-medium text-gray-900">Opportunity Score</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-lg font-bold ${getScoreColor(selectedItemModal.score)}`}>
                    {selectedItemModal.score}/100
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconClock className="text-blue-600" size={20} />
                    <span className="font-medium text-gray-900">Build Time</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {selectedItemModal.development_timeline_months || 6} months
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IconUsers className="text-purple-600" size={20} />
                    <span className="font-medium text-gray-900">Market Evidence</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {selectedItemModal.representative_post_ids?.length || 0} posts
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedItemModal.one_liner && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-700">{selectedItemModal.one_liner}</p>
                </div>
              )}

              {/* Core Features */}
              {selectedItemModal.core_features && selectedItemModal.core_features.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Core Features</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItemModal.core_features.map((feature, index) => (
                      <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Skills */}
              {selectedItemModal.required_skills && selectedItemModal.required_skills.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItemModal.required_skills.map((skill, index) => (
                      <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Market Size */}
              {selectedItemModal.market_size_estimate && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Market Size Estimate</h4>
                  <p className="text-gray-700">{selectedItemModal.market_size_estimate}</p>
                </div>
              )}

              {/* Competitive Landscape */}
              {selectedItemModal.competitive_landscape && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Competitive Landscape</h4>
                  <div className="space-y-3 text-gray-700">
                    <div>
                      <strong>Market Gap Score:</strong> {selectedItemModal.competitive_landscape.market_gap_score}/100
                    </div>
                    <div>
                      <strong>Competitive Advantage:</strong> {selectedItemModal.competitive_landscape.competitive_advantage}
                    </div>
                    {selectedItemModal.competitive_landscape.direct_competitors.length > 0 && (
                      <div>
                        <strong>Direct Competitors:</strong> {selectedItemModal.competitive_landscape.direct_competitors.join(", ")}
                      </div>
                    )}
                    {selectedItemModal.competitive_landscape.indirect_competitors.length > 0 && (
                      <div>
                        <strong>Indirect Competitors:</strong> {selectedItemModal.competitive_landscape.indirect_competitors.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ready to Build This Section */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-600 rounded-full p-2">
                    <IconBulb className="text-white" size={20} />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Ready to Build This?</h4>
                    <p className="text-sm text-gray-600">Get a comprehensive implementation plan from AI</p>
                  </div>
                </div>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <IconCode size={16} />
                  Generate Implementation Plan
                </button>
              </div>
                </>
              )}

              {activeTab === 'score' && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <div className={`inline-block px-4 py-2 rounded-full text-2xl font-bold ${getScoreColor(selectedItemModal.score)}`}>
                      {selectedItemModal.score}/100
                    </div>
                    <p className="text-gray-600 mt-2">Overall Opportunity Score</p>
                  </div>

                  {/* Score Components */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-900">Market Pain Evidence (30%)</span>
                        <span className="text-sm text-gray-600">25/30</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '83%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-900">Market Size & Demand (25%)</span>
                        <span className="text-sm text-gray-600">20/25</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-900">Competition Analysis (20%)</span>
                        <span className="text-sm text-gray-600">15/20</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-900">Solution Fit (15%)</span>
                        <span className="text-sm text-gray-600">12/15</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-900">Execution Feasibility (10%)</span>
                        <span className="text-sm text-gray-600">8/10</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-orange-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedItemModal(null);
                  setActiveTab('details');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}