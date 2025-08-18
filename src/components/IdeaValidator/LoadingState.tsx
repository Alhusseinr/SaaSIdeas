"use client";

import { Card, Center, Loader, Stack, Text, Title } from "@mantine/core";

export function LoadingState() {
  return (
    <Card
      radius="xl"
      withBorder
      style={{ backgroundColor: "#1A1A1A", borderColor: "#404040" }}
    >
      <Center p="xl">
        <Stack align="center" gap="md">
          <Loader size="xl" color="#006B3C" />
          <Title order={3} c="#F5F5F5">
            Analyzing Your Idea
          </Title>
          <Text size="sm" c="#CCCCCC" ta="center" maw={400}>
            Our AI is searching through millions of social media posts,
            complaints, and market signals to validate your SaaS concept...
          </Text>
          <Text size="xs" c="#666666">
            Processing market data...
          </Text>
        </Stack>
      </Center>
    </Card>
  );
}