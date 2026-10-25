import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadOnboardingQuiz } from "../../lib/onboardingQuiz";
import type { PaywallSource } from "../../lib/postAuthNavigation";

type PaywallVariant = "value" | "outcome" | "social_proof";
/** A two-line headline; `emphasis` is the part shown in Prodify orange. */
export type PaywallHeadline = { title: string; emphasis: string };

function paywallVariant(rawVariant: string | undefined): PaywallVariant {
  return rawVariant === "outcome" || rawVariant === "social_proof" ? rawVariant : "value";
}

export function usePaywallCopy(source: PaywallSource, rawVariant: string | undefined) {
  const { t } = useTranslation();
  const variant = paywallVariant(rawVariant);
  const defaultCopy = useMemo(
    () => ({
      title: t(`paywall.variants.${variant}.title`),
      emphasis: t(`paywall.variants.${variant}.emphasis`),
    }),
    [t, variant],
  );
  const [personalizedCopy, setPersonalizedCopy] = useState<PaywallHeadline | null>(null);

  const fromOnboarding = source === "onboarding";

  useEffect(() => {
    if (!fromOnboarding) return;
    let cancelled = false;
    void loadOnboardingQuiz().then((quiz) => {
      if (cancelled || !quiz?.producerGoal) return;
      setPersonalizedCopy({
        title: t(`onboarding.quiz.paywall.${quiz.producerGoal}.title`),
        emphasis: t(`onboarding.quiz.paywall.${quiz.producerGoal}.emphasis`),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fromOnboarding, t]);

  return {
    // Reached from anywhere but onboarding there is no quiz to personalise from, so the
    // generic copy wins without the personalised state having to be cleared.
    copy: (fromOnboarding ? personalizedCopy : null) ?? defaultCopy,
    previewWeeklyPrice: t("paywall.expoPreview.weeklyPricePlaceholder"),
    previewSixMonthPrice: t("paywall.expoPreview.sixMonthPricePlaceholder"),
  };
}
