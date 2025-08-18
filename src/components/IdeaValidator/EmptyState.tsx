"use client";

import { Card, Center, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconBolt, IconCheck } from "@tabler/icons-react";

export function EmptyState() {
  return (
    <Card
      radius="xl"
      withBorder
      style={{ backgroundColor: "#1A1A1A", borderColor: "#404040" }}
    >
      <Center p="xl">
        <Stack align="center" gap="md" maw={400}>
          <ThemeIcon
            size={80}
            radius="xl"
            style={{ backgroundColor: "#006B3C", color: "#F5F5F5" }}
          >
            <IconBolt size={40} />
          </ThemeIcon>
          <Title order={3} ta="center" c="#F5F5F5">
            Ready to Validate Your Idea?
          </Title>
          <Text c="#CCCCCC" ta="center" lh={1.6}>
            Fill out the form on the left and click "Validate My Idea" to get
            comprehensive market insights powered by AI analysis of real user
            complaints and market data.
          </Text>
          <Group gap="md" justify="center">
            <Group gap="xs">
              <IconCheck size={16} color="#006B3C" />
              <Text size="xs" c="#CCCCCC">
                Real market data
              </Text>
            </Group>
            <Group gap="xs">
              <IconCheck size={16} color="#006B3C" />
              <Text size="xs" c="#CCCCCC">
                AI-powered analysis
              </Text>
            </Group>
            <Group gap="xs">
              <IconCheck size={16} color="#006B3C" />
              <Text size="xs" c="#CCCCCC">
                Instant results
              </Text>
            </Group>
          </Group>
        </Stack>
      </Center>
    </Card>
  );
}