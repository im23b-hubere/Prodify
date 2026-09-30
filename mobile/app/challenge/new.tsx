import { ChallengeCreateSheet } from "../../features/challengeCreate/components/ChallengeCreateSheet";
import { useChallengeCreateScreen } from "../../features/challengeCreate/hooks/useChallengeCreateScreen";
import { AppAccessGate } from "../../features/navigation/AppAccessGate";

export default function ChallengeCreateRoute() {
  return (
    <AppAccessGate>
      <ChallengeCreateScreen />
    </AppAccessGate>
  );
}

function ChallengeCreateScreen() {
  const screen = useChallengeCreateScreen();
  return <ChallengeCreateSheet screen={screen} />;
}
