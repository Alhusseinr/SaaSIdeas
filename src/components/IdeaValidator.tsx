'use client'

import { useState } from 'react'
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  TextInput,
  Textarea,
  Stack,
  Group,
  Alert,
  Badge,
  Progress,
  ThemeIcon,
  Loader,
  Center,
  Grid,
  Box,
  List,
  Divider
} from '@mantine/core'
import {
  IconBrain,
  IconUser,
  IconInfoCircle,
  IconSettings,
  IconCurrencyDollar,
  IconBolt,
  IconLock,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconChartBar,
  IconMessage,
  IconTrendingUp,
  IconBulb,
  IconTag
} from '@tabler/icons-react'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'
import { usePricingActions } from '@/contexts/PricingContext'

interface ValidationResult {
  score: number
  rationale: string
  market_evidence: string[]
  competition_level: string
  recommendations: string[]
  similar_complaints: number
  keyword_matches: string[]
}

export default function IdeaValidator() {
  const { canValidateIdea, recordUsage, getRemainingValidations, getCurrentPlan } = usePricingActions()
  const [ideaForm, setIdeaForm] = useState({
    name: '',
    description: '',
    target_user: '',
    core_features: '',
    pricing_model: ''
  })
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setIdeaForm(prev => ({ ...prev, [field]: value }))
  }

  const validateIdea = async () => {
    if (!ideaForm.name.trim() || !ideaForm.description.trim()) {
      setError('Please provide at least an idea name and description')
      return
    }

    // Check if user can validate ideas (has remaining quota)
    if (!canValidateIdea) {
      setError('You have reached your monthly validation limit. Please upgrade your plan to continue.')
      return
    }

    setIsValidating(true)
    setError('')
    setValidationResult(null)

    try {
      // Call the validation edge function
      const result = await invokeEdgeFunction('validate-idea', {
        idea: ideaForm
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Record the usage
      await recordUsage('idea_validation', 1, {
        idea_name: ideaForm.name,
        target_user: ideaForm.target_user,
        validation_score: result.validation?.score
      })

      setValidationResult(result.validation)
    } catch (err: any) {
      setError(err.message || 'Failed to validate idea')
    } finally {
      setIsValidating(false)
    }
  }

  const clearForm = () => {
    setIdeaForm({
      name: '',
      description: '',
      target_user: '',
      core_features: '',
      pricing_model: ''
    })
    setValidationResult(null)
    setError('')
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#006B3C'
    if (score >= 60) return '#C5A46D'
    if (score >= 40) return '#FF8C00'
    return '#FF6B6B'
  }

  const getCompetitionColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low': return '#006B3C'
      case 'medium': return '#C5A46D'
      case 'high': return '#FF6B6B'
      default: return '#666666'
    }
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        {/* Header Section */}
        <Card 
          radius="xl" 
          p="xl" 
          withBorder
          style={{ 
            background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
            borderColor: '#404040'
          }}
        >
          <Group justify="space-between" wrap="wrap">
            <Group>
              <ThemeIcon 
                size="xl" 
                radius="lg" 
                style={{ backgroundColor: 'rgba(245, 245, 245, 0.2)', color: '#F5F5F5' }}
              >
                <IconBrain size={32} />
              </ThemeIcon>
              <div>
                <Title order={2} c="#F5F5F5">AI Idea Validator</Title>
                <Text c="rgba(245, 245, 245, 0.8)" size="sm">
                  Test your SaaS idea against real market data and user complaints
                </Text>
              </div>
            </Group>
            {(ideaForm.name || ideaForm.description || validationResult) && (
              <Button
                onClick={clearForm}
                size="sm"
                style={{
                  backgroundColor: 'rgba(245, 245, 245, 0.2)',
                  color: '#F5F5F5',
                  border: '1px solid rgba(245, 245, 245, 0.3)'
                }}
                leftSection={<IconX size={16} />}
              >
                Clear Form
              </Button>
            )}
          </Group>
        </Card>

        <Grid>
          {/* Input Form */}
          <Grid.Col span={{ base: 12, lg: validationResult ? 6 : 12 }}>
            <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
              <Card.Section p="xl" withBorder style={{ borderColor: '#404040' }}>
                <Stack gap="md">
                  <TextInput
                    label={
                      <Group gap="xs">
                        <IconBulb size={16} color="#006B3C" />
                        <Text fw={600} c="#F5F5F5">Idea Name *</Text>
                      </Group>
                    }
                    placeholder="e.g., Project Management for Remote Teams"
                    value={ideaForm.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    radius="md"
                    styles={{
                      input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                      label: { color: '#F5F5F5' }
                    }}
                  />

                  <Textarea
                    label={
                      <Group gap="xs">
                        <IconInfoCircle size={16} color="#006B3C" />
                        <Text fw={600} c="#F5F5F5">Description & Value Proposition *</Text>
                      </Group>
                    }
                    placeholder="Describe what your SaaS does and what problem it solves..."
                    value={ideaForm.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    radius="md"
                    styles={{
                      input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                      label: { color: '#F5F5F5' }
                    }}
                  />

                  <TextInput
                    label={
                      <Group gap="xs">
                        <IconUser size={16} color="#006B3C" />
                        <Text fw={600} c="#F5F5F5">Target User</Text>
                      </Group>
                    }
                    placeholder="e.g., Small business owners, Freelancers, Marketing teams"
                    value={ideaForm.target_user}
                    onChange={(e) => handleInputChange('target_user', e.target.value)}
                    radius="md"
                    styles={{
                      input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                      label: { color: '#F5F5F5' }
                    }}
                  />

                  <Textarea
                    label={
                      <Group gap="xs">
                        <IconSettings size={16} color="#006B3C" />
                        <Text fw={600} c="#F5F5F5">Core Features</Text>
                      </Group>
                    }
                    placeholder="List the main features (one per line or comma-separated)"
                    value={ideaForm.core_features}
                    onChange={(e) => handleInputChange('core_features', e.target.value)}
                    rows={3}
                    radius="md"
                    styles={{
                      input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                      label: { color: '#F5F5F5' }
                    }}
                  />

                  <TextInput
                    label={
                      <Group gap="xs">
                        <IconCurrencyDollar size={16} color="#006B3C" />
                        <Text fw={600} c="#F5F5F5">Pricing Model</Text>
                      </Group>
                    }
                    placeholder="e.g., $29/month per user, Freemium, One-time purchase"
                    value={ideaForm.pricing_model}
                    onChange={(e) => handleInputChange('pricing_model', e.target.value)}
                    radius="md"
                    styles={{
                      input: { backgroundColor: '#2A2A2A', borderColor: '#404040', color: '#F5F5F5' },
                      label: { color: '#F5F5F5' }
                    }}
                  />

                  {/* Usage Indicator */}
                  <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <IconChartBar size={16} color="#006B3C" />
                        <Text size="sm" fw={600} c="#F5F5F5">Validation Credits</Text>
                      </Group>
                      <Text size="sm" fw={600} c={getRemainingValidations() === -1 ? "#006B3C" : getRemainingValidations() <= 5 ? "#FF6B6B" : "#006B3C"}>
                        {getRemainingValidations() === -1 ? "Unlimited" : `${getRemainingValidations()} remaining`}
                      </Text>
                    </Group>
                    {getCurrentPlan() && (
                      <Text size="xs" c="#CCCCCC">
                        {getCurrentPlan()?.display_name} plan
                        {getRemainingValidations() <= 5 && getRemainingValidations() > 0 && (
                          <Text span c="#C5A46D" ml="xs">• Running low on credits</Text>
                        )}
                      </Text>
                    )}
                  </Card>

                  <Button
                    onClick={validateIdea}
                    disabled={isValidating || !ideaForm.name.trim() || !ideaForm.description.trim() || !canValidateIdea}
                    size="lg"
                    radius="md"
                    fullWidth
                    style={{
                      background: !canValidateIdea ? '#666666' : 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                      color: '#F5F5F5',
                      border: 'none'
                    }}
                    leftSection={
                      isValidating ? (
                        <Loader size="sm" color="#F5F5F5" />
                      ) : !canValidateIdea ? (
                        <IconLock size={20} />
                      ) : (
                        <IconBolt size={20} />
                      )
                    }
                  >
                    {isValidating ? 'Analyzing Against Market Data...' : 
                     !canValidateIdea ? 'Upgrade Plan to Continue' : 
                     'Validate My Idea'}
                  </Button>
                </Stack>
              </Card.Section>
            </Card>
          </Grid.Col>

          {/* Results Section */}
          {(validationResult || error || isValidating) && (
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <Stack gap="md">
                {error && (
                  <Alert
                    icon={<IconX size={16} />}
                    title="Validation Error"
                    color="red"
                    radius="md"
                    style={{
                      backgroundColor: '#2A2A2A',
                      borderColor: '#FF6B6B',
                      color: '#F5F5F5'
                    }}
                  >
                    <Text c="#FF6B6B">{error}</Text>
                  </Alert>
                )}

                {isValidating && (
                  <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                    <Center p="xl">
                      <Stack align="center" gap="md">
                        <Loader size="xl" color="#006B3C" />
                        <Title order={3} c="#F5F5F5">Analyzing Your Idea</Title>
                        <Text size="sm" c="#CCCCCC" ta="center" maw={400}>
                          Our AI is searching through millions of social media posts, complaints, and market signals to validate your SaaS concept...
                        </Text>
                        <Text size="xs" c="#666666">Processing market data...</Text>
                      </Stack>
                    </Center>
                  </Card>
                )}

                {validationResult && (
                  <Stack gap="md">
                    {/* Score Card */}
                    <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                      <Card.Section withBorder p="lg" style={{ borderColor: '#404040' }}>
                        <Group justify="space-between">
                          <Group>
                            <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                              <IconChartBar size={20} />
                            </ThemeIcon>
                            <Title order={3} c="#F5F5F5">Market Validation Score</Title>
                          </Group>
                          <Badge
                            size="xl"
                            style={{
                              backgroundColor: getScoreColor(validationResult.score),
                              color: '#F5F5F5',
                              fontSize: '18px',
                              fontWeight: 700
                            }}
                          >
                            {validationResult.score}/100
                          </Badge>
                        </Group>
                      </Card.Section>
                      <Card.Section p="lg">
                        <Progress
                          value={validationResult.score}
                          size="lg"
                          radius="md"
                          mb="md"
                          style={{
                            '& .mantine-Progress-bar': {
                              backgroundColor: getScoreColor(validationResult.score)
                            }
                          }}
                        />
                        <Text c="#E5E5E5" lh={1.6}>{validationResult.rationale}</Text>
                      </Card.Section>
                    </Card>

                    {/* Market Evidence */}
                    {validationResult.market_evidence && validationResult.market_evidence.length > 0 && (
                      <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                        <Card.Section withBorder p="md" style={{ borderColor: '#404040', backgroundColor: '#2A2A2A' }}>
                          <Group>
                            <IconCheck size={16} color="#006B3C" />
                            <Title order={4} c="#F5F5F5">Market Evidence Found</Title>
                          </Group>
                        </Card.Section>
                        <Card.Section p="lg">
                          <List
                            spacing="sm"
                            size="sm"
                            icon={<Text c="#006B3C" fw={700}>▶</Text>}
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
                          <Card radius="md" withBorder style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                            <Stack align="center" gap="xs">
                              <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#C5A46D', color: '#0D0D0D' }}>
                                <IconTrendingUp size={20} />
                              </ThemeIcon>
                              <Text size="xs" c="#CCCCCC" tt="uppercase" fw={700}>Competition Level</Text>
                              <Badge
                                style={{
                                  backgroundColor: getCompetitionColor(validationResult.competition_level),
                                  color: '#F5F5F5'
                                }}
                              >
                                {validationResult.competition_level}
                              </Badge>
                            </Stack>
                          </Card>
                        </Grid.Col>
                      )}

                      {typeof validationResult.similar_complaints === 'number' && (
                        <Grid.Col span={6}>
                          <Card radius="md" withBorder style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                            <Stack align="center" gap="xs">
                              <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                                <IconMessage size={20} />
                              </ThemeIcon>
                              <Text size="xs" c="#CCCCCC" tt="uppercase" fw={700}>Similar Complaints</Text>
                              <Badge style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                                {validationResult.similar_complaints} posts
                              </Badge>
                            </Stack>
                          </Card>
                        </Grid.Col>
                      )}
                    </Grid>

                    {/* Keyword Matches */}
                    {validationResult.keyword_matches && validationResult.keyword_matches.length > 0 && (
                      <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                        <Card.Section withBorder p="md" style={{ borderColor: '#404040', backgroundColor: '#2A2A2A' }}>
                          <Group>
                            <IconTag size={16} color="#006B3C" />
                            <Title order={4} c="#F5F5F5">Matching Keywords Found</Title>
                          </Group>
                        </Card.Section>
                        <Card.Section p="lg">
                          <Group gap="xs">
                            {validationResult.keyword_matches.map((keyword, index) => (
                              <Badge
                                key={index}
                                style={{
                                  backgroundColor: '#006B3C',
                                  color: '#F5F5F5'
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
                    {validationResult.recommendations && validationResult.recommendations.length > 0 && (
                      <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                        <Card.Section withBorder p="md" style={{ borderColor: '#404040', backgroundColor: '#2A2A2A' }}>
                          <Group>
                            <IconBulb size={16} color="#C5A46D" />
                            <Title order={4} c="#F5F5F5">AI Recommendations</Title>
                          </Group>
                        </Card.Section>
                        <Card.Section p="lg">
                          <List
                            spacing="sm"
                            size="sm"
                            icon={<Text c="#C5A46D" fw={700}>💡</Text>}
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
                )}
              </Stack>
            </Grid.Col>
          )}

          {!validationResult && !error && !isValidating && (
            <Grid.Col span={{ base: 12, lg: 6 }}>
              <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                <Center p="xl">
                  <Stack align="center" gap="md" maw={400}>
                    <ThemeIcon size={80} radius="xl" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                      <IconBolt size={40} />
                    </ThemeIcon>
                    <Title order={3} ta="center" c="#F5F5F5">Ready to Validate Your Idea?</Title>
                    <Text c="#CCCCCC" ta="center" lh={1.6}>
                      Fill out the form on the left and click "Validate My Idea" to get comprehensive market insights powered by AI analysis of real user complaints and market data.
                    </Text>
                    <Group gap="md" justify="center">
                      <Group gap="xs">
                        <IconCheck size={16} color="#006B3C" />
                        <Text size="xs" c="#CCCCCC">Real market data</Text>
                      </Group>
                      <Group gap="xs">
                        <IconCheck size={16} color="#006B3C" />
                        <Text size="xs" c="#CCCCCC">AI-powered analysis</Text>
                      </Group>
                      <Group gap="xs">
                        <IconCheck size={16} color="#006B3C" />
                        <Text size="xs" c="#CCCCCC">Instant results</Text>
                      </Group>
                    </Group>
                  </Stack>
                </Center>
              </Card>
            </Grid.Col>
          )}
        </Grid>
      </Stack>
    </Container>
  )
}