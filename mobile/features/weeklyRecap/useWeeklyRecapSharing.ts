import * as Sharing from "expo-sharing";
import type { TFunction } from "i18next";
import { useCallback, useRef, useState } from "react";
import { Share } from "react-native";
import ViewShot from "react-native-view-shot";

import type { WeeklyReviewDto } from "../../types/outcomes";
import type { SessionStatsDto } from "../../types/session";
import { buildWeeklySharePayload } from "./weeklyRecapPresentation";
import type { WeeklyShareTemplateId } from "./WeeklyWrappedShareCard";

export function useWeeklyRecapSharing({
  t,
  review,
  stats,
  displaySessions,
  displayHours,
}: {
  t: TFunction;
  review: WeeklyReviewDto | null;
  stats: SessionStatsDto | null;
  displaySessions: number;
  displayHours: string;
}) {
  const [shareBusy, setShareBusy] = useState(false);
  const [shareTemplate, setShareTemplate] = useState<WeeklyShareTemplateId>("gradient");
  const shotRef = useRef<ViewShot | null>(null);
  const shareText = useCallback(() => {
    const payload = buildWeeklySharePayload(t, review, stats, displaySessions, displayHours);
    Share.share(payload.url ? payload : { message: payload.message }).catch(() => undefined);
  }, [displayHours, displaySessions, review, stats, t]);
  const shareCard = useCallback(async () => {
    if (!(stats?.summary || review) || shareBusy) return;
    setShareBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const uri = await shotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: t("weeklyRecap.shareDialogTitle"),
        });
      } else shareText();
    } finally {
      setShareBusy(false);
    }
  }, [review, shareBusy, shareText, stats?.summary, t]);
  return { shareBusy, shareTemplate, shotRef, setShareTemplate, shareText, shareCard };
}
