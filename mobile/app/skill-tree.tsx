import { useLocalSearchParams, useRouter } from "expo-router";

import { AppAccessGate } from "../features/navigation/AppAccessGate";
import { returnTo } from "../lib/stackNavigation";
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
  const router = useRouter();
  const { branch } = useLocalSearchParams<{ branch?: string }>();
  const screen = useSkillTreeScreen(typeof branch === "string" ? branch : undefined);
  const leave = () => returnTo(router, "/(tabs)/stats");
  return <SkillTreeScreenView screen={screen} onBack={leave} />;
}
