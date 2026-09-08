import { useAuth } from "../../context/AuthContext";
import { AppAccessGate } from "../../features/navigation/AppAccessGate";
import { MainTabs } from "../../features/navigation/MainTabs";
import { useStreakReconcileOnForeground } from "../../hooks/useStreakReconcileOnForeground";

export default function TabsLayout() {
  const { token } = useAuth();

  useStreakReconcileOnForeground(token);

  return (
    <AppAccessGate>
      <MainTabs />
    </AppAccessGate>
  );
}
