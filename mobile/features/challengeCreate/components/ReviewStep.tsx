import type { TFunction } from "i18next";
import { CalendarDays, Hourglass, Pencil, Target } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "../../../constants/theme";
import { CHALLENGE_LIMITS } from "../challengeDraft";
import type { ChallengeFriendOption } from "../challengeFriends";
import { challengeCreateStyles as styles } from "../challengeCreate.styles";
import type { ChallengeDraftController } from "../hooks/useChallengeDraft";
import { ChallengeAvatar } from "./ChallengeAvatar";

const VS_AVATAR_SIZE = 84;

export type ChallengeSide = { name: string; photoUri: string | null };

type Props = {
  t: TFunction;
  controller: ChallengeDraftController;
  you: ChallengeSide;
  friend: ChallengeFriendOption;
  errorMessage: string | null;
};

export function ReviewStep({ t, controller, you, friend, errorMessage }: Props) {
  const { draft } = controller;
  return (
    <>
      <View
        style={styles.vsCard}
        accessible
        accessibilityLabel={t("challengeCreate.vsA11y", { friend: friend.username })}
      >
        <View style={styles.vsSlash} />
        <View style={styles.vsRow}>
          <VsSide name={you.name} photoUri={you.photoUri} highlighted />
          <View style={styles.vsDisc}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <VsSide name={friend.username} photoUri={friend.photoUri} />
        </View>
      </View>

      <View style={styles.chips}>
        <Chip icon={<Target size={14} color={colors.primary} />}>
          {t("challengeCreate.sessionsChip", { count: draft.targetSessions })}
        </Chip>
        <Chip icon={<CalendarDays size={14} color={colors.primary} />}>
          {t("challengeCreate.daysChip", { count: draft.durationDays })}
        </Chip>
        <Chip icon={<Hourglass size={14} color={colors.primary} />}>
          {t("challengeCreate.expiryChip")}
        </Chip>
      </View>

      <TitleEditor t={t} controller={controller} />

      {errorMessage != null ? (
        <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{errorMessage || t("challengeCreate.sendFailed")}</Text>
        </View>
      ) : null}
    </>
  );
}

function VsSide({ name, photoUri, highlighted }: ChallengeSide & { highlighted?: boolean }) {
  return (
    <View style={styles.vsSide}>
      <ChallengeAvatar
        name={name}
        photoUri={photoUri}
        size={VS_AVATAR_SIZE}
        ring={highlighted ? "accent" : "none"}
      />
      <Text style={styles.vsName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.chip}>
      {icon}
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

function TitleEditor({ t, controller }: { t: TFunction; controller: ChallengeDraftController }) {
  const { draft, dispatch, title } = controller;
  const [editing, setEditing] = useState(false);
  const finishEditing = () => {
    setEditing(false);
    if (!draft.customTitle?.trim()) dispatch({ type: "useGeneratedTitle" });
  };
  return (
    <View style={styles.titleCard}>
      <Text style={styles.sectionLabel}>{t("challengeCreate.titleLabel")}</Text>
      <View style={styles.titleRow}>
        {editing ? (
          <TextInput
            autoFocus
            value={draft.customTitle ?? title}
            onChangeText={(text) => dispatch({ type: "editTitle", title: text })}
            onBlur={finishEditing}
            onSubmitEditing={finishEditing}
            maxLength={CHALLENGE_LIMITS.maxTitleLength}
            returnKeyType="done"
            accessibilityLabel={t("challengeCreate.titleLabel")}
            selectionColor={colors.primary}
            style={styles.titleInput}
          />
        ) : (
          <Text style={styles.titleText} numberOfLines={2}>
            {title}
          </Text>
        )}
        {!editing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("challengeCreate.editTitle")}
            hitSlop={12}
            onPress={() => setEditing(true)}
          >
            <Pencil size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {draft.customTitle !== null && !editing ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => dispatch({ type: "useGeneratedTitle" })}
        >
          <Text style={styles.linkText}>{t("challengeCreate.useDefaultTitle")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
