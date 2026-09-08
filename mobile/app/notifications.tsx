import { AppAccessGate } from "../features/navigation/AppAccessGate";
import { NotificationInboxView } from "../features/notifications/NotificationInboxView";
import { useNotificationInbox } from "../features/notifications/useNotificationInbox";
import { useNotificationNavigation } from "../features/notifications/useNotificationNavigation";

export default function NotificationsRoute() {
  return (
    <AppAccessGate>
      <NotificationsScreen />
    </AppAccessGate>
  );
}

function NotificationsScreen() {
  const inbox = useNotificationInbox();
  const navigation = useNotificationNavigation(inbox.token);
  return (
    <NotificationInboxView
      inbox={inbox}
      onBack={navigation.goBack}
      onOpenAction={navigation.openAction}
    />
  );
}
