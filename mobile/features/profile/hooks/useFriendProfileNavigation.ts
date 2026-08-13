import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";

import { parseProfileUserId } from "../friendProfilePresentation";

export function useFriendProfileNavigation() {
  const router = useRouter();
  const rawId = useLocalSearchParams<{ id: string | string[] }>().id;
  const userId = parseProfileUserId(rawId);

  const goBack = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.back();
  }, [router]);

  const openFriends = useCallback(() => router.push("/(tabs)/friends"), [router]);

  const openSession = useCallback(
    (sessionId: number, ownerName: string) => {
      Haptics.selectionAsync().catch(() => undefined);
      router.push({
        pathname: "/session/[id]",
        params: { id: String(sessionId), ownerName },
      } as Href);
    },
    [router],
  );

  return { userId, goBack, openFriends, openSession };
}
