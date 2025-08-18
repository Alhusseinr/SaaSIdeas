"use client";

import { useState } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  ThemeIcon,
  Card,
  Progress,
  Code,
  Box,
  Popover
} from '@mantine/core'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'

interface ScoreMethodologyProps {
  scoreName: string
  score: number
  methodology: {
    description: string
    factors: Array<{
      name: string
      weight: number
      value: number
      explanation: string
    }>
    calculation: string
  }
}

export default function ScoreMethodology({ scoreName, score, methodology }: ScoreMethodologyProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getScoreColors = (score: number) => {
    if (score >= 80) return { bg: '#006B3C', text: '#F5F5F5' };
    if (score >= 60) return { bg: '#006B3C', text: '#F5F5F5' };
    if (score >= 40) return { bg: '#C5A46D', text: '#0D0D0D' };
    return { bg: '#FF6B6B', text: '#F5F5F5' };
  }

  const colors = getScoreColors(score)

  return (
    <Stack align="center" gap="xs">
      <ThemeIcon size="xl" radius="lg" style={{ backgroundColor: colors.bg, color: colors.text }}>
        <Text fw={700} size="lg">
          {score}
        </Text>
      </ThemeIcon>
      <Text size="xs" c="#CCCCCC" ta="center">{scoreName}</Text>
      
      <Popover 
        width={320} 
        position="bottom" 
        withArrow 
        shadow="md"
        opened={isOpen}
        onChange={setIsOpen}
        styles={{
          dropdown: { 
            backgroundColor: '#1A1A1A', 
            borderColor: '#404040',
            color: '#F5F5F5'
          },
          arrow: { backgroundColor: '#1A1A1A', borderColor: '#404040' }
        }}
      >
        <Popover.Target>
          <Button
            onClick={() => setIsOpen(!isOpen)}
            size="xs"
            variant="subtle"
            rightSection={isOpen ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
            style={{
              color: '#006B3C',
              backgroundColor: 'transparent',
              fontSize: '10px'
            }}
          >
            How is this calculated?
          </Button>
        </Popover.Target>
        
        <Popover.Dropdown>
          <Stack gap="md">
            <Box>
              <Text fw={500} c="#F5F5F5" mb="xs">{scoreName} Methodology</Text>
              <Text size="sm" c="#CCCCCC">{methodology.description}</Text>
            </Box>
            
            <Stack gap="sm">
              <Text size="sm" fw={500} c="#F5F5F5">Factors:</Text>
              {methodology.factors.map((factor, index) => (
                <Card key={index} withBorder radius="md" p="sm" style={{ backgroundColor: '#2A2A2A', borderColor: '#404040' }}>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500} c="#F5F5F5">{factor.name}</Text>
                    <Text size="sm" c="#E5E5E5">{factor.value}/100</Text>
                  </Group>
                  <Text size="xs" c="#CCCCCC" mb="xs">{factor.explanation}</Text>
                  <Group gap="sm" align="center">
                    <Progress
                      flex={1}
                      value={factor.value}
                      size="sm"
                      radius="md"
                      style={{
                        '& .mantine-Progress-bar': {
                          backgroundColor: '#006B3C'
                        }
                      }}
                    />
                    <Text size="xs" c="#CCCCCC">Weight: {factor.weight}%</Text>
                  </Group>
                </Card>
              ))}
            </Stack>
            
            <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#2A2A2A', borderColor: '#006B3C' }}>
              <Text size="sm" fw={500} c="#F5F5F5" mb="xs">Calculation:</Text>
              <Code 
                block 
                style={{ 
                  backgroundColor: '#1A1A1A', 
                  color: '#C5A46D',
                  fontSize: '11px'
                }}
              >
                {methodology.calculation}
              </Code>
            </Card>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Stack>
  )
}