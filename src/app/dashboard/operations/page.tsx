'use client'

import { Container, Stack, Title, Text } from '@mantine/core'
import ScheduledJobs from '@/components/ScheduledJobs'

export default function OperationsPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Title order={2} c="#F5F5F5">System Operations</Title>
        <Text c="#CCCCCC">
          Monitor and manage scheduled data collection and analysis jobs.
        </Text>
        <ScheduledJobs />
      </Stack>
    </Container>
  )
}