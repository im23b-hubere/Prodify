import { OnboardingIntro } from "../../features/onboarding/components/OnboardingIntro";
import { OnboardingQuizSteps } from "../../features/onboarding/components/OnboardingQuizSteps";
import { useOnboardingPresentation } from "../../features/onboarding/hooks/useOnboardingPresentation";
import { useOnboardingWorkflow } from "../../features/onboarding/hooks/useOnboardingWorkflow";

export default function OnboardingScreen() {
  const workflow = useOnboardingWorkflow();
  const presentation = useOnboardingPresentation(workflow.answers, workflow.weeklyGoal);

  if (workflow.step === "intro") {
    return <OnboardingIntro workflow={workflow} slides={presentation.introSlides} />;
  }
  return <OnboardingQuizSteps workflow={workflow} presentation={presentation} />;
}
