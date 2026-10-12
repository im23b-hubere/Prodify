import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { AppAccessGate } from "../features/navigation/AppAccessGate";
import { BlockedUsersView } from "../features/safety/components/BlockedUsersView";
import { useBlockedUsers } from "../features/safety/hooks/useBlockedUsers";

export default function BlockedUsersRoute() {
  return (
    <AppAccessGate>
      <BlockedUsersScreen />
    </AppAccessGate>
  );
}

function BlockedUsersScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { back } = useRouter();
  const blocked = useBlockedUsers(token, t);
  return (
    <BlockedUsersView
      status={blocked.status}
      users={blocked.users}
      unblockingIds={blocked.unblockingIds}
      onRetry={() => void blocked.reload()}
      onUnblock={(user) => void blocked.unblock(user)}
      onBack={back}
    />
  );
}
