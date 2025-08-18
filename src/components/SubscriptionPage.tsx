'use client'

import { useState } from 'react'
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  Stack,
  Group,
  Badge,
  Grid,
  ThemeIcon,
  Alert,
  Progress,
  Loader,
  Center,
  Skeleton,
  Divider
} from '@mantine/core'
import {
  IconCreditCard,
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconSettings,
  IconTrendingUp,
  IconFileText,
  IconClock,
  IconCheck,
  IconExclamationCircle
} from '@tabler/icons-react'
import { usePricingActions } from '@/contexts/PricingContext'
import { formatPrice, isUnlimitedPlan } from '@/types/pricing'

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
    isLoading
  } = usePricingActions()

  const [showUsageDetails, setShowUsageDetails] = useState(false)
  const [isManaging, setIsManaging] = useState(false)

  const handleManageSubscription = async () => {
    setIsManaging(true)
    
    try {
      // Create Stripe customer portal session
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const { url, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Redirect to Stripe customer portal
      window.location.href = url
    } catch (error) {
      console.error('Customer portal error:', error)
      alert('Unable to open subscription management. Please try again.')
    } finally {
      setIsManaging(false)
    }
  }

  const handleUpgradePlan = () => {
    // Redirect to landing page pricing section
    window.location.href = '/#pricing'
  }

  if (isLoading) {
    return (
      <Container size="xl">
        <Stack gap="xl">
          {[1, 2].map((i) => (
            <Card key={i} radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
              <Stack gap="md">
                <Skeleton height={20} width="25%" />
                <Skeleton height={24} width="50%" />
                <Skeleton height={16} width="75%" />
              </Stack>
            </Card>
          ))}
        </Stack>
      </Container>
    )
  }

  const currentPlan = getCurrentPlan()
  const usedValidations = getUsageForType('idea_validation')
  const remainingValidations = getRemainingValidations()
  const usagePercentage = getUsagePercentage()
  const trialDaysRemaining = getTrialDaysRemaining()

  const getUsageBarColor = () => {
    if (usagePercentage >= 90) return '#FF6B6B'
    if (usagePercentage >= 75) return '#C5A46D'
    return '#006B3C'
  }

  const getStatusBadgeColor = () => {
    if (isOnTrial()) return '#006B3C'
    if (currentSubscription?.status === 'active') return '#006B3C'
    if (currentSubscription?.status === 'past_due') return '#FF6B6B'
    return '#666666'
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        {/* Current Subscription Status */}
        <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
          {/* Header */}
          <Card.Section 
            withBorder 
            p="lg" 
            style={{ 
              borderColor: '#404040',
              background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)'
            }}
          >
            <Group justify="space-between">
              <Group>
                <ThemeIcon size="lg" radius="md" style={{ backgroundColor: 'rgba(245, 245, 245, 0.2)', color: '#F5F5F5' }}>
                  <IconCreditCard size={20} />
                </ThemeIcon>
                <div>
                  <Title order={3} c="#F5F5F5">Current Subscription</Title>
                  <Text c="rgba(245, 245, 245, 0.8)" size="sm">Your plan and usage overview</Text>
                </div>
              </Group>
              <Button
                onClick={() => setShowUsageDetails(!showUsageDetails)}
                size="sm"
                leftSection={showUsageDetails ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                style={{
                  backgroundColor: 'rgba(245, 245, 245, 0.2)',
                  color: '#F5F5F5',
                  border: '1px solid rgba(245, 245, 245, 0.3)'
                }}
              >
                {showUsageDetails ? 'Hide Details' : 'View Details'}
              </Button>
            </Group>
          </Card.Section>

          {/* Content */}
          <Card.Section p="xl">
            {!hasActiveSubscription() ? (
              <Card 
                radius="xl" 
                withBorder 
                style={{ 
                  backgroundColor: '#2A2A2A',
                  borderColor: '#C5A46D',
                  textAlign: 'center'
                }}
              >
                <Center p="xl">
                  <Stack align="center" gap="md">
                    <ThemeIcon size={64} radius="xl" style={{ backgroundColor: '#C5A46D', color: '#0D0D0D' }}>
                      <IconAlertTriangle size={32} />
                    </ThemeIcon>
                    <Title order={3} c="#F5F5F5">No Active Subscription</Title>
                    <Text c="#CCCCCC" mb="md">Subscribe to start validating your SaaS ideas</Text>
                    <Button
                      onClick={handleUpgradePlan}
                      size="lg"
                      style={{
                        background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                        color: '#F5F5F5',
                        border: 'none'
                      }}
                    >
                      View Pricing Plans
                    </Button>
                  </Stack>
                </Center>
              </Card>
            ) : (
              <>
                {/* Plan Info */}
                <Group justify="space-between" mb="xl">
                  <div>
                    <Group gap="md" mb="xs">
                      <Title order={2} c="#F5F5F5">{currentPlan?.display_name}</Title>
                      <Badge
                        style={{
                          backgroundColor: getStatusBadgeColor(),
                          color: '#F5F5F5'
                        }}
                      >
                        {isOnTrial() ? `Trial (${trialDaysRemaining} days left)` : currentSubscription?.status}
                      </Badge>
                    </Group>
                    <Text c="#CCCCCC" mb="xs">{currentPlan?.description}</Text>
                    {currentSubscription && (
                      <Text size="sm" c="#666666">
                        {formatPrice(currentSubscription.billing_cycle === 'yearly' ? currentPlan?.price_yearly || 0 : currentPlan?.price_monthly || 0)} 
                        / {currentSubscription.billing_cycle === 'yearly' ? 'year' : 'month'}
                      </Text>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text size="xl" fw={700} c="#F5F5F5">
                      {isUnlimitedPlan(currentPlan?.validations_per_month || 0) ? '∞' : remainingValidations}
                    </Text>
                    <Text size="sm" c="#666666">
                      {isUnlimitedPlan(currentPlan?.validations_per_month || 0) ? 'Unlimited' : 'remaining'}
                    </Text>
                  </div>
                </Group>

                {/* Usage Progress */}
                {!isUnlimitedPlan(currentPlan?.validations_per_month || 0) && (
                  <Stack gap="md" mb="xl">
                    <Group justify="space-between">
                      <Text size="sm" fw={500} c="#F5F5F5">Idea Validations This Month</Text>
                      <Text size="sm" c="#CCCCCC">
                        {usedValidations} / {currentPlan?.validations_per_month}
                      </Text>
                    </Group>
                    <Progress
                      value={Math.min(100, usagePercentage)}
                      size="lg"
                      radius="md"
                      style={{
                        '& .mantine-Progress-bar': {
                          backgroundColor: getUsageBarColor()
                        }
                      }}
                    />
                    {usagePercentage >= 80 && (
                      <Alert
                        icon={<IconExclamationCircle size={16} />}
                        color="yellow"
                        radius="md"
                        style={{
                          backgroundColor: '#2A2A2A',
                          borderColor: '#C5A46D',
                          color: '#F5F5F5'
                        }}
                      >
                        <Text c="#C5A46D" size="sm">
                          You're approaching your monthly limit. Consider upgrading your plan.
                        </Text>
                      </Alert>
                    )}
                  </Stack>
                )}

                {/* Trial Warning */}
                {isOnTrial() && trialDaysRemaining <= 3 && (
                  <Alert
                    icon={<IconClock size={16} />}
                    title={`Your trial expires in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}`}
                    color="yellow"
                    radius="md"
                    mb="xl"
                    style={{
                      backgroundColor: '#2A2A2A',
                      borderColor: '#C5A46D',
                      color: '#F5F5F5'
                    }}
                  >
                    <Text c="#C5A46D" size="sm">
                      Choose a plan below to continue using IdeaValidator without interruption.
                    </Text>
                  </Alert>
                )}

                {/* Action Buttons */}
                <Group gap="md" mb="xl">
                  <Button
                    onClick={handleManageSubscription}
                    disabled={isManaging}
                    leftSection={
                      isManaging ? (
                        <Loader size="xs" color="#F5F5F5" />
                      ) : (
                        <IconSettings size={16} />
                      )
                    }
                    style={{
                      background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                      color: '#F5F5F5',
                      border: 'none'
                    }}
                  >
                    {isManaging ? 'Opening...' : 'Manage Subscription'}
                  </Button>
                  {currentPlan?.name !== 'enterprise' && (
                    <Button
                      onClick={handleUpgradePlan}
                      leftSection={<IconTrendingUp size={16} />}
                      style={{
                        backgroundColor: '#2A2A2A',
                        color: '#C5A46D',
                        borderColor: '#C5A46D'
                      }}
                    >
                      Upgrade Plan
                    </Button>
                  )}
                  <Button
                    leftSection={<IconFileText size={16} />}
                    style={{
                      backgroundColor: '#2A2A2A',
                      color: '#E5E5E5',
                      borderColor: '#404040'
                    }}
                  >
                    Download Invoice
                  </Button>
                </Group>

                {/* Detailed Usage (Expandable) */}
                {showUsageDetails && (
                  <>
                    <Divider mb="xl" style={{ borderColor: '#404040' }} />
                    <Stack gap="md">
                      <Title order={4} c="#F5F5F5">Usage Details</Title>
                      <Grid>
                        <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                          <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                            <Group justify="space-between">
                              <Text size="sm" c="#CCCCCC">API Calls</Text>
                              <Text size="lg" fw={700} c="#F5F5F5">
                                {getUsageForType('api_call') || 0}
                              </Text>
                            </Group>
                          </Card>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                          <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                            <Group justify="space-between">
                              <Text size="sm" c="#CCCCCC">Exports</Text>
                              <Text size="lg" fw={700} c="#F5F5F5">
                                {getUsageForType('export') || 0}
                              </Text>
                            </Group>
                          </Card>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                          <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                            <Group justify="space-between">
                              <Text size="sm" c="#CCCCCC">Team Members</Text>
                              <Text size="lg" fw={700} c="#F5F5F5">
                                {getUsageForType('team_member') || 0}
                              </Text>
                            </Group>
                          </Card>
                        </Grid.Col>
                      </Grid>
                      
                      {currentSubscription && (
                        <Stack gap="xs" mt="md">
                          <Text size="xs" c="#666666">
                            Billing cycle: {currentSubscription.current_period_start} to {currentSubscription.current_period_end}
                          </Text>
                          {currentSubscription.cancel_at_period_end && (
                            <Group gap="xs">
                              <IconExclamationCircle size={14} color="#FF6B6B" />
                              <Text size="xs" c="#FF6B6B">
                                Subscription will cancel at the end of this period
                              </Text>
                            </Group>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </>
                )}
              </>
            )}
          </Card.Section>
        </Card>
      </Stack>
    </Container>
  )
}