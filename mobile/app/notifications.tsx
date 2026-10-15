import { AppAccessGate } from "../features/navigation/AppAccessGate";
import { NotificationInboxView } from "../features/notifications/NotificationInboxView";
import { useNotificationInbox } from "../features/notifications/useNotificationInbox";
import { useNotificationNavigation } from "../features/notifications/useNotificationNavigation";
import { useNotificationPreferences } from "../features/notifications/useNotificationPreferences";

export default function NotificationsRoute() {
  return (
    <AppAccessGate>
      <NotificationsScreen />
    </AppAccessGate>
  );
}

function NotificationsScreen() {
  const inbox = useNotificationInbox();
  const preferences = useNotificationPreferences(inbox.token);
  const navigation = useNotificationNavigation(inbox.token);
  return (
    <NotificationInboxView
      inbox={inbox}
      preferences={preferences}
      onBack={navigation.goBack}
      onOpenAction={navigation.openAction}
    />
  );
}
