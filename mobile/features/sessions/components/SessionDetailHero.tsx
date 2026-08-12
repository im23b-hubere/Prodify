import { LinearGradient } from "expo-linear-gradient";
import { Share2, UserRound } from "lucide-react-native";
import type { TFunction } from "i18next";
import { Pressable, Share, Text, View } from "react-native";

import { colors } from "../../../constants/theme";
import { sessionTypeLabel } from "../../../lib/sessionI18n";
import type { SessionDto } from "../../../types/session";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { styles } from "./SessionDetailHero.styles";

type Props = {
  t: TFunction;
  session: SessionDto;
  durationLabel: string;
  dateLine: string;
  isOwnSession: boolean;
  isActiveSession: boolean;
  producerDisplayName: string;
  focusScore: number | null;
  trackOutcomeLabel: string | null;
  onShareStory: () => void;
  onResumeActive: () => void;
  onOpenProfile: () => void;
};

function HeroBadges({
  t,
  isOwnSession,
  focusScore,
}: Pick<Props, "t" | "isOwnSession" | "focusScore">) {
  return (
    <View style={styles.badgeRow}>
      <View style={isOwnSession ? styles.ownBadge : styles.friendBadge}>
        <Text style={isOwnSession ? styles.ownBadgeText : styles.friendBadgeText}>
          {t(isOwnSession ? "sessionDetail.yourSessionBadge" : "sessionDetail.friendSessionBadge")}
        </Text>
      </View>
      {focusScore != null && focusScore > 0 ? (
        <View style={styles.focusBadge}>
          <Text style={styles.focusBadgeText}>
            {t("sessionDetail.focusBadge", { score: focusScore })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TrackOutcome({ session, label }: { session: SessionDto; label: string | null }) {
  if (!label) return null;
  const title = session.track_title?.trim();
  return (
    <View style={styles.trackBlock}>
      <Text style={styles.trackLabel}>{label}</Text>
      {title ? <Text style={styles.trackTitle}>{title}</Text> : null}
    </View>
  );
}

function ProducerLink({
  t,
  producerDisplayName,
  onOpenProfile,
}: Pick<Props, "t" | "producerDisplayName" | "onOpenProfile">) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t("sessionDetail.viewProfileA11y", { name: producerDisplayName })}
      style={({ pressed }) => [styles.producerLink, pressed && { opacity: 0.88 }]}
      onPress={onOpenProfile}
    >
      <UserRound color={colors.secondary} size={16} />
      <View style={styles.producerCopy}>
        <Text style={styles.producerName}>
          {t("sessionDetail.byProducer", { name: producerDisplayName })}
        </Text>
        <Text style={styles.producerCta}>{t("sessionDetail.viewProfile")}</Text>
      </View>
    </Pressable>
  );
}

function HeroShareActions({
  t,
  typeLabel,
  durationLabel,
  onShareStory,
}: Pick<Props, "t" | "durationLabel" | "onShareStory"> & { typeLabel: string }) {
  const shareText = () => {
    const message = t("sessionDetail.shareSessionMessage", {
      type: typeLabel,
      duration: durationLabel,
    });
    Share.share({ message }).catch(() => undefined);
  };
  return (
    <View style={styles.actionRow}>
      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          styles.actionBtnPrimary,
          pressed && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("sessionDetail.shareSessionImage")}
        onPress={onShareStory}
      >
        <Share2 color="#fff" size={16} />
        <Text style={styles.actionBtnPrimaryText}>{t("sessionDetail.shareSessionImage")}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
        accessibilityLabel={t("sessionDetail.shareSession")}
        onPress={shareText}
      >
        <Text style={styles.actionBtnText}>{t("sessionDetail.shareSession")}</Text>
      </Pressable>
    </View>
  );
}

export function SessionDetailHero(props: Props) {
  const {
    t,
    session,
    durationLabel,
    dateLine,
    isOwnSession,
    isActiveSession,
    producerDisplayName,
    focusScore,
    trackOutcomeLabel,
    onShareStory,
    onResumeActive,
    onOpenProfile,
  } = props;
  const typeLabel = sessionTypeLabel(String(session.session_type), t);

  return (
    <LinearGradient
      colors={["#3d1510", "#1a1010", "#0f0f0f"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      testID="session-detail-hero"
    >
      <HeroBadges t={t} isOwnSession={isOwnSession} focusScore={focusScore} />

      <Text style={styles.typeLabel}>{typeLabel}</Text>
      <Text style={styles.duration}>{durationLabel}</Text>
      <Text style={styles.meta}>{dateLine}</Text>

      <TrackOutcome session={session} label={trackOutcomeLabel} />

      {isActiveSession ? (
        <View style={styles.activeWrap} testID="session-detail-return-active">
          <PrimaryButton label={t("sessionDetail.returnToActive")} onPress={onResumeActive} />
        </View>
      ) : null}

      {!isOwnSession ? (
        <ProducerLink
          t={t}
          producerDisplayName={producerDisplayName}
          onOpenProfile={onOpenProfile}
        />
      ) : null}

      {!isActiveSession ? (
        <HeroShareActions
          t={t}
          typeLabel={typeLabel}
          durationLabel={durationLabel}
          onShareStory={onShareStory}
        />
      ) : null}
    </LinearGradient>
  );
}
