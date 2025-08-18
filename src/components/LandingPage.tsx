'use client'

import {
  Container,
  Title,
  Text,
  Button,
  Group,
  SimpleGrid,
  Card,
  Stack,
  Badge,
  Box,
  Flex,
  Center,
  ThemeIcon,
  List,
  Tabs,
  Grid
} from '@mantine/core';
import {
  IconChartBar,
  IconBolt,
  IconShieldCheck,
  IconBulb,
  IconEye,
  IconFilter,
  IconTag,
  IconCurrencyDollar,
  IconTrendingUp,
  IconUsers,
  IconRocket,
  IconBrain,
  IconSearch,
  IconCheck
} from '@tabler/icons-react';
import TodaysOpportunityCard from './TodaysOpportunityCard';

interface LandingPageProps {
  onGetStarted: (planId?: string) => void;
  onSignIn?: () => void;
}

export default function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const coreFeatures = [
    {
      icon: IconChartBar,
      title: 'AI-Powered Market Analysis',
      description: 'Leverage advanced artificial intelligence to discover validated SaaS opportunities from authentic user feedback and comprehensive market pain point analysis.'
    },
    {
      icon: IconBolt,
      title: 'Real-Time Intelligence Gathering',
      description: 'Continuously monitor Reddit, Twitter, and other high-signal platforms to identify emerging market problems requiring innovative solutions.'
    },
    {
      icon: IconShieldCheck,
      title: 'Advanced Validation Scoring',
      description: 'Receive AI-generated validation scores and comprehensive market feasibility assessments for every identified business opportunity.'
    },
    {
      icon: IconBulb,
      title: 'Strategic Implementation Guidance',
      description: 'Generate detailed technical specifications, go-to-market strategies, and comprehensive business plans to transform ideas into market reality.'
    }
  ];

  const phaseFeatures = {
    essential: [
      {
        icon: IconEye,
        title: 'Source Intelligence',
        description: 'Access original Reddit and Twitter posts driving each opportunity. Complete transparency with direct links to authentic user complaints and market signals.'
      },
      {
        icon: IconChartBar,
        title: 'Core Market Analysis',
        description: 'Essential market validation metrics and opportunity scoring framework for strategic idea assessment and prioritization.'
      },
      {
        icon: IconFilter,
        title: 'Advanced Filtering System',
        description: 'Sophisticated filtering by industry vertical, development complexity, market timing, and validation score ranges across our comprehensive opportunity database.'
      }
    ],
    professional: [
      {
        icon: IconTag,
        title: 'Competitive Intelligence',
        description: 'Comprehensive competitive landscape analysis and strategic white space opportunity identification across all market segments.'
      },
      {
        icon: IconCurrencyDollar,
        title: 'Revenue Strategy Modeling',
        description: 'AI-generated pricing strategies and revenue optimization models based on comprehensive market analysis and user value perception research.'
      },
      {
        icon: IconTrendingUp,
        title: 'Market Dynamics Analysis',
        description: 'Real-time tracking of market trends, user sentiment evolution, and opportunity maturation cycles for strategic timing optimization.'
      }
    ],
    enterprise: [
      {
        icon: IconUsers,
        title: 'Team Collaboration Suite',
        description: 'Advanced collaboration tools for distributed teams including shared workspaces, annotation systems, and strategic decision-making frameworks.'
      },
      {
        icon: IconRocket,
        title: 'Implementation Accelerator',
        description: 'Comprehensive implementation roadmaps, technical architecture recommendations, and go-to-market strategy development for rapid execution.'
      },
      {
        icon: IconBrain,
        title: 'Custom AI Analysis',
        description: 'Personalized AI models trained on your specific market focus areas, industry expertise, and strategic objectives for enhanced opportunity identification.'
      }
    ]
  };

  const pricingPlans = [
    {
      id: 'essential',
      name: 'Essential',
      price: 49,
      period: 'month',
      popular: false,
      description: 'Perfect for individual entrepreneurs and early-stage founders',
      features: [
        'Access to core opportunity database',
        'Basic market validation metrics',
        'Source post transparency',
        'Standard filtering capabilities',
        'Monthly market reports'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 149,
      period: 'month',
      popular: true,
      description: 'Ideal for growing startups and strategic consultants',
      features: [
        'Everything in Essential',
        'Advanced competitive analysis',
        'Revenue modeling tools',
        'Market trend analysis',
        'Priority customer support',
        'API access for integrations'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 449,
      period: 'month',
      popular: false,
      description: 'Comprehensive solution for established companies and investment firms',
      features: [
        'Everything in Professional',
        'Team collaboration suite',
        'Custom AI training',
        'Dedicated account manager',
        'White-label options',
        'Advanced security features'
      ]
    }
  ];

  return (
    <Box>
      {/* Hero Section - Two-tone design */}
      <Box 
        style={{ 
          background: 'linear-gradient(135deg, #0D0D0D 0%, #0A1F44 50%, #8A8D91 100%)',
          position: 'relative',
          overflow: 'hidden'
        }} 
        py={120}
      >
        {/* Abstract decorative elements */}
        <Box
          style={{
            position: 'absolute',
            top: '20%',
            right: '10%',
            width: '300px',
            height: '300px',
            background: 'linear-gradient(45deg, rgba(0, 107, 60, 0.1) 0%, rgba(197, 164, 109, 0.1) 100%)',
            borderRadius: '50%',
            transform: 'rotate(45deg)',
            filter: 'blur(80px)'
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '5%',
            width: '200px',
            height: '200px',
            background: 'linear-gradient(45deg, rgba(10, 31, 68, 0.2) 0%, rgba(138, 141, 145, 0.1) 100%)',
            borderRadius: '30%',
            transform: 'rotate(-30deg)',
            filter: 'blur(60px)'
          }}
        />
        
        <Container size="lg" style={{ position: 'relative', zIndex: 2 }}>
          <Grid align="center">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xl">
                <Badge
                  size="lg"
                  style={{
                    backgroundColor: 'rgba(0, 107, 60, 0.2)',
                    color: '#006B3C',
                    border: '1px solid rgba(0, 107, 60, 0.3)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  🚀 AI-Powered Market Intelligence
                </Badge>
                <Title 
                  order={1} 
                  size={52}
                  fw={800}
                  c="#F5F5F5"
                  lh={1.1}
                  style={{
                    background: 'linear-gradient(135deg, #F5F5F5 0%, #C5A46D 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Discover Validated SaaS Opportunities from Real Market Intelligence
                </Title>
                <Text size="xl" c="#8A8D91" lh={1.6} fw={400}>
                  Transform authentic user complaints and market pain points into profitable business opportunities using our advanced AI-powered intelligence platform.
                </Text>
                <Group>
                  <Button 
                    size="xl" 
                    style={{ 
                      background: 'linear-gradient(135deg, #006B3C 0%, #0A1F44 100%)',
                      color: '#F5F5F5',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '16px 32px',
                      fontSize: '16px',
                      fontWeight: 600,
                      boxShadow: '0 8px 32px rgba(0, 107, 60, 0.3)'
                    }}
                    onClick={() => {
                      console.log('Start Discovery Process clicked')
                      onGetStarted()
                    }}
                    leftSection={<IconRocket size={20} />}
                  >
                    Start Discovery Process
                  </Button>
                  {onSignIn && (
                    <Button 
                      size="lg" 
                      variant="outline" 
                      style={{ 
                        borderColor: '#C5A46D',
                        color: '#C5A46D'
                      }}
                      onClick={onSignIn}
                    >
                      Access Platform
                    </Button>
                  )}
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Center>
                <TodaysOpportunityCard onGetStarted={onGetStarted} />
              </Center>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* Core Features */}
      <Box style={{ backgroundColor: '#F5F5F5' }} py={80}>
        <Container size="lg">
          <Stack align="center" gap="xl" mb={60}>
            <Badge size="lg" style={{ backgroundColor: 'rgba(0, 107, 60, 0.1)', color: '#006B3C', border: '1px solid rgba(0, 107, 60, 0.2)' }}>
              Core Platform Capabilities
            </Badge>
            <Title order={2} ta="center" size={36} fw={700} c="#0D0D0D">
              Enterprise-Grade Market Intelligence
            </Title>
            <Text size="lg" ta="center" c="#8A8D91" maw={600}>
              Our sophisticated AI algorithms analyze millions of authentic user interactions to identify and validate high-potential SaaS opportunities in real-time.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl">
            {coreFeatures.map((feature, index) => (
              <Card key={index} p="xl" radius="lg" withBorder style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(138, 141, 145, 0.2)', boxShadow: '0 4px 24px rgba(0, 107, 60, 0.08)' }}>
                <Stack align="center" ta="center">
                  <ThemeIcon size={60} radius="xl" style={{ background: 'linear-gradient(135deg, #006B3C 0%, #0A1F44 100%)', color: '#F5F5F5' }}>
                    <feature.icon size={30} />
                  </ThemeIcon>
                  <Title order={4} fw={600} c="#0D0D0D">
                    {feature.title}
                  </Title>
                  <Text c="#8A8D91" size="sm" lh={1.6}>
                    {feature.description}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Feature Tiers */}
      <Box style={{ backgroundColor: '#0D0D0D' }} py={80}>
        <Container size="lg">
          <Stack align="center" gap="xl" mb={60}>
            <Badge size="lg" style={{ backgroundColor: 'rgba(197, 164, 109, 0.2)', color: '#C5A46D', border: '1px solid rgba(197, 164, 109, 0.3)' }}>
              Solution Tiers
            </Badge>
            <Title order={2} ta="center" size={36} fw={700} c="#F5F5F5">
              Scalable Intelligence Solutions
            </Title>
            <Text size="lg" ta="center" c="#8A8D91" maw={700}>
              Choose the intelligence level that matches your strategic requirements, from individual entrepreneur to enterprise-scale market analysis.
            </Text>
          </Stack>

          <Tabs defaultValue="essential" variant="pills" radius="md">
            <Tabs.List grow mb="xl" style={{ backgroundColor: 'rgba(10, 31, 68, 0.5)', backdropFilter: 'blur(10px)' }}>
              <Tabs.Tab value="essential" style={{ color: '#8A8D91' }}>Essential Intelligence</Tabs.Tab>
              <Tabs.Tab value="professional" style={{ color: '#8A8D91' }}>Professional Analysis</Tabs.Tab>
              <Tabs.Tab value="enterprise" style={{ color: '#8A8D91' }}>Enterprise Solutions</Tabs.Tab>
            </Tabs.List>

            {Object.entries(phaseFeatures).map(([key, features]) => (
              <Tabs.Panel key={key} value={key}>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
                  {features.map((feature, index) => (
                    <Card key={index} p="xl" radius="lg" withBorder style={{ backgroundColor: 'rgba(10, 31, 68, 0.3)', borderColor: 'rgba(138, 141, 145, 0.2)', backdropFilter: 'blur(10px)' }}>
                      <Stack>
                        <ThemeIcon size={50} radius="xl" style={{ background: 'linear-gradient(135deg, #C5A46D 0%, #006B3C 100%)', color: '#0D0D0D' }}>
                          <feature.icon size={24} />
                        </ThemeIcon>
                        <Title order={4} fw={600} c="#F5F5F5">
                          {feature.title}
                        </Title>
                        <Text c="#8A8D91" lh={1.6}>
                          {feature.description}
                        </Text>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box style={{ backgroundColor: '#F5F5F5' }} py={80}>
        <Container size="lg">
          <Stack align="center" gap="xl" mb={60}>
            <Badge size="lg" style={{ backgroundColor: 'rgba(197, 164, 109, 0.1)', color: '#C5A46D', border: '1px solid rgba(197, 164, 109, 0.2)' }}>
              Investment Plans
            </Badge>
            <Title order={2} ta="center" size={36} fw={700} c="#0D0D0D">
              Strategic Investment in Market Intelligence
            </Title>
            <Text size="lg" ta="center" c="#8A8D91" maw={600}>
              Professional-grade market intelligence solutions designed to accelerate your strategic decision-making and opportunity identification process.
            </Text>
          </Stack>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
          {pricingPlans.map((plan) => (
            <Box key={plan.id} style={{ position: 'relative' }}>
              {plan.popular && (
                <Badge 
                  variant="filled" 
                  style={{ 
                    backgroundColor: '#C5A46D',
                    color: '#0D0D0D',
                    position: 'absolute', 
                    top: -8, 
                    left: '50%', 
                    transform: 'translateX(-50%)', 
                    zIndex: 10 
                  }}
                  size="sm"
                >
                  Most Popular
                </Badge>
              )}
              <Card 
                p="xl" 
                radius="lg" 
                className="card-hover"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: plan.popular ? '#006B3C' : 'rgba(138, 141, 145, 0.2)',
                  border: plan.popular ? '2px solid #006B3C' : '1px solid rgba(138, 141, 145, 0.2)',
                  boxShadow: plan.popular ? '0 8px 32px rgba(0, 107, 60, 0.15)' : '0 4px 24px rgba(138, 141, 145, 0.08)'
                }}
              >
                <Stack>
                  <div>
                    <Title order={3} fw={600} c="#0D0D0D">
                      {plan.name}
                    </Title>
                    <Text c="#8A8D91" size="sm">
                      {plan.description}
                    </Text>
                  </div>

                  <Flex align="baseline" gap="xs">
                    <Title order={1} fw={700} c="#006B3C">
                      ${plan.price}
                    </Title>
                    <Text c="#8A8D91">
                      per {plan.period}
                    </Text>
                  </Flex>

                  <List 
                    spacing="sm"
                    icon={<IconCheck size={16} color="#006B3C" />}
                  >
                    {plan.features.map((feature, index) => (
                      <List.Item key={index}>
                        <Text size="sm" c="#0D0D0D">{feature}</Text>
                      </List.Item>
                    ))}
                  </List>

                  <Button 
                    fullWidth 
                    size="md"
                    style={{
                      background: plan.popular ? 'linear-gradient(135deg, #006B3C 0%, #0A1F44 100%)' : 'transparent',
                      borderColor: plan.popular ? 'transparent' : '#C5A46D',
                      color: plan.popular ? '#F5F5F5' : '#C5A46D',
                      border: plan.popular ? 'none' : '1px solid #C5A46D'
                    }}
                    onClick={() => onGetStarted(plan.id)}
                  >
                    {plan.popular ? "Start Professional Trial" : `Choose ${plan.name}`}
                  </Button>
                </Stack>
              </Card>
            </Box>
          ))}
        </SimpleGrid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box style={{ background: 'linear-gradient(135deg, #0D0D0D 0%, #0A1F44 50%, #8A8D91 100%)', position: 'relative', overflow: 'hidden' }} py={80}>
        {/* Decorative elements */}
        <Box
          style={{
            position: 'absolute',
            top: '50%',
            left: '20%',
            width: '200px',
            height: '200px',
            background: 'linear-gradient(45deg, rgba(197, 164, 109, 0.1) 0%, rgba(0, 107, 60, 0.1) 100%)',
            borderRadius: '50%',
            filter: 'blur(60px)'
          }}
        />
        <Container size="lg" style={{ position: 'relative', zIndex: 2 }}>
          <Stack align="center" ta="center" gap="xl">
            <Title order={2} c="#F5F5F5" size={36} fw={700}>
              Ready to Transform Market Intelligence into Strategic Advantage?
            </Title>
            <Text size="lg" c="#8A8D91" maw={600}>
              Join leading entrepreneurs and strategic analysts who leverage our platform to identify and validate high-potential market opportunities before the competition.
            </Text>
            <Button 
              size="xl" 
              style={{ 
                background: 'linear-gradient(135deg, #006B3C 0%, #C5A46D 100%)',
                color: '#0D0D0D',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: 600,
                boxShadow: '0 8px 32px rgba(197, 164, 109, 0.3)'
              }}
              onClick={() => onGetStarted()}
              leftSection={<IconSearch size={24} />}
            >
              Begin Strategic Discovery
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}