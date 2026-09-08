import { AppAccessGate } from "../features/navigation/AppAccessGate";
import { WeeklyRecapView } from "../features/weeklyRecap/WeeklyRecapView";
import { useWeeklyRecapController } from "../features/weeklyRecap/useWeeklyRecapController";

export default function WeeklyRecapRoute() {
  return (
    <AppAccessGate>
      <WeeklyRecapScreen />
    </AppAccessGate>
  );
}

function WeeklyRecapScreen() {
  return <WeeklyRecapView controller={useWeeklyRecapController()} />;
}
