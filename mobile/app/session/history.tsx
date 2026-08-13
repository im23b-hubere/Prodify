import { SessionHistoryView } from "../../features/sessions/components/SessionHistoryView";
import { useSessionHistoryController } from "../../features/sessions/hooks/useSessionHistoryController";

export default function SessionHistoryScreen() {
  return <SessionHistoryView controller={useSessionHistoryController()} />;
}
