import { useAuth } from "../../context/AuthContext";
import { AppAccessGate } from "../../features/navigation/AppAccessGate";
import { MainTabs } from "../../features/navigation/MainTabs";
import { useStreakForegroundSync } from "../../hooks/useStreakForegroundSync";

export default function TabsLayout() {
  const { token } = useAuth();

  useStreakForegroundSync(token);

  return (
    <AppAccessGate>
      <MainTabs />
    </AppAccessGate>
  );
}
