"use client";

import { Alert, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";

interface ErrorStateProps {
  error: string;
}

export function ErrorState({ error }: ErrorStateProps) {
  return (
    <Alert
      icon={<IconX size={16} />}
      title="Validation Error"
      color="red"
      radius="md"
      style={{
        backgroundColor: "#2A2A2A",
        borderColor: "#FF6B6B",
        color: "#F5F5F5",
      }}
    >
      <Text c="#FF6B6B">{error}</Text>
    </Alert>
  );
}