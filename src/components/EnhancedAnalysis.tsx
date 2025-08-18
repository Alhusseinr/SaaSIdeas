"use client";

import { useState } from 'react'
import {
  Card,
  Title,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  Grid,
  ThemeIcon,
  Collapse,
  List,
  Alert,
  Box,
  Divider
} from '@mantine/core'
import {
  IconChartBar,
  IconTrendingUp,
  IconBolt,
  IconBook,
  IconCurrencyDollar,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconFileText,
  IconCheck,
  IconAlertTriangle
} from '@tabler/icons-react'
import { SaasIdeaItem } from '@/lib/supabase'
import ScoreMethodology from './ScoreMethodology'
import SourcePostsModal from './SourcePostsModal'
import ScoreBreakdown from './ScoreBreakdown'

interface EnhancedAnalysisProps {
  idea: SaasIdeaItem
  expandedSections: {[key: string]: boolean}
  toggleSection: (section: string) => void
}

export default function EnhancedAnalysis({ idea, expandedSections, toggleSection }: EnhancedAnalysisProps) {
  const [isSourcePostsModalOpen, setIsSourcePostsModalOpen] = useState(false)
  
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#006B3C";
    if (score >= 60) return "#006B3C";
    if (score >= 40) return "#C5A46D";
    return "#FF6B6B";
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 30) return "#006B3C";
    if (difficulty <= 60) return "#C5A46D";
    return "#FF6B6B";
  };

  // Score methodology data
  const getScoreMethodology = (scoreName: string, score: number) => {
    switch (scoreName) {
      case 'Founder Fit':
        return {
          description: "Measures how well-suited a typical entrepreneur would be to tackle this opportunity based on required skills and market knowledge.",
          factors: [
            {
              name: "Technical Skills Required",
              weight: 30,
              value: Math.min(100, (idea.required_skills?.length || 3) * 20),
              explanation: "Based on number and complexity of technical skills needed"
            },
            {
              name: "Market Accessibility", 
              weight: 25,
              value: 100 - (idea.go_to_market_difficulty || 50),
              explanation: "How easy it is to reach and acquire customers in this market"
            },
            {
              name: "Domain Knowledge",
              weight: 25,
              value: Math.max(20, 100 - (idea.development_timeline_months || 6) * 10),
              explanation: "How much specialized industry knowledge is required"
            },
            {
              name: "Competition Level",
              weight: 20,
              value: idea.competitive_landscape?.market_gap_score || 60,
              explanation: "How crowded the competitive landscape is"
            }
          ],
          calculation: "(Technical×0.3 + Market×0.25 + Domain×0.25 + Competition×0.2)"
        };
      case 'Tech Feasibility':
        return {
          description: "Evaluates how technically achievable this solution is for a small team with modern development tools.",
          factors: [
            {
              name: "Development Complexity",
              weight: 40,
              value: Math.max(20, 100 - (idea.development_timeline_months || 6) * 12),
              explanation: "Based on estimated development timeline and feature complexity"
            },
            {
              name: "Infrastructure Requirements",
              weight: 30,
              value: idea.core_features?.length ? Math.min(100, 120 - (idea.core_features.length * 15)) : 70,
              explanation: "Complexity of required backend systems and integrations"
            },
            {
              name: "Technology Maturity",
              weight: 20,
              value: 85,
              explanation: "Availability of tools, frameworks, and third-party services"
            },
            {
              name: "Scalability Challenges",
              weight: 10,
              value: Math.min(100, (idea.market_size_estimate || 1000000) / 50000),
              explanation: "Technical challenges that arise as the solution scales"
            }
          ],
          calculation: "(Complexity×0.4 + Infrastructure×0.3 + Maturity×0.2 + Scale×0.1)"
        };
      case 'GTM Difficulty':
        return {
          description: "Assesses how challenging it will be to find, reach, and convert customers for this solution.",
          factors: [
            {
              name: "Customer Acquisition Cost",
              weight: 35,
              value: idea.revenue_projection ? Math.min(100, 150 - (idea.revenue_projection.customer_acquisition_cost / 10)) : 60,
              explanation: "Estimated cost to acquire each paying customer"
            },
            {
              name: "Market Education Needed",
              weight: 25,
              value: Math.max(30, 100 - (idea.development_timeline_months || 6) * 8),
              explanation: "How much you need to educate the market about the problem/solution"
            },
            {
              name: "Sales Cycle Length",
              weight: 25,
              value: idea.revenue_projection ? Math.min(100, 200 - (idea.revenue_projection.average_revenue_per_user / 5)) : 70,
              explanation: "Time from first contact to paying customer"
            },
            {
              name: "Channel Availability",
              weight: 15,
              value: 75,
              explanation: "Number of effective marketing/sales channels available"
            }
          ],
          calculation: "(CAC×0.35 + Education×0.25 + SalesCycle×0.25 + Channels×0.15)"
        };
      default:
        return {
          description: "This score is calculated using proprietary algorithms based on market data and user feedback patterns.",
          factors: [],
          calculation: "Proprietary algorithm"
        };
    }
  };

  return (
    <Stack gap="md">
      {/* Score Breakdown */}
      <ScoreBreakdown idea={idea} />
      
      {/* Enhanced Analysis Overview */}
      <Card radius="lg" withBorder style={{ backgroundColor: '#2A2A2A', borderColor: '#C5A46D' }}>
        <Group mb="md">
          <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#C5A46D', color: '#0D0D0D' }}>
            <IconChartBar size={20} />
          </ThemeIcon>
          <Title order={4} c="#F5F5F5">Enhanced Analysis</Title>
        </Group>
        
        <Grid>
          {idea.founder_market_fit_score && (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ScoreMethodology 
                scoreName="Founder Fit"
                score={idea.founder_market_fit_score}
                methodology={getScoreMethodology('Founder Fit', idea.founder_market_fit_score)}
              />
            </Grid.Col>
          )}
          
          {idea.technical_feasibility_score && (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ScoreMethodology 
                scoreName="Tech Feasibility"
                score={idea.technical_feasibility_score}
                methodology={getScoreMethodology('Tech Feasibility', idea.technical_feasibility_score)}
              />
            </Grid.Col>
          )}
          
          {idea.go_to_market_difficulty && (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ScoreMethodology 
                scoreName="GTM Difficulty"
                score={idea.go_to_market_difficulty}
                methodology={getScoreMethodology('GTM Difficulty', idea.go_to_market_difficulty)}
              />
            </Grid.Col>
          )}
          
          {idea.development_timeline_months && (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Stack align="center" gap="xs">
                <ThemeIcon size="xl" radius="lg" style={{ backgroundColor: '#2A2A2A', color: '#E5E5E5' }}>
                  <Text fw={700} size="lg">
                    {Math.round(idea.development_timeline_months * 4.33)}
                  </Text>
                </ThemeIcon>
                <Text size="xs" c="#CCCCCC" ta="center">Weeks to Build</Text>
                <Text size="xs" c="#006B3C" ta="center">
                  Based on {idea.development_timeline_months}mo timeline
                </Text>
              </Stack>
            </Grid.Col>
          )}
        </Grid>
        
        {/* Source Posts Section */}
        {idea.representative_post_ids && idea.representative_post_ids.length > 0 && (
          <Card withBorder radius="md" p="md" mt="md" style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
            <Group justify="space-between">
              <Group>
                <ThemeIcon size="sm" radius="md" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                  <IconFileText size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={500} c="#F5F5F5">Source Complaints</Text>
                  <Text size="xs" c="#CCCCCC">
                    {idea.representative_post_ids.length} real user posts analyzed
                  </Text>
                </div>
              </Group>
              <Button
                onClick={() => setIsSourcePostsModalOpen(true)}
                leftSection={<IconEye size={16} />}
                style={{
                  background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                  color: '#F5F5F5',
                  border: 'none'
                }}
              >
                View Source Posts
              </Button>
            </Group>
          </Card>
        )}
      </Card>

      {/* Market Opportunity Analysis */}
      <Card radius="lg" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
        <Group 
          justify="space-between" 
          p="md" 
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('market')}
        >
          <Group>
            <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <div>
              <Text fw={500} c="#F5F5F5">Market Opportunity</Text>
              {idea.market_size_estimate && (
                <Text size="sm" c="#006B3C" fw={500}>
                  {formatCurrency(idea.market_size_estimate)} TAM
                </Text>
              )}
            </div>
          </Group>
          <ThemeIcon size="sm" variant="transparent">
            {expandedSections.market ? <IconChevronUp size={16} color="#CCCCCC" /> : <IconChevronDown size={16} color="#CCCCCC" />}
          </ThemeIcon>
        </Group>
        
        <Collapse in={expandedSections.market}>
          <Stack gap="md" p="md" pt={0}>
            {/* User Demand Indicators */}
            <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
              <Title order={6} c="#F5F5F5" mb="sm">Real User Demand</Title>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="#CCCCCC">Complaint Posts:</Text>
                  <Text size="sm" fw={500} c="#006B3C">
                    {idea.representative_post_ids?.length || 0} users
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="#CCCCCC">Problem Urgency:</Text>
                  <Text size="sm" fw={500} c="#006B3C">
                    {idea.score >= 80 ? 'High' : idea.score >= 60 ? 'Medium' : 'Low'}
                  </Text>
                </Grid.Col>
              </Grid>
            </Card>

            {/* Market Size Breakdown */}
            {idea.market_size_estimate && (
              <Grid>
                <Grid.Col span={4}>
                  <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
                    <Text size="sm" c="#CCCCCC" mb="xs">Total Market</Text>
                    <Text size="lg" fw={700} c="#006B3C">
                      {formatCurrency(idea.market_size_estimate)}
                    </Text>
                    <Text size="xs" c="#006B3C">TAM Estimate</Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
                    <Text size="sm" c="#CCCCCC" mb="xs">Addressable</Text>
                    <Text size="lg" fw={700} c="#006B3C">
                      {formatCurrency(Math.round(idea.market_size_estimate * 0.1))}
                    </Text>
                    <Text size="xs" c="#006B3C">~10% SAM</Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#C5A46D' }}>
                    <Text size="sm" c="#CCCCCC" mb="xs">Initial Target</Text>
                    <Text size="lg" fw={700} c="#C5A46D">
                      {formatCurrency(Math.round(idea.market_size_estimate * 0.01))}
                    </Text>
                    <Text size="xs" c="#C5A46D">~1% SOM</Text>
                  </Card>
                </Grid.Col>
              </Grid>
            )}
            
            <Alert
              icon={<IconInfoCircle size={16} />}
              title="Market Size Methodology"
              radius="md"
              style={{
                backgroundColor: '#2A2A2A',
                borderColor: '#C5A46D',
                color: '#F5F5F5'
              }}
            >
              <Text size="xs" c="#CCCCCC">
                Market estimates are derived from similar SaaS solutions, industry reports, and user complaint volume analysis. 
                These are directional indicators, not precise revenue forecasts.
              </Text>
            </Alert>
          </Stack>
        </Collapse>
      </Card>

      {/* Competitive Landscape */}
      {idea.competitive_landscape && (
        <Card radius="lg" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
          <Group 
            justify="space-between" 
            p="md" 
            style={{ cursor: 'pointer' }}
            onClick={() => toggleSection('competitive')}
          >
            <Group>
              <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#FF6B6B', color: '#F5F5F5' }}>
                <IconBolt size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500} c="#F5F5F5">Competitive Analysis</Text>
                <Text size="sm" c="#006B3C" fw={500}>
                  Gap Score: {idea.competitive_landscape.market_gap_score}
                </Text>
              </div>
            </Group>
            <ThemeIcon size="sm" variant="transparent">
              {expandedSections.competitive ? <IconChevronUp size={16} color="#CCCCCC" /> : <IconChevronDown size={16} color="#CCCCCC" />}
            </ThemeIcon>
          </Group>
          
          <Collapse in={expandedSections.competitive}>
            <Stack gap="md" p="md" pt={0}>
              <div>
                <Title order={6} c="#F5F5F5" mb="sm">Direct Competitors</Title>
                <Group gap="xs">
                  {idea.competitive_landscape.direct_competitors.map((competitor, index) => (
                    <Badge key={index} style={{ backgroundColor: '#FF6B6B', color: '#F5F5F5' }}>
                      {competitor}
                    </Badge>
                  ))}
                </Group>
              </div>
              
              <div>
                <Title order={6} c="#F5F5F5" mb="sm">Differentiation Opportunities</Title>
                <List
                  spacing="xs"
                  size="sm"
                  icon={<IconCheck size={14} color="#006B3C" />}
                >
                  {idea.competitive_landscape.differentiation_opportunities.map((opportunity, index) => (
                    <List.Item key={index}>
                      <Text size="sm" c="#E5E5E5">{opportunity}</Text>
                    </List.Item>
                  ))}
                </List>
              </div>
              
              <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
                <Title order={6} c="#F5F5F5" mb="xs">Competitive Advantage</Title>
                <Text size="sm" c="#CCCCCC">{idea.competitive_landscape.competitive_advantage}</Text>
              </Card>
            </Stack>
          </Collapse>
        </Card>
      )}

      {/* Required Skills & Investment */}
      <Grid>
        {/* Required Skills */}
        {idea.required_skills && idea.required_skills.length > 0 && (
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card radius="lg" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
              <Group 
                justify="space-between" 
                p="md" 
                style={{ cursor: 'pointer' }}
                onClick={() => toggleSection('skills')}
              >
                <Group>
                  <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#C5A46D', color: '#0D0D0D' }}>
                    <IconBook size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={500} c="#F5F5F5">Required Skills</Text>
                    <Text size="sm" c="#CCCCCC">({idea.required_skills.length} skills)</Text>
                  </div>
                </Group>
                <ThemeIcon size="sm" variant="transparent">
                  {expandedSections.skills ? <IconChevronUp size={16} color="#CCCCCC" /> : <IconChevronDown size={16} color="#CCCCCC" />}
                </ThemeIcon>
              </Group>
              
              <Collapse in={expandedSections.skills}>
                <Box p="md" pt={0}>
                  <Group gap="xs">
                    {idea.required_skills.map((skill, index) => (
                      <Badge key={index} style={{ backgroundColor: '#C5A46D', color: '#0D0D0D' }}>
                        {skill}
                      </Badge>
                    ))}
                  </Group>
                </Box>
              </Collapse>
            </Card>
          </Grid.Col>
        )}

        {/* Investment Breakdown */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card radius="lg" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
            <Group 
              justify="space-between" 
              p="md" 
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSection('investment')}
            >
              <Group>
                <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#C5A46D', color: '#0D0D0D' }}>
                  <IconCurrencyDollar size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={500} c="#F5F5F5">Investment Estimate</Text>
                  {idea.investment_required && (
                    <Text size="lg" fw={700} c="#C5A46D">
                      {formatCurrency(idea.investment_required)}
                    </Text>
                  )}
                </div>
              </Group>
              <ThemeIcon size="sm" variant="transparent">
                {expandedSections.investment ? <IconChevronUp size={16} color="#CCCCCC" /> : <IconChevronDown size={16} color="#CCCCCC" />}
              </ThemeIcon>
            </Group>
            
            <Collapse in={expandedSections.investment}>
              <Stack gap="md" p="md" pt={0}>
                {/* Cost Breakdown */}
                <Grid>
                  <Grid.Col span={6}>
                    <Stack gap="sm">
                      <Title order={6} c="#F5F5F5">Development Costs</Title>
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" c="#CCCCCC">Development Time:</Text>
                          <Text size="sm" fw={500} c="#F5F5F5">{idea.development_timeline_months || 6} months</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="#CCCCCC">Estimated Dev Cost:</Text>
                          <Text size="sm" fw={500} c="#F5F5F5">{formatCurrency((idea.development_timeline_months || 6) * 8000)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="#CCCCCC">Infrastructure/Tools:</Text>
                          <Text size="sm" fw={500} c="#F5F5F5">{formatCurrency(500 * (idea.development_timeline_months || 6))}</Text>
                        </Group>
                      </Stack>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Stack gap="sm">
                      <Title order={6} c="#F5F5F5">Launch Costs</Title>
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" c="#CCCCCC">Marketing/Launch:</Text>
                          <Text size="sm" fw={500} c="#F5F5F5">{formatCurrency(5000)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="#CCCCCC">Legal/Business:</Text>
                          <Text size="sm" fw={500} c="#F5F5F5">{formatCurrency(2000)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="#CCCCCC">Working Capital:</Text>
                          <Text size="sm" fw={500} c="#F5F5F5">{formatCurrency(3000)}</Text>
                        </Group>
                      </Stack>
                    </Stack>
                  </Grid.Col>
                </Grid>
                
                <Alert
                  icon={<IconInfoCircle size={16} />}
                  title="Investment Calculation Method"
                  radius="md"
                  style={{
                    backgroundColor: '#2A2A2A',
                    borderColor: '#C5A46D',
                    color: '#F5F5F5'
                  }}
                >
                  <Text size="xs" c="#CCCCCC">
                    Estimates based on: Development timeline × $8K/month (freelancer/contractor rate) + infrastructure costs + standard launch expenses. 
                    Costs can vary significantly based on team composition and scope changes.
                  </Text>
                </Alert>
                
                <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
                  <Title order={6} c="#F5F5F5" mb="xs">Bootstrap-Friendly Approach</Title>
                  <List
                    spacing="xs"
                    size="xs"
                    icon={<Text c="#006B3C">•</Text>}
                  >
                    <List.Item>
                      <Text c="#CCCCCC">Start with MVP and validate core assumptions first</Text>
                    </List.Item>
                    <List.Item>
                      <Text c="#CCCCCC">Use no-code/low-code tools to reduce development costs</Text>
                    </List.Item>
                    <List.Item>
                      <Text c="#CCCCCC">Begin with manual processes before automating</Text>
                    </List.Item>
                    <List.Item>
                      <Text c="#CCCCCC">Focus on one core feature initially</Text>
                    </List.Item>
                  </List>
                </Card>
              </Stack>
            </Collapse>
          </Card>
        </Grid.Col>
      </Grid>
      
      {/* Source Posts Modal */}
      <SourcePostsModal
        ideaId={String(idea.id)}
        isOpen={isSourcePostsModalOpen}
        onClose={() => setIsSourcePostsModalOpen(false)}
        representativePostIds={idea.representative_post_ids?.map(String) || undefined}
      />
    </Stack>
  );
}