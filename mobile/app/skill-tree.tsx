import { useLocalSearchParams, useRouter } from "expo-router";

import { AppAccessGate } from "../features/navigation/AppAccessGate";
import { SkillTreeScreenView } from "../features/skills/components/SkillTreeScreenView";
import { useSkillTreeScreen } from "../features/skills/hooks/useSkillTreeScreen";

export default function SkillTreeRoute() {
  return (
    <AppAccessGate>
      <SkillTreeScreen />
    </AppAccessGate>
  );
}

function SkillTreeScreen() {
  const { back, canGoBack, replace } = useRouter();
  const { branch } = useLocalSearchParams<{ branch?: string }>();
  const screen = useSkillTreeScreen(typeof branch === "string" ? branch : undefined);
  const leave = () => {
    if (canGoBack()) back();
    else replace("/(tabs)/stats");
  };
  return <SkillTreeScreenView screen={screen} onBack={leave} />;
}
