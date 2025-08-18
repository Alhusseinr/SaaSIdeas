"use client";

import {
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import {
  IconBolt,
  IconBulb,
  IconChartBar,
  IconCurrencyDollar,
  IconInfoCircle,
  IconLock,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";

interface IdeaForm {
  name: string;
  description: string;
  target_user: string;
  core_features: string;
  pricing_model: string;
}

interface ValidationFormProps {
  ideaForm: IdeaForm;
  onInputChange: (field: string, value: string) => void;
  onValidate: () => void;
  isValidating: boolean;
  canValidateIdea: boolean;
  getCurrentPlan: () => any;
  getRemainingValidations: () => number;
}

export function ValidationForm({
  ideaForm,
  onInputChange,
  onValidate,
  isValidating,
  canValidateIdea,
  getCurrentPlan,
  getRemainingValidations,
}: ValidationFormProps) {
  const isDisabled = 
    isValidating ||
    !ideaForm.name.trim() ||
    !ideaForm.description.trim() ||
    !canValidateIdea;

  return (
    <Card
      radius="xl"
      withBorder
      style={{ backgroundColor: "#1A1A1A", borderColor: "#404040" }}
    >
      <Card.Section p="xl" withBorder style={{ borderColor: "#404040" }}>
        <Stack gap="md">
          <TextInput
            label={
              <Group gap="xs">
                <IconBulb size={16} color="#006B3C" />
                <Text fw={600} c="#F5F5F5">
                  Idea Name *
                </Text>
              </Group>
            }
            placeholder="e.g., Project Management for Remote Teams"
            value={ideaForm.name}
            onChange={(e) => onInputChange("name", e.target.value)}
            radius="md"
            styles={{
              input: {
                backgroundColor: "#2A2A2A",
                borderColor: "#404040",
                color: "#F5F5F5",
              },
              label: { color: "#F5F5F5" },
            }}
          />

          <Textarea
            label={
              <Group gap="xs">
                <IconInfoCircle size={16} color="#006B3C" />
                <Text fw={600} c="#F5F5F5">
                  Description & Value Proposition *
                </Text>
              </Group>
            }
            placeholder="Describe what your SaaS does and what problem it solves..."
            value={ideaForm.description}
            onChange={(e) => onInputChange("description", e.target.value)}
            rows={4}
            radius="md"
            styles={{
              input: {
                backgroundColor: "#2A2A2A",
                borderColor: "#404040",
                color: "#F5F5F5",
              },
              label: { color: "#F5F5F5" },
            }}
          />

          <TextInput
            label={
              <Group gap="xs">
                <IconUser size={16} color="#006B3C" />
                <Text fw={600} c="#F5F5F5">
                  Target User
                </Text>
              </Group>
            }
            placeholder="e.g., Small business owners, Freelancers, Marketing teams"
            value={ideaForm.target_user}
            onChange={(e) => onInputChange("target_user", e.target.value)}
            radius="md"
            styles={{
              input: {
                backgroundColor: "#2A2A2A",
                borderColor: "#404040",
                color: "#F5F5F5",
              },
              label: { color: "#F5F5F5" },
            }}
          />

          <Textarea
            label={
              <Group gap="xs">
                <IconSettings size={16} color="#006B3C" />
                <Text fw={600} c="#F5F5F5">
                  Core Features
                </Text>
              </Group>
            }
            placeholder="List the main features (one per line or comma-separated)"
            value={ideaForm.core_features}
            onChange={(e) => onInputChange("core_features", e.target.value)}
            rows={3}
            radius="md"
            styles={{
              input: {
                backgroundColor: "#2A2A2A",
                borderColor: "#404040",
                color: "#F5F5F5",
              },
              label: { color: "#F5F5F5" },
            }}
          />

          <TextInput
            label={
              <Group gap="xs">
                <IconCurrencyDollar size={16} color="#006B3C" />
                <Text fw={600} c="#F5F5F5">
                  Pricing Model
                </Text>
              </Group>
            }
            placeholder="e.g., $29/month per user, Freemium, One-time purchase"
            value={ideaForm.pricing_model}
            onChange={(e) => onInputChange("pricing_model", e.target.value)}
            radius="md"
            styles={{
              input: {
                backgroundColor: "#2A2A2A",
                borderColor: "#404040",
                color: "#F5F5F5",
              },
              label: { color: "#F5F5F5" },
            }}
          />

          {/* Usage Indicator */}
          <Card
            withBorder
            radius="md"
            p="md"
            style={{ backgroundColor: "#2A2A2A", borderColor: "#404040" }}
          >
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconChartBar size={16} color="#006B3C" />
                <Text size="sm" fw={600} c="#F5F5F5">
                  Validation Credits
                </Text>
              </Group>
              <Text
                size="sm"
                fw={600}
                c={
                  getRemainingValidations() === -1
                    ? "#006B3C"
                    : getRemainingValidations() <= 5
                    ? "#FF6B6B"
                    : "#006B3C"
                }
              >
                {getRemainingValidations() === -1
                  ? "Unlimited"
                  : `${getRemainingValidations()} remaining`}
              </Text>
            </Group>
            {getCurrentPlan() && (
              <Text size="xs" c="#CCCCCC">
                {getCurrentPlan()?.display_name} plan
                {getRemainingValidations() <= 5 &&
                  getRemainingValidations() > 0 && (
                    <Text span c="#C5A46D" ml="xs">
                      • Running low on credits
                    </Text>
                  )}
              </Text>
            )}
          </Card>

          <Button
            onClick={onValidate}
            disabled={isDisabled}
            size="lg"
            radius="md"
            fullWidth
            style={{
              background: isDisabled
                ? "#666666"
                : "linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)",
              color: "#F5F5F5",
              border: "none",
            }}
            leftSection={
              isValidating ? (
                <Loader size="sm" color="#F5F5F5" />
              ) : isDisabled ? (
                <IconLock size={20} />
              ) : (
                <IconBolt size={20} />
              )
            }
          >
            {isValidating
              ? "Analyzing Against Market Data..."
              : !canValidateIdea
              ? "Upgrade Plan to Continue"
              : (!ideaForm.name.trim() || !ideaForm.description.trim())
              ? "Fill Required Fields"
              : "Validate My Idea"}
          </Button>
        </Stack>
      </Card.Section>
    </Card>
  );
}