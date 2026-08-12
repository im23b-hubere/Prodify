import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { updateChallenge } from "../../../lib/social";
import type { SocialChallengeDto } from "../../../types/friends";
import { parseChallengeEditDraft } from "../challengeEditDraft";

type SetChallenge = (challenge: SocialChallengeDto | null) => void;

export function useChallengeEdit(
  token: string | null | undefined,
  challengeId: number | null,
  challenge: SocialChallengeDto | null,
  setChallenge: SetChallenge,
) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTarget, setEditTarget] = useState("5");
  const [editDuration, setEditDuration] = useState("7");
  const [editBusy, setEditBusy] = useState(false);

  const openEdit = useCallback(() => {
    if (!challenge) return;
    setEditTitle(challenge.title);
    setEditTarget(String(challenge.target_sessions));
    setEditDuration(String(challenge.duration_days ?? 7));
    setEditOpen(true);
  }, [challenge]);
  const closeEdit = useCallback(() => setEditOpen(false), []);

  const submitEdit = useCallback(async () => {
    if (!token || challengeId == null) return;
    const draft = parseChallengeEditDraft(editTitle, editTarget, editDuration);
    if (!draft) {
      Alert.alert(
        t("friendsScreen.invalidChallengeTitle"),
        t("friendsScreen.invalidChallengeBody"),
      );
      return;
    }
    setEditBusy(true);
    try {
      setChallenge(await updateChallenge(token, challengeId, draft));
      setEditOpen(false);
    } catch (updateError) {
      Alert.alert(
        t("friendsScreen.couldNotUpdateChallenge"),
        updateError instanceof Error ? updateError.message : t("common.tryAgain"),
      );
    } finally {
      setEditBusy(false);
    }
  }, [challengeId, editDuration, editTarget, editTitle, setChallenge, t, token]);

  return {
    editOpen,
    closeEdit,
    openEdit,
    editTitle,
    setEditTitle,
    editTarget,
    setEditTarget,
    editDuration,
    setEditDuration,
    editBusy,
    submitEdit,
  };
}
