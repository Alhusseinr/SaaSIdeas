'use client'

import { useState } from 'react'
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  TextInput,
  PasswordInput,
  Stack,
  Group,
  Alert,
  Badge,
  Box,
  ThemeIcon,
  SimpleGrid,
  Center,
  Loader,
  Anchor
} from '@mantine/core'
import {
  IconBolt,
  IconUser,
  IconMail,
  IconLock,
  IconCheck,
  IconX,
  IconShield,
  IconBrain
} from '@tabler/icons-react'
import { supabase } from '@/lib/supabase'

interface LoginFormProps {
  onSuccess: () => void
  selectedPlan?: string
  initialMode?: 'signin' | 'signup'
}

export default function LoginForm({ onSuccess, selectedPlan, initialMode = 'signin' }: LoginFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          return
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters long')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              selected_plan: selectedPlan || 'pro', // Default to Pro plan
            }
          }
        })

        if (error) {
          setError(error.message)
        } else {
          setMessage('Success! Check your email to confirm your account.')
          // For now, we'll simulate email confirmation and proceed
          // In production, user would need to click email confirmation link
          setTimeout(() => {
            onSuccess()
          }, 2000)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setError(error.message)
        } else {
          onSuccess()
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const planInfo = {
    starter: { name: 'Starter', price: '$49', features: ['25 validations/month', 'Basic AI analysis', 'Reddit integration'] },
    professional: { name: 'Professional', price: '$149', features: ['100 validations/month', 'Advanced AI (GPT-4)', 'Multi-platform data', 'Priority support'] },
    pro: { name: 'Professional', price: '$149', features: ['100 validations/month', 'Advanced AI (GPT-4)', 'Multi-platform data', 'Priority support'] },
    enterprise: { name: 'Enterprise', price: '$449', features: ['Unlimited validations', 'Custom AI training', 'White-label options', 'Dedicated support'] }
  }

  const currentPlan = planInfo[selectedPlan as keyof typeof planInfo] || planInfo.professional

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
                <Text size="sm" c="#CCCCCC" visibleFrom="sm">AI-Powered SaaS Discovery Platform</Text>
              </div>
            </Group>

            <Anchor
              href="/"
              c="#C5A46D"
              size="sm"
              fw={500}
            >
              ← Back to Home
            </Anchor>
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
                <IconUser size={32} />
              </ThemeIcon>
              <Title order={2} mb="xs" c="#F5F5F5">
                {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
              </Title>
              <Text c="#E5E5E5" mb="md">
                {mode === 'signup' 
                  ? 'Join thousands discovering profitable SaaS opportunities'
                  : 'Sign in to continue your market intelligence journey'
                }
              </Text>

              {/* Plan Info for Signup */}
              {mode === 'signup' && selectedPlan && (
                <Card withBorder radius="md" p="md" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
                  <Group justify="space-between" mb="sm">
                    <Title order={5} c="#006B3C">Selected Plan: {currentPlan.name}</Title>
                    <Text fw={700} c="#006B3C">{currentPlan.price}/month</Text>
                  </Group>
                  <Group gap="xs" mb="sm">
                    {currentPlan.features.map((feature, index) => (
                      <Badge key={index} style={{ backgroundColor: '#0F4C3A', color: '#F5F5F5' }} size="sm">
                        {feature}
                      </Badge>
                    ))}
                  </Group>
                  <Text size="xs" c="#006B3C">
                    Complete signup to proceed to secure payment
                  </Text>
                </Card>
              )}
            </Card.Section>

            {/* Form */}
            <Card.Section p="xl">
              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  {mode === 'signup' && (
                    <TextInput
                      label="Full Name"
                      placeholder="Enter your full name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      leftSection={<IconUser size={16} />}
                      radius="md"
                    />
                  )}

                  <TextInput
                    label="Email Address"
                    placeholder="Enter your email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftSection={<IconMail size={16} />}
                    radius="md"
                  />

                  <PasswordInput
                    label="Password"
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftSection={<IconLock size={16} />}
                    radius="md"
                  />

                  {mode === 'signup' && (
                    <PasswordInput
                      label="Confirm Password"
                      placeholder="Confirm your password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      leftSection={<IconLock size={16} />}
                      radius="md"
                    />
                  )}

                  {error && (
                    <Alert
                      variant="light"
                      color="red"
                      title="Error"
                      icon={<IconX size={16} />}
                    >
                      {error}
                    </Alert>
                  )}

                  {message && (
                    <Alert
                      variant="light"
                      color="green"
                      title="Success"
                      icon={<IconCheck size={16} />}
                    >
                      {message}
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={loading}
                    style={{
                      background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                      color: '#F5F5F5',
                      border: 'none'
                    }}
                    radius="md"
                  >
                    {loading ? 'Processing...' : (mode === 'signup' ? 'Create Account' : 'Sign In')}
                  </Button>

                  <Text size="xs" c="#CCCCCC" ta="center">
                    By continuing, you agree to our Terms of Service and Privacy Policy
                  </Text>
                </Stack>
              </form>
            </Card.Section>

            {/* Footer */}
            <Card.Section
              p="md"
              style={{
                backgroundColor: '#2A2A2A',
                borderTop: '1px solid #404040',
                textAlign: 'center'
              }}
            >
              <Text size="sm" c="#E5E5E5">
                {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <Anchor
                  fw={500}
                  onClick={() => {
                    setMode(mode === 'signup' ? 'signin' : 'signup')
                    setError('')
                    setMessage('')
                  }}
                  style={{ cursor: 'pointer', color: '#C5A46D' }}
                >
                  {mode === 'signup' ? 'Sign in' : 'Sign up'}
                </Anchor>
              </Text>
            </Card.Section>
          </Card>
        </Center>

        {/* Trust Indicators */}
        <Center mt="xl">
          <SimpleGrid cols={3} spacing="xl" w="100%" maw={400}>
            <Stack align="center" gap="xs">
              <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                <IconShield size={20} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" ta="center">Secure & Encrypted</Text>
            </Stack>
            <Stack align="center" gap="xs">
              <ThemeIcon size="lg" radius="md" variant="light" color="green">
                <IconBrain size={20} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" ta="center">AI-Powered Analysis</Text>
            </Stack>
            <Stack align="center" gap="xs">
              <ThemeIcon size="lg" radius="md" variant="light" color="purple">
                <IconBolt size={20} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" ta="center">Instant Insights</Text>
            </Stack>
          </SimpleGrid>
        </Center>
      </Container>
    </Box>
  )
}