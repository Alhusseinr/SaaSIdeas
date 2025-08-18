"use client";

import { useState } from "react";
import { Grid, Stack } from "@mantine/core";
import { supabase, invokeEdgeFunction } from "@/lib/supabase";
import { usePricingActions } from "@/contexts/PricingContext";
import { ValidatorHeader } from "./IdeaValidator/ValidatorHeader";
import { ValidationForm } from "./IdeaValidator/ValidationForm";
import { ValidationResults } from "./IdeaValidator/ValidationResults";
import { LoadingState } from "./IdeaValidator/LoadingState";
import { ErrorState } from "./IdeaValidator/ErrorState";
import { EmptyState } from "./IdeaValidator/EmptyState";

interface ValidationResult {
  score: number;
  rationale: string;
  market_evidence: string[];
  competition_level: string;
  recommendations: string[];
  similar_complaints: number;
  keyword_matches: string[];
}

export default function IdeaValidator() {
  const {
    canValidateIdea,
    recordUsage,
    getRemainingValidations,
    getCurrentPlan,
  } = usePricingActions();
  const [ideaForm, setIdeaForm] = useState({
    name: "",
    description: "",
    target_user: "",
    core_features: "",
    pricing_model: "",
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [error, setError] = useState("");

  const handleInputChange = (field: string, value: string) => {
    setIdeaForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateIdea = async () => {
    if (!ideaForm.name.trim() || !ideaForm.description.trim()) {
      setError("Please provide at least an idea name and description");
      return;
    }

    // Check if user can validate ideas (has remaining quota)
    if (!canValidateIdea) {
      setError(
        "You have reached your monthly validation limit. Please upgrade your plan to continue."
      );
      return;
    }

    setIsValidating(true);
    setError("");
    setValidationResult(null);

    try {
      // Call the validation edge function
      const result = await invokeEdgeFunction("validate-idea", {
        idea: ideaForm,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Record the usage
      await recordUsage("idea_validation", 1, {
        idea_name: ideaForm.name,
        target_user: ideaForm.target_user,
        validation_score: result.validation?.score,
      });

      setValidationResult(result.validation);
    } catch (err: any) {
      setError(err.message || "Failed to validate idea");
    } finally {
      setIsValidating(false);
    }
  };

  const clearForm = () => {
    setIdeaForm({
      name: "",
      description: "",
      target_user: "",
      core_features: "",
      pricing_model: "",
    });
    setValidationResult(null);
    setError("");
  };

  const hasFormData = Boolean(ideaForm.name || ideaForm.description || validationResult);

  return (
    <Stack gap="xl">
      <ValidatorHeader hasFormData={hasFormData} onClearForm={clearForm} />

      <Grid>
        <Grid.Col span={{ base: 12 }}>
          <ValidationForm
            ideaForm={ideaForm}
            onInputChange={handleInputChange}
            onValidate={validateIdea}
            isValidating={isValidating}
            canValidateIdea={canValidateIdea}
            getCurrentPlan={getCurrentPlan}
            getRemainingValidations={getRemainingValidations}
          />
        </Grid.Col>

        {(validationResult || error || isValidating) && (
          <Grid.Col span={{ base: 12 }}>
            <Stack gap="md">
              {error && <ErrorState error={error} />}
              {isValidating && <LoadingState />}
              {validationResult && (
                <ValidationResults validationResult={validationResult} />
              )}
            </Stack>
          </Grid.Col>
        )}

        {!validationResult && !error && !isValidating && (
          <Grid.Col span={{ base: 12 }}>
            <EmptyState />
          </Grid.Col>
        )}
      </Grid>
    </Stack>
  );
}
