import { AppAccessGate } from "../features/navigation/AppAccessGate";
import { SettingsScreenView } from "../features/profile/components/SettingsScreenView";
import { useSettingsScreenController } from "../features/profile/hooks/useSettingsScreenController";

export default function SettingsRoute() {
  return (
    <AppAccessGate>
      <SettingsScreen />
    </AppAccessGate>
  );
}

function SettingsScreen() {
  return <SettingsScreenView controller={useSettingsScreenController()} />;
}
