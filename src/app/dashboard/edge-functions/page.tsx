'use client'

import { Container, Stack, Title, Text } from '@mantine/core'
import EdgeFunctions from '@/components/EdgeFunctions'

export default function EdgeFunctionsPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Title order={2} c="#F5F5F5">Edge Functions</Title>
        <Text c="#CCCCCC">
          Monitor and manage serverless functions for data processing and analysis.
        </Text>
        <EdgeFunctions />
      </Stack>
    </Container>
  )
}