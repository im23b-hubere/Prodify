import { AppAccessGate } from "../features/navigation/AppAccessGate";
import SessionActiveScreen from "./session/active";

/** Root-level alias for `/session/active` used by deep links and the dashboard. */
export default function SessionActiveRoute() {
  return (
    <AppAccessGate>
      <SessionActiveScreen />
    </AppAccessGate>
  );
}
