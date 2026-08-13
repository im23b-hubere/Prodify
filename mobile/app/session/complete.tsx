import { SessionCompleteView } from "../../features/sessions/components/SessionCompleteView";
import { useSessionCompleteController } from "../../features/sessions/hooks/useSessionCompleteController";

export default function SessionCompleteScreen() {
  return <SessionCompleteView controller={useSessionCompleteController()} />;
}
