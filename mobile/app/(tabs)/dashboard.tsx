import { DashboardScreenView } from "../../features/dashboard/components/DashboardScreenView";
import { useDashboardScreenController } from "../../features/dashboard/hooks/useDashboardScreenController";

export default function DashboardScreen() {
  return <DashboardScreenView controller={useDashboardScreenController()} />;
}
