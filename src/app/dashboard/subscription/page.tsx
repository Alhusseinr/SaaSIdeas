'use client'

import { Container, Stack, Title, Text } from '@mantine/core'
import SubscriptionPage from '@/components/SubscriptionPage'

export default function SubscriptionManagementPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Title order={2} c="#F5F5F5">Subscription Management</Title>
        <Text c="#CCCCCC">
          Manage your subscription plan and billing information.
        </Text>
        <SubscriptionPage />
      </Stack>
    </Container>
  )
}