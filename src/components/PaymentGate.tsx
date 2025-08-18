'use client'

import { useState } from 'react'
import { 
  Container, 
  Card, 
  Title, 
  Text, 
  Button, 
  Group, 
  Badge, 
  SegmentedControl,
  ThemeIcon,
  Center,
  Box,
  List,
  Divider
} from '@mantine/core'
import { 
  IconBolt, 
  IconCreditCard, 
  IconLogout,
  IconCheck
} from '@tabler/icons-react'
import { useAuth } from '@/hooks/useAuth'

interface PaymentGateProps {
  selectedPlan: {
    id: string
    name: string
    price: number
    features: string[]
  }
  onPaymentComplete: () => void
}

export default function PaymentGate({ selectedPlan, onPaymentComplete }: PaymentGateProps) {
  const { user, signOut } = useAuth()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      // This will redirect to landing page
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handlePayment = async () => {
    setIsProcessing(true)
    
    try {
      // TODO: Replace with actual Stripe integration
      // For now, simulate payment processing
      console.log('Processing payment for:', {
        plan: selectedPlan.name,
        billing: billingCycle,
        amount: billingCycle === 'yearly' ? selectedPlan.price * 10 : selectedPlan.price
      })
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // In real implementation:
      // 1. Create Stripe checkout session
      // 2. Redirect to Stripe
      // 3. Handle success webhook
      // 4. Create active subscription in database
      
      onPaymentComplete()
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const getPrice = () => {
    return billingCycle === 'yearly' ? selectedPlan.price * 10 : selectedPlan.price
  }

  const getSavings = () => {
    const yearlyTotal = selectedPlan.price * 10 // 2 months free
    const monthlyTotal = selectedPlan.price * 12
    return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100)
  }

  return (
    <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0D0D0D 0%, #1A1A1A 100%)' }}>
      {/* Header */}
      <Box 
        style={{ 
          backgroundColor: 'rgba(26, 26, 26, 0.9)', 
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #404040',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100
        }}
        h={70}
      >
        <Container size="xl" h="100%">
          <Group justify="space-between" h="100%">
            <Group>
              <ThemeIcon 
                size="lg"
                radius="md"
                style={{ 
                  background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                  color: '#F5F5F5'
                }}
              >
                <IconBolt size={20} />
              </ThemeIcon>
              <div>
                <Title order={4} c="#F5F5F5">IdeaValidator</Title>
                <Text size="sm" c="#CCCCCC" visibleFrom="sm">Complete Your Subscription</Text>
              </div>
            </Group>
            
            <Group>
              <Group gap="xs" visibleFrom="sm">
                <Box w={8} h={8} style={{ backgroundColor: '#C5A46D', borderRadius: '50%' }} />
                <Text size="sm" c="#E5E5E5">
                  Welcome, <Text span fw={500} c="#F5F5F5">{user?.email?.split('@')[0]}</Text>
                </Text>
              </Group>
              
              <Button
                style={{
                  backgroundColor: '#FF6B6B',
                  color: '#F5F5F5',
                  border: 'none'
                }}
                leftSection={<IconLogout size={16} />}
                onClick={handleSignOut}
              >
                <Text visibleFrom="sm">Sign Out</Text>
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Main Content */}
      <Container size="sm" pt={100} pb={50}>
        <Center>
          <Card radius="xl" shadow="xl" withBorder w="100%" maw={500} style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
            {/* Header */}
            <Card.Section 
              p="xl" 
              style={{ 
                background: 'linear-gradient(to right, #1A1A1A, #2A2A2A)',
                textAlign: 'center',
                borderBottom: '1px solid #404040'
              }}
            >
              <ThemeIcon 
                size="xl"
                radius="lg"
                style={{ 
                  background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                  color: '#F5F5F5'
                }}
                mx="auto"
                mb="md"
              >
                <IconCreditCard size={32} />
              </ThemeIcon>
              <Title order={2} mb="xs" c="#F5F5F5">Complete Your Subscription</Title>
              <Text c="#E5E5E5">You're one step away from discovering your next SaaS opportunity</Text>
            </Card.Section>

            {/* Plan Summary */}
            <Card.Section p="xl" withBorder style={{ borderColor: '#404040' }}>
              <Group justify="space-between" mb="md">
                <Title order={4} c="#F5F5F5">{selectedPlan.name} Plan</Title>
                <Badge style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>Selected</Badge>
              </Group>
              
              {/* Billing Toggle */}
              <SegmentedControl
                value={billingCycle}
                onChange={(value) => setBillingCycle(value as 'monthly' | 'yearly')}
                data={[
                  { label: 'Monthly', value: 'monthly' },
                  { label: 'Yearly', value: 'yearly' }
                ]}
                fullWidth
                mb="lg"
              />

              {/* Price Display */}
              <Group justify="space-between" mb="md">
                <div>
                  <Text size="xl" fw={700} c="#006B3C">${getPrice()}</Text>
                  <Text size="sm" c="#CCCCCC">per {billingCycle === 'yearly' ? 'year' : 'month'}</Text>
                </div>
                {billingCycle === 'yearly' && (
                  <Badge style={{ backgroundColor: '#C5A46D', color: '#0D0D0D' }}>
                    Save {getSavings()}%
                  </Badge>
                )}
              </Group>

              {billingCycle === 'yearly' && (
                <Text size="sm" c="#C5A46D" mb="md">
                  🎉 Get 2 months free with yearly billing!
                </Text>
              )}

              {/* Features */}
              <Text fw={500} mb="sm" c="#F5F5F5">What's included:</Text>
              <List
                spacing="xs"
                size="sm"
                icon={<IconCheck size={16} color="#006B3C" />}
                mb="xl"
              >
                {selectedPlan.features.map((feature, index) => (
                  <List.Item key={index}>
                    <Text c="#E5E5E5">{feature}</Text>
                  </List.Item>
                ))}
              </List>

              <Divider mb="xl" style={{ borderColor: '#404040' }} />

              {/* Payment Button */}
              <Button
                size="lg"
                fullWidth
                leftSection={<IconCreditCard size={20} />}
                onClick={handlePayment}
                loading={isProcessing}
                loaderProps={{ type: 'dots' }}
                style={{
                  background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                  color: '#F5F5F5',
                  border: 'none'
                }}
              >
                {isProcessing ? 'Processing...' : `Subscribe for $${getPrice()}/${billingCycle === 'yearly' ? 'year' : 'month'}`}
              </Button>

              <Text size="xs" c="#CCCCCC" ta="center" mt="md">
                Secure payment powered by Stripe. Cancel anytime.
              </Text>
            </Card.Section>

            {/* Footer */}
            <Card.Section 
              p="md"
              style={{ 
                backgroundColor: '#2A2A2A',
                borderTop: '1px solid #404040'
              }}
            >
              <Text size="xs" c="#CCCCCC" ta="center">
                🔒 Your payment information is secure and encrypted
              </Text>
            </Card.Section>
          </Card>
        </Center>
      </Container>
    </Box>
  )
}