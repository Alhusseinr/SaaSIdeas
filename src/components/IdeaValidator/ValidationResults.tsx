"use client";

import {
  Badge,
  Card,
  Grid,
  Group,
  List,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconBrain,
  IconChartBar,
  IconCheck,
  IconMessage,
  IconTag,
  IconTrendingUp,
  IconBulb,
} from "@tabler/icons-react";

interface ValidationResult {
  score: number;
  rationale: string;
  market_evidence: string[];
  competition_level: string;
  recommendations: string[];
  similar_complaints: number;
  keyword_matches: string[];
}

interface ValidationResultsProps {
  validationResult: ValidationResult;
}

export function ValidationResults({ validationResult }: ValidationResultsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#006B3C";
    if (score >= 60) return "#C5A46D";
    if (score >= 40) return "#FF8C00";
    return "#FF6B6B";
  };

  const getCompetitionColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low":
        return "#006B3C";
      case "medium":
        return "#C5A46D";
      case "high":
        return "#FF6B6B";
      default:
        return "#666666";
    }
  };

  return (
    <Card
      radius="xl"
      withBorder
      style={{ backgroundColor: "#1A1A1A", borderColor: "#404040" }}
    >
      <Card.Section
        withBorder
        p="xl"
        style={{
          borderColor: "#404040",
          background: "linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)",
        }}
      >
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon
              size="lg"
              radius="lg"
              style={{
                backgroundColor: "rgba(245, 245, 245, 0.2)",
                color: "#F5F5F5",
              }}
            >
              <IconChartBar size={24} />
            </ThemeIcon>
            <div>
              <Title order={2} c="#F5F5F5">
                Validation Results
              </Title>
              <Text c="rgba(245, 245, 245, 0.8)" size="sm">
                AI analysis of your SaaS idea against market data
              </Text>
            </div>
          </Group>
          {validationResult.score && (
            <Badge
              size="xl"
              style={{
                backgroundColor: getScoreColor(validationResult.score),
                color: "#F5F5F5",
                fontSize: "20px",
                fontWeight: 700,
                padding: "12px 20px",
              }}
            >
              {validationResult.score}/100
            </Badge>
          )}
        </Group>
      </Card.Section>

      <Card.Section p="xl">
        <Stack gap="lg">
          {/* Score Rationale */}
          <Card
            radius="lg"
            withBorder
            style={{
              backgroundColor: "#2A2A2A",
              borderColor: "#404040",
            }}
          >
            <Card.Section p="lg">
              <Group mb="md">
                <ThemeIcon
                  size="md"
                  radius="md"
                  style={{
                    backgroundColor: "#006B3C",
                    color: "#F5F5F5",
                  }}
                >
                  <IconBrain size={16} />
                </ThemeIcon>
                <Title order={4} c="#F5F5F5">
                  Market Analysis
                </Title>
              </Group>
              <Progress
                value={validationResult.score}
                size="lg"
                radius="md"
                mb="md"
                style={{
                  "& .mantine-Progress-bar": {
                    backgroundColor: getScoreColor(validationResult.score),
                  },
                }}
              />
              <Text c="#E5E5E5" lh={1.6}>
                {validationResult.rationale}
              </Text>
            </Card.Section>
          </Card>

          {/* Market Evidence */}
          {validationResult.market_evidence &&
            validationResult.market_evidence.length > 0 && (
              <Card
                radius="lg"
                withBorder
                style={{
                  backgroundColor: "#2A2A2A",
                  borderColor: "#404040",
                }}
              >
                <Card.Section p="lg">
                  <Group mb="md">
                    <IconCheck size={16} color="#006B3C" />
                    <Title order={4} c="#F5F5F5">
                      Market Evidence Found
                    </Title>
                  </Group>
                  <List
                    spacing="sm"
                    size="sm"
                    icon={
                      <Text c="#006B3C" fw={700}>
                        ▶
                      </Text>
                    }
                  >
                    {validationResult.market_evidence.map((evidence, index) => (
                      <List.Item key={index}>
                        <Text c="#E5E5E5">{evidence}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Card.Section>
              </Card>
            )}

          {/* Stats Grid */}
          <Grid>
            {validationResult.competition_level && (
              <Grid.Col span={6}>
                <Card
                  radius="md"
                  withBorder
                  style={{
                    backgroundColor: "#2A2A2A",
                    borderColor: "#404040",
                  }}
                >
                  <Stack align="center" gap="xs">
                    <ThemeIcon
                      size="lg"
                      radius="md"
                      style={{
                        backgroundColor: "#C5A46D",
                        color: "#0D0D0D",
                      }}
                    >
                      <IconTrendingUp size={20} />
                    </ThemeIcon>
                    <Text size="xs" c="#CCCCCC" tt="uppercase" fw={700}>
                      Competition Level
                    </Text>
                    <Badge
                      style={{
                        backgroundColor: getCompetitionColor(
                          validationResult.competition_level
                        ),
                        color: "#F5F5F5",
                      }}
                    >
                      {validationResult.competition_level}
                    </Badge>
                  </Stack>
                </Card>
              </Grid.Col>
            )}

            {typeof validationResult.similar_complaints === "number" && (
              <Grid.Col span={6}>
                <Card
                  radius="md"
                  withBorder
                  style={{
                    backgroundColor: "#2A2A2A",
                    borderColor: "#404040",
                  }}
                >
                  <Stack align="center" gap="xs">
                    <ThemeIcon
                      size="lg"
                      radius="md"
                      style={{
                        backgroundColor: "#006B3C",
                        color: "#F5F5F5",
                      }}
                    >
                      <IconMessage size={20} />
                    </ThemeIcon>
                    <Text size="xs" c="#CCCCCC" tt="uppercase" fw={700}>
                      Similar Complaints
                    </Text>
                    <Badge
                      style={{
                        backgroundColor: "#006B3C",
                        color: "#F5F5F5",
                      }}
                    >
                      {validationResult.similar_complaints} posts
                    </Badge>
                  </Stack>
                </Card>
              </Grid.Col>
            )}
          </Grid>

          {/* Keyword Matches */}
          {validationResult.keyword_matches &&
            validationResult.keyword_matches.length > 0 && (
              <Card
                radius="lg"
                withBorder
                style={{
                  backgroundColor: "#2A2A2A",
                  borderColor: "#404040",
                }}
              >
                <Card.Section p="lg">
                  <Group mb="md">
                    <IconTag size={16} color="#006B3C" />
                    <Title order={4} c="#F5F5F5">
                      Matching Keywords Found
                    </Title>
                  </Group>
                  <Group gap="xs">
                    {validationResult.keyword_matches.map((keyword, index) => (
                      <Badge
                        key={index}
                        style={{
                          backgroundColor: "#006B3C",
                          color: "#F5F5F5",
                        }}
                      >
                        #{keyword}
                      </Badge>
                    ))}
                  </Group>
                </Card.Section>
              </Card>
            )}

          {/* Recommendations */}
          {validationResult.recommendations &&
            validationResult.recommendations.length > 0 && (
              <Card
                radius="lg"
                withBorder
                style={{
                  backgroundColor: "#2A2A2A",
                  borderColor: "#404040",
                }}
              >
                <Card.Section p="lg">
                  <Group mb="md">
                    <IconBulb size={16} color="#C5A46D" />
                    <Title order={4} c="#F5F5F5">
                      AI Recommendations
                    </Title>
                  </Group>
                  <List
                    spacing="sm"
                    size="sm"
                    icon={
                      <Text c="#C5A46D" fw={700}>
                        💡
                      </Text>
                    }
                  >
                    {validationResult.recommendations.map((rec, index) => (
                      <List.Item key={index}>
                        <Text c="#E5E5E5">{rec}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Card.Section>
              </Card>
            )}
        </Stack>
      </Card.Section>
    </Card>
  );
}