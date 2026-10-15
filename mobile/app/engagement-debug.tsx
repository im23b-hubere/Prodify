import { Redirect, useRouter } from "expo-router";

import { useAuth } from "../context/AuthContext";
import { EngagementDebugView } from "../features/engagement/components/EngagementDebugView";
import { useEngagementDebug } from "../features/engagement/hooks/useEngagementDebug";
import { AppAccessGate } from "../features/navigation/AppAccessGate";

export default function EngagementDebugRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <AppAccessGate>
      <EngagementDebugScreen />
    </AppAccessGate>
  );
}

function EngagementDebugScreen() {
  const { token } = useAuth();
  const { back } = useRouter();
  const { debug, status, isEvaluating, retry, evaluate } = useEngagementDebug(token);
  return (
    <EngagementDebugView
      status={status}
      debug={debug}
      isEvaluating={isEvaluating}
      onRetry={retry}
      onEvaluate={evaluate}
      onBack={back}
    />
  );
}
