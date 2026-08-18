import { WeeklyRecapView } from "../features/weeklyRecap/WeeklyRecapView";
import { useWeeklyRecapController } from "../features/weeklyRecap/useWeeklyRecapController";

export default function WeeklyRecapScreen() {
  return <WeeklyRecapView controller={useWeeklyRecapController()} />;
}
