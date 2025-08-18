"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  Text,
  Badge,
  Group,
  ActionIcon,
  Card,
  Stack,
  Title,
  Button,
  Modal,
  ScrollArea,
  List,
  Divider,
  ThemeIcon,
  Grid,
  Tooltip,
  TextInput,
  Select,
} from "@mantine/core";
import {
  IconChevronUp,
  IconChevronDown,
  IconExternalLink,
  IconEye,
  IconTarget,
  IconClock,
  IconTrendingUp,
  IconCode,
} from "@tabler/icons-react";
import { SaasIdeaItem } from "@/lib/supabase";
import { generateEnhancedAnalysis } from "@/lib/enhancedAnalysis";
import EnhancedAnalysis from "./EnhancedAnalysis";
import ScoreBreakdown from "./ScoreBreakdown";

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
  const [localSelectedItem, setLocalSelectedItem] =
    useState<SaasIdeaItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [enhancedItem, setEnhancedItem] = useState<SaasIdeaItem | null>(null);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [pageSize, setPageSize] = useState("20");
  const [currentPage, setCurrentPage] = useState(1);

  const currentItem = selectedItem || localSelectedItem;

  // Generate enhanced analysis when an item is selected
  useEffect(() => {
    if (currentItem && !currentItem.competitive_landscape) {
      const enhanced = generateEnhancedAnalysis(currentItem);
      setEnhancedItem({ ...currentItem, ...enhanced });
    } else {
      setEnhancedItem(currentItem);
    }
  }, [currentItem]);

  const handleItemSelect = (item: SaasIdeaItem) => {
    if (onItemSelect) {
      onItemSelect(item);
    } else {
      setLocalSelectedItem(item);
    }
    setShowDetails(true);
  };

  const handleSort = (field: keyof SaasIdeaItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "green";
    if (score >= 60) return "yellow";
    if (score >= 40) return "orange";
    return "red";
  };

  const getDifficultyBadgeColor = (months: number | null) => {
    if (!months) return "gray";
    if (months <= 3) return "green";
    if (months <= 6) return "yellow";
    if (months <= 12) return "orange";
    return "red";
  };

  const getDifficultyLabel = (months: number | null) => {
    if (!months) return "Unknown";
    if (months <= 3) return "Quick Build";
    if (months <= 6) return "Moderate";
    if (months <= 12) return "Complex";
    return "Enterprise";
  };

  const getComplexityLabel = (months: number) => {
    if (months <= 3) return "Simple";
    if (months <= 6) return "Moderate";
    if (months <= 12) return "Complex";
    return "Enterprise";
  };

  const getComplexityColor = (months: number) => {
    if (months <= 3) return "green";
    if (months <= 6) return "yellow";
    if (months <= 12) return "orange";
    return "red";
  };

  const getTechFeasibilityColor = (score: number) => {
    if (score >= 80) return "green";
    if (score >= 60) return "yellow";
    if (score >= 40) return "orange";
    return "red";
  };

  const formatMarketSize = (size: number | null) => {
    if (!size) return "Unknown";
    if (size >= 1000000000) return `$${(size / 1000000000).toFixed(1)}B`;
    if (size >= 1000000) return `$${(size / 1000000).toFixed(1)}M`;
    if (size >= 1000) return `$${(size / 1000).toFixed(1)}K`;
    return `$${size}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items;

    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === "asc" ? -1 : 1;
      if (bValue == null) return sortDirection === "asc" ? 1 : -1;

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [items, sortField, sortDirection]);

  const paginatedItems = useMemo(() => {
    const size = parseInt(pageSize);
    const start = (currentPage - 1) * size;
    return filteredAndSortedItems.slice(start, start + size);
  }, [filteredAndSortedItems, currentPage, pageSize]);

  const totalPages = Math.ceil(
    filteredAndSortedItems.length / parseInt(pageSize)
  );

  const renderSortableHeader = (field: keyof SaasIdeaItem, label: string) => (
    <Table.Th>
      <Group
        gap="xs"
        style={{ cursor: "pointer" }}
        onClick={() => handleSort(field)}
      >
        <Text fw={600} size="sm" c="#F5F5F5">
          {label}
        </Text>
        {sortField === field && (
          <ActionIcon variant="transparent" size="xs">
            {sortDirection === "asc" ? (
              <IconChevronUp size={12} />
            ) : (
              <IconChevronDown size={12} />
            )}
          </ActionIcon>
        )}
      </Group>
    </Table.Th>
  );

  const renderDetailModal = () => (
    <Modal
      opened={showDetails}
      onClose={() => setShowDetails(false)}
      title={
        <Group>
          <ThemeIcon
            size="lg"
            radius="md"
            style={{ backgroundColor: "#006B3C", color: "#F5F5F5" }}
          >
            <IconTarget size={20} />
          </ThemeIcon>
          <div>
            <Title order={4} c="#F5F5F5">
              Market Opportunity Analysis
            </Title>
            <Text size="sm" c="#CCCCCC">
              Comprehensive Intelligence Report
            </Text>
          </div>
        </Group>
      }
      size="xl"
      radius="lg"
      styles={{
        content: { backgroundColor: "#1A1A1A" },
        header: {
          backgroundColor: "#1A1A1A",
          borderBottom: "1px solid #404040",
        },
        body: { backgroundColor: "#1A1A1A" },
        title: { color: "#F5F5F5" },
      }}
    >
      {enhancedItem && (
        <Stack gap="lg">
          <Grid>
            <Grid.Col span={8}>
              <Stack gap="sm">
                <Title order={3} c="#F5F5F5">
                  {enhancedItem.name}
                </Title>
                <Text size="lg" c="#CCCCCC">
                  {enhancedItem.one_liner}
                </Text>

                <Group>
                  <Badge
                    size="lg"
                    style={{
                      backgroundColor:
                        getScoreBadgeColor(enhancedItem.score) === "green"
                          ? "#006B3C"
                          : getScoreBadgeColor(enhancedItem.score) === "yellow"
                          ? "#C5A46D"
                          : getScoreBadgeColor(enhancedItem.score) === "orange"
                          ? "#FF8C00"
                          : "#FF6B6B",
                      color: "#F5F5F5",
                    }}
                    leftSection={<IconTrendingUp size={14} />}
                  >
                    Validation Score: {enhancedItem.score}
                  </Badge>

                  <Badge
                    size="lg"
                    style={{
                      backgroundColor:
                        getDifficultyBadgeColor(
                          enhancedItem.development_timeline_months
                        ) === "green"
                          ? "#006B3C"
                          : getDifficultyBadgeColor(
                              enhancedItem.development_timeline_months
                            ) === "yellow"
                          ? "#C5A46D"
                          : getDifficultyBadgeColor(
                              enhancedItem.development_timeline_months
                            ) === "orange"
                          ? "#FF8C00"
                          : getDifficultyBadgeColor(
                              enhancedItem.development_timeline_months
                            ) === "red"
                          ? "#FF6B6B"
                          : "#666666",
                      color: "#F5F5F5",
                    }}
                    leftSection={<IconClock size={14} />}
                  >
                    {getDifficultyLabel(
                      enhancedItem.development_timeline_months
                    )}
                  </Badge>
                </Group>
              </Stack>
            </Grid.Col>

            <Grid.Col span={4}>
              <Stack gap="xs">
                <Button
                  fullWidth
                  leftSection={<IconEye size={16} />}
                  onClick={() => setShowScoreBreakdown(true)}
                  style={{
                    background:
                      "linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)",
                    color: "#F5F5F5",
                    border: "none",
                  }}
                >
                  View Score Analysis
                </Button>

                {enhancedItem.representative_post_ids &&
                  enhancedItem.representative_post_ids.length > 0 && (
                    <Button
                      fullWidth
                      leftSection={<IconExternalLink size={16} />}
                      style={{
                        backgroundColor: "#2A2A2A",
                        color: "#E5E5E5",
                        borderColor: "#404040",
                      }}
                    >
                      View Source Posts (
                      {enhancedItem.representative_post_ids.length})
                    </Button>
                  )}
              </Stack>
            </Grid.Col>
          </Grid>

          <Divider style={{ borderColor: "#404040" }} />

          {enhancedItem.core_features &&
            enhancedItem.core_features.length > 0 && (
              <div>
                <Title order={5} mb="sm" c="#F5F5F5">
                  Core Features & Capabilities
                </Title>
                <List
                  spacing="sm"
                  icon={<IconCode size={16} color="#006B3C" />}
                >
                  {enhancedItem.core_features.map((feature, index) => (
                    <List.Item key={index}>
                      <Text size="sm" c="#E5E5E5">
                        {feature}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              </div>
            )}

          {enhancedItem.why_now && (
            <div>
              <Title order={5} mb="sm" c="#F5F5F5">
                Market Timing Analysis
              </Title>
              <Text size="sm" c="#CCCCCC">
                {enhancedItem.why_now}
              </Text>
            </div>
          )}

          {enhancedItem.pricing_hint && (
            <div>
              <Title order={5} mb="sm" c="#F5F5F5">
                Revenue Model Recommendations
              </Title>
              <Text size="sm" c="#CCCCCC">
                {enhancedItem.pricing_hint}
              </Text>
            </div>
          )}

          {enhancedItem && (
            <EnhancedAnalysis
              idea={enhancedItem}
              expandedSections={{}}
              toggleSection={() => {}}
            />
          )}
        </Stack>
      )}
    </Modal>
  );

  return (
    <Card
      radius="lg"
      withBorder
      style={{ backgroundColor: "#1A1A1A", borderColor: "#404040" }}
    >
      <Stack gap="md">
        {/* Header Controls */}
        <Group justify="space-between">
          <div>
            <Title order={3} c="#F5F5F5">
              Market Intelligence Database
            </Title>
            <Text size="sm" c="#CCCCCC">
              {filteredAndSortedItems.length} validated opportunities found
            </Text>
          </div>

          <Group>
            <Select
              value={pageSize}
              onChange={(value) => {
                setPageSize(value || "20");
                setCurrentPage(1);
              }}
              data={[
                { value: "10", label: "10 per page" },
                { value: "20", label: "20 per page" },
                { value: "50", label: "50 per page" },
                { value: "100", label: "100 per page" },
              ]}
              w={140}
              styles={{
                input: {
                  backgroundColor: "#2A2A2A",
                  borderColor: "#404040",
                  color: "#F5F5F5",
                },
                dropdown: {
                  backgroundColor: "#2A2A2A",
                  borderColor: "#404040",
                },
                option: { color: "#F5F5F5" },
              }}
            />
          </Group>
        </Group>

        {/* Data Table */}
        <ScrollArea>
          <Table
            striped
            highlightOnHover
            styles={{
              table: { backgroundColor: "#1A1A1A" },
              thead: { backgroundColor: "#2A2A2A" },
              th: {
                color: "#F5F5F5",
                borderColor: "#404040",
                padding: "12px 8px",
                fontSize: "14px",
                fontWeight: 600,
              },
              td: {
                color: "#E5E5E5",
                borderColor: "#404040",
                padding: "16px 8px",
                verticalAlign: "top",
              },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                {renderSortableHeader("name", "Opportunity")}
                {renderSortableHeader("score", "Validation Score")}
                {renderSortableHeader("representative_post_ids", "Number of Posts")}
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {paginatedItems.map((item) => (
                <Table.Tr key={item.id} style={{ cursor: "pointer" }}>
                  <Table.Td onClick={() => handleItemSelect(item)}>
                    <div style={{ maxWidth: "300px" }}>
                      <Text fw={600} size="md" lineClamp={1} c="#F5F5F5" mb={4}>
                        {item.name}
                      </Text>
                    </div>
                    <div style={{ maxWidth: "300px" }}>
                      <Text size="xs" c="#CCCCCC" lineClamp={2}>
                        {item.one_liner}
                      </Text>
                    </div>
                  </Table.Td>

                  <Table.Td onClick={() => handleItemSelect(item)}>
                    <Badge
                      size="lg"
                      radius="md"
                      style={{
                        backgroundColor:
                          getScoreBadgeColor(item.score) === "green"
                            ? "#006B3C"
                            : getScoreBadgeColor(item.score) === "yellow"
                            ? "#C5A46D"
                            : getScoreBadgeColor(item.score) === "orange"
                            ? "#FF8C00"
                            : "#FF6B6B",
                        color: "#F5F5F5",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {item.score}
                    </Badge>
                  </Table.Td>

                  <Table.Td onClick={() => handleItemSelect(item)}>
                    <Badge
                      size="lg"
                      radius="md"
                      style={{
                        backgroundColor:
                          getScoreBadgeColor(item.score) === "green"
                            ? "#006B3C"
                            : getScoreBadgeColor(item.score) === "yellow"
                            ? "#C5A46D"
                            : getScoreBadgeColor(item.score) === "orange"
                            ? "#FF8C00"
                            : "#FF6B6B",
                        color: "#F5F5F5",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {item.representative_post_ids?.length}
                    </Badge>
                  </Table.Td>

                  <Table.Td>
                    <Button
                    size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemSelect(item);
                      }}
                      title="View Details"
                    >View Details</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="center">
            <Button
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              style={{
                backgroundColor: "#2A2A2A",
                color: "#E5E5E5",
                borderColor: "#404040",
              }}
            >
              Previous
            </Button>

            <Text size="sm" c="#F5F5F5">
              Page {currentPage} of {totalPages}
            </Text>

            <Button
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              style={{
                backgroundColor: "#2A2A2A",
                color: "#E5E5E5",
                borderColor: "#404040",
              }}
            >
              Next
            </Button>
          </Group>
        )}
      </Stack>

      {/* Detail Modal */}
      {renderDetailModal()}

      {/* Score Breakdown Modal */}
      {currentItem && (
        <Modal
          opened={showScoreBreakdown}
          onClose={() => setShowScoreBreakdown(false)}
          title="Validation Score Breakdown"
          size="lg"
          styles={{
            content: { backgroundColor: "#1A1A1A" },
            header: {
              backgroundColor: "#1A1A1A",
              borderBottom: "1px solid #404040",
            },
            body: { backgroundColor: "#1A1A1A" },
            title: { color: "#F5F5F5" },
          }}
        >
          <ScoreBreakdown idea={currentItem} />
        </Modal>
      )}
    </Card>
  );
}
