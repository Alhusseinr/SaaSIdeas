'use client'

import { Container, Stack, Title, Text } from '@mantine/core'
import IdeaValidator from '@/components/IdeaValidator'

export default function ValidatorPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Title order={2} c="#F5F5F5">Opportunity Validator</Title>
        <Text c="#CCCCCC">
          Validate your SaaS ideas using our AI-powered analysis engine.
        </Text>
        <IdeaValidator />
      </Stack>
    </Container>
  )
}