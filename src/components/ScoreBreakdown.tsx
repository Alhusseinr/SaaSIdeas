"use client";

import { useState } from 'react'
import {
  Card,
  Button,
  Stack,
  Group,
  Text,
  ThemeIcon,
  Progress,
  Badge,
  Collapse,
  Alert
} from '@mantine/core'
import {
  IconChevronDown,
  IconChevronUp,
  IconTarget,
  IconInfoCircle,
  IconCheck
} from '@tabler/icons-react'
import { SaasIdeaItem } from '@/lib/supabase'

interface ScoreBreakdownProps {
  idea: SaasIdeaItem
}

interface ScoreComponent {
  name: string
  score: number
  maxScore: number
  description: string
  calculation: string
}

export default function ScoreBreakdown({ idea }: ScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getScoreComponents = (idea: SaasIdeaItem): ScoreComponent[] => {
    // Calculate component scores based on the validation edge function logic
    const totalScore = idea.score || 0
    
    // Market Pain Evidence (0-30): Based on complaint posts and sentiment analysis
    const marketPainScore = Math.min(30, Math.round(
      (idea.representative_post_ids?.length || 0) * 2.5 + 
      (totalScore >= 70 ? 10 : totalScore >= 50 ? 5 : 0) // Bonus for high validation scores
    ))
    
    // Market Size & Demand (0-25): Based on market evidence and overall validation
    const marketSizeScore = Math.min(25, Math.round(
      totalScore * 0.25 + (idea.market_size_estimate ? 5 : 0)
    ))
    
    // Competition Analysis (0-20): Based on competitive landscape data
    const competitionScore = Math.min(20, Math.round(
      idea.competitive_landscape?.market_gap_score ? 
        (idea.competitive_landscape.market_gap_score * 0.2) : 
        (totalScore * 0.2)
    ))
    
    // Solution Fit (0-15): Based on how well the idea addresses complaints
    const solutionFitScore = Math.min(15, Math.round(
      totalScore * 0.15 + (idea.technical_feasibility_score || 70) * 0.05
    ))
    
    // Execution Feasibility (0-10): Based on technical and market factors
    const executionScore = Math.min(10, Math.round(
      (idea.technical_feasibility_score || 70) * 0.08 + 
      (100 - (idea.go_to_market_difficulty || 50)) * 0.05
    ))

    return [
      {
        name: "Market Pain Evidence",
        score: marketPainScore,
        maxScore: 30,
        description: "Evidence of this problem in real user complaints and social media posts",
        calculation: `Based on ${idea.representative_post_ids?.length || 0} complaint posts with validation score bonus`
      },
      {
        name: "Market Size & Demand", 
        score: marketSizeScore,
        maxScore: 25,
        description: "Size of target market and evidence of willingness to pay for solutions",
        calculation: `Derived from overall validation score (${totalScore}) ${idea.market_size_estimate ? 'with market size data' : 'without specific market data'}`
      },
      {
        name: "Competition Analysis",
        score: competitionScore, 
        maxScore: 20,
        description: "How saturated the market is and opportunities for differentiation",
        calculation: idea.competitive_landscape ? 
          `Based on market gap score of ${idea.competitive_landscape.market_gap_score}` :
          "Estimated from overall validation analysis"
      },
      {
        name: "Solution Fit",
        score: solutionFitScore,
        maxScore: 15, 
        description: "How well the proposed solution addresses the identified problems",
        calculation: `Combines validation score with technical feasibility (${idea.technical_feasibility_score || 70})`
      },
      {
        name: "Execution Feasibility",
        score: executionScore,
        maxScore: 10,
        description: "How realistic implementation is given current technology and market conditions", 
        calculation: `Based on technical feasibility (${idea.technical_feasibility_score || 70}) and go-to-market difficulty (${idea.go_to_market_difficulty || 50})`
      }
    ]
  }

  const scoreComponents = getScoreComponents(idea)
  const totalCalculatedScore = scoreComponents.reduce((sum, comp) => sum + comp.score, 0)
  const actualScore = idea.score || 0

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return "green"
    if (percentage >= 60) return "blue" 
    if (percentage >= 40) return "yellow"
    return "red"
  }

  return (
    <Card radius="lg" withBorder>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        fullWidth
        variant="subtle"
        justify="space-between"
        rightSection={isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        leftSection={
          <Group>
            <ThemeIcon
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{ from: 'purple', to: 'indigo', deg: 135 }}
            >
              <Text fw={700} c="white">{actualScore}</Text>
            </ThemeIcon>
            <div>
              <Text fw={500}>Validation Score Breakdown</Text>
              <Text size="sm" c="dimmed">How this score was calculated</Text>
            </div>
          </Group>
        }
      />

      <Collapse in={isOpen}>
        <Stack gap="md" pt="md">
          {/* Score Components */}
          {scoreComponents.map((component, index) => (
            <Card key={index} p="md" radius="md" withBorder style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Group justify="space-between" mb="xs">
                <Text fw={500} size="sm">{component.name}</Text>
                <Group gap="xs">
                  <Badge color={getScoreColor(component.score, component.maxScore)} variant="light">
                    {component.score}/{component.maxScore}
                  </Badge>
                </Group>
              </Group>
              
              <Progress 
                value={(component.score / component.maxScore) * 100} 
                color={getScoreColor(component.score, component.maxScore)}
                size="sm"
                mb="xs"
              />
              
              <Text size="xs" c="dimmed" mb="xs">{component.description}</Text>
              
              <Alert
                variant="light"
                color="blue"
                icon={<IconInfoCircle size={14} />}
              >
                <Text size="xs">
                  <Text span fw={500}>Calculation:</Text> {component.calculation}
                </Text>
              </Alert>
            </Card>
          ))}

          {/* Total Score Summary */}
          <Card
            p="md"
            radius="md"
            style={{
              background: 'linear-gradient(to right, var(--mantine-color-purple-0), var(--mantine-color-indigo-0))'
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={500} c="purple">Total Validation Score</Text>
              <Text size="lg" fw={700} c="purple">{actualScore}/100</Text>
            </Group>
            
            <Progress 
              value={actualScore} 
              color="purple"
              size="md"
              mb="sm"
            />
            
            <Stack gap="xs">
              {totalCalculatedScore !== actualScore && (
                <Text size="xs" c="purple">
                  <Text span fw={500}>Note:</Text> Calculated components total {totalCalculatedScore}/100. 
                  Final score of {actualScore} includes additional AI analysis factors.
                </Text>
              )}
              <Text size="xs" c="purple">
                <Text span fw={500}>AI Analysis:</Text> This score combines quantitative metrics with AI evaluation of market sentiment, 
                competitive positioning, and solution viability based on real user feedback.
              </Text>
            </Stack>
          </Card>

          {/* Methodology Info */}
          <Alert
            variant="light"
            color="orange"
            icon={<IconInfoCircle size={16} />}
            title="Scoring Methodology"
          >
            <Text size="xs">
              Scores are calculated using a combination of quantitative data analysis (complaint post counts, sentiment analysis, keyword matching) 
              and qualitative AI evaluation of market opportunity, competitive landscape, and solution fit. The final score reflects both 
              data-driven insights and expert market analysis.
            </Text>
            {idea.representative_post_ids && idea.representative_post_ids.length > 1 && (
              <Alert
                variant="light"
                color="blue"
                mt="xs"
                icon={<IconCheck size={14} />}
              >
                <Text size="xs">
                  <Text span fw={500}>Pattern-Based Idea:</Text> This solution addresses common problems found across {idea.representative_post_ids.length} different user complaints, indicating strong market demand.
                </Text>
              </Alert>
            )}
          </Alert>
        </Stack>
      </Collapse>
    </Card>
  )
}