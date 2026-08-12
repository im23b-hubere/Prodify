import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadOnboardingQuiz } from "../../lib/onboardingQuiz";
import type { PaywallSource } from "../../lib/postAuthNavigation";

type PaywallVariant = "value" | "outcome" | "social_proof";

function paywallVariant(rawVariant: string | undefined): PaywallVariant {
  return rawVariant === "outcome" || rawVariant === "social_proof" ? rawVariant : "value";
}

export function usePaywallCopy(source: PaywallSource, rawVariant: string | undefined) {
  const { t } = useTranslation();
  const variant = paywallVariant(rawVariant);
  const defaultCopy = useMemo(
    () => ({
      title: t(`paywall.variants.${variant}.title`),
      body: t(`paywall.variants.${variant}.body`),
    }),
    [t, variant],
  );
  const [personalizedCopy, setPersonalizedCopy] = useState<{
    title: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    if (source !== "onboarding") {
      setPersonalizedCopy(null);
      return;
    }
    let cancelled = false;
    void loadOnboardingQuiz().then((quiz) => {
      if (cancelled || !quiz?.producerGoal) return;
      setPersonalizedCopy({
        title: t(`onboarding.quiz.paywall.${quiz.producerGoal}.title`),
        body: t(`onboarding.quiz.paywall.${quiz.producerGoal}.body`, {
          weekly: quiz.weeklyGoal ?? 7,
        }),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [source, t]);

  return {
    copy: personalizedCopy ?? defaultCopy,
    previewWeeklyPrice: t("paywall.expoPreview.weeklyPricePlaceholder"),
    previewSixMonthPrice: t("paywall.expoPreview.sixMonthPricePlaceholder"),
  };
}
