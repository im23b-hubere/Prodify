import { ActiveSessionView } from "../../features/sessions/components/ActiveSessionView";
import { useActiveSessionController } from "../../features/sessions/hooks/useActiveSessionController";

export default function SessionActiveScreen() {
  return <ActiveSessionView controller={useActiveSessionController()} />;
}
