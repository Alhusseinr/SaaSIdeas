"use client";

import { Button, Card, Group, Text, ThemeIcon, Title } from "@mantine/core";
import { IconBrain, IconX } from "@tabler/icons-react";

interface ValidatorHeaderProps {
  hasFormData: boolean;
  onClearForm: () => void;
}

export function ValidatorHeader({ hasFormData, onClearForm }: ValidatorHeaderProps) {
  return (
    <Card
      radius="xl"
      withBorder
      style={{
        background: "linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)",
        borderColor: "#404040",
      }}
    >
      <Group justify="space-between" wrap="wrap">
        <Group>
          <ThemeIcon
            size="xl"
            radius="lg"
            style={{
              backgroundColor: "rgba(245, 245, 245, 0.2)",
              color: "#F5F5F5",
            }}
          >
            <IconBrain size={32} />
          </ThemeIcon>
          <div>
            <Title order={2} c="#F5F5F5">
              AI Idea Validator
            </Title>
            <Text c="rgba(245, 245, 245, 0.8)" size="sm">
              Test your SaaS idea against real market data and user complaints
            </Text>
          </div>
        </Group>
        {hasFormData && (
          <Button
            onClick={onClearForm}
            size="sm"
            style={{
              backgroundColor: "rgba(245, 245, 245, 0.2)",
              color: "#F5F5F5",
              border: "1px solid rgba(245, 245, 245, 0.3)",
            }}
            leftSection={<IconX size={16} />}
          >
            Clear Form
          </Button>
        )}
      </Group>
    </Card>
  );
}