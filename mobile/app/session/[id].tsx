import { SessionDetailView } from "../../features/sessions/components/SessionDetailView";
import { useSessionDetailController } from "../../features/sessions/hooks/useSessionDetailController";

export default function SessionDetailScreen() {
  return <SessionDetailView controller={useSessionDetailController()} />;
}
