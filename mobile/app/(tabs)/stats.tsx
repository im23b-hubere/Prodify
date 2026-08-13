import { StatsScreenView } from "../../features/stats/components/StatsScreenView";
import { useStatsScreenController } from "../../features/stats/hooks/useStatsScreenController";

export default function StatsScreen() {
  return <StatsScreenView controller={useStatsScreenController()} />;
}
