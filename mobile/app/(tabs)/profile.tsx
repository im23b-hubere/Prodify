import { useFocusEffect } from "@react-navigation/native";
import { manipulateAsync, SaveFormat, type Action } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset } from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BadgeIcon } from "../../components/ui/BadgeIcon";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { AppFlame, glyphRowStyle } from "../../components/icons/ProdifyGlyphs";
import { StatCard } from "../../components/ui/StatCard";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError, apiJson, apiMultipart } from "../../lib/client";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import type { SessionStatsDto } from "../../types/session";
import type { StreakMilestonesDto } from "../../types/streak";
import type { ReliabilityScoreDto } from "../../types/friends";

function formatHours(totalSeconds: number): string {
  const h = totalSeconds / 3600;
  if (h < 10) return h.toFixed(1);
  return Math.round(h).toString();
}

function isHeicLikeAsset(uri: string, mimeType?: string | null): boolean {
  const u = uri.toLowerCase();
  if (u.includes(".heic") || u.includes(".heif")) return true;
  const m = mimeType?.toLowerCase() ?? "";
  return m.includes("heic") || m.includes("heif");
}

function extractProfilePictureErrorDetail(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const j = JSON.parse(trimmed) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail) && j.detail.length > 0) {
      const first = j.detail[0] as { msg?: unknown } | undefined;
      if (first && typeof first.msg === "string") return first.msg;
    }
  } catch {
    /* plain text */
  }
  return trimmed;
}

function shouldOfferPictureFormatHint(detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    d.includes("unsupported") ||
    d.includes("only image") ||
    d.includes("empty") ||
    d.includes("5mb") ||
    d.includes("exceeds") ||
    d.includes("too large") ||
    d.includes("format")
  );
}

const PROFILE_UPLOAD_MAX_SIDE = 1600;

function pickedMimeType(asset: ImagePickerAsset): string | null {
  if ("mimeType" in asset && typeof (asset as { mimeType?: unknown }).mimeType === "string") {
    return (asset as { mimeType: string }).mimeType;
  }
  return null;
}

/** HEIC/WEBP → JPEG; very large images downscaled so uploads stay under server limits. */
async function resolveProfilePictureUploadFile(
  asset: ImagePickerAsset,
  t: (key: string) => string,
): Promise<{ uri: string; name: string; type: string }> {
  const uri = asset.uri;
  const mimeType = pickedMimeType(asset);
  const maxSide =
    typeof asset.width === "number" && typeof asset.height === "number"
      ? Math.max(asset.width, asset.height)
      : 0;

  const heic = isHeicLikeAsset(uri, mimeType);
  const webp =
    Boolean(mimeType?.toLowerCase().includes("webp")) || uri.toLowerCase().includes(".webp");

  const needsResize = maxSide > PROFILE_UPLOAD_MAX_SIDE;
  const needsReencode = heic || webp;

  if (!needsResize && !needsReencode) {
    const ext = uri.toLowerCase().endsWith(".png") ? "png" : "jpg";
    return {
      uri,
      name: `profile.${ext}`,
      type: ext === "png" ? "image/png" : "image/jpeg",
    };
  }

  const actions: Action[] = [];
  if (needsResize && asset.width && asset.height) {
    actions.push(
      asset.width >= asset.height
        ? { resize: { width: PROFILE_UPLOAD_MAX_SIDE } }
        : { resize: { height: PROFILE_UPLOAD_MAX_SIDE } },
    );
  }

  try {
    const out = await manipulateAsync(uri, actions, {
      compress: 0.85,
      format: SaveFormat.JPEG,
    });
    return { uri: out.uri, name: "profile.jpg", type: "image/jpeg" };
  } catch {
    throw new Error(t("profile.pictureConvertFailed"));
  }
}

function ProfileSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonHero}>
        <View style={styles.skeletonAvatar} />
        <View style={[styles.skeletonLine, { width: 140, height: 18 }]} />
        <View style={[styles.skeletonLine, { width: 180, height: 12 }]} />
      </View>
      <View style={styles.skeletonGrid}>
        {[0, 1, 2, 3].map((idx) => (
          <View key={`profile-sk-${idx}`} style={styles.skeletonStat}>
            <View style={[styles.skeletonLine, { width: "55%", height: 12 }]} />
            <View style={[styles.skeletonLine, { width: "70%", height: 22 }]} />
          </View>
        ))}
      </View>
      <View style={styles.skeletonCard}>
        <View style={[styles.skeletonLine, { width: "36%", height: 14 }]} />
        <View style={[styles.skeletonLine, { width: "92%", height: 12 }]} />
        <View style={[styles.skeletonLine, { width: "84%", height: 12 }]} />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, signOut, deleteAccount, token, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [milestones, setMilestones] = useState<StreakMilestonesDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reliability, setReliability] = useState<ReliabilityScoreDto | null>(null);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pingTemplate, setPingTemplate] = useState<"test" | "session_demo" | "streak_demo">("test");
  const [avatarVersion, setAvatarVersion] = useState(0);
  const loadSeq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!token) {
      if (mounted.current) setLoading(false);
      return;
    }
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const [sr, mr, relPr] = await Promise.allSettled([
        apiJson<unknown>("/sessions/stats?period=all", { token }),
        apiJson<StreakMilestonesDto>("/streak/milestones", { token }),
        apiJson<ReliabilityScoreDto>("/users/me/reliability", { token }).catch(() => null),
      ]);
      if (!mounted.current || seq !== loadSeq.current) return;

      if (sr.status === "fulfilled") {
        setStats(tryParseSessionStatsDto(sr.value));
      } else {
        setStats(null);
      }
      if (mr.status === "fulfilled") {
        setMilestones(mr.value);
      } else {
        setMilestones(null);
      }
      const rel = relPr.status === "fulfilled" ? relPr.value : null;
      setReliability(rel);

      const errParts: string[] = [];
      if (sr.status === "rejected") {
        errParts.push(
          sr.reason instanceof Error ? sr.reason.message : t("profile.errorLoadProfile"),
        );
      }
      if (mr.status === "rejected") {
        errParts.push(
          mr.reason instanceof Error ? mr.reason.message : t("profile.errorLoadMilestones"),
        );
      }
      setError(errParts.length ? errParts.join("\n") : null);
    } catch (e) {
      if (!mounted.current || seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : t("profile.errorLoadProfile"));
      setStats(null);
      setMilestones(null);
      setReliability(null);
    } finally {
      if (!mounted.current || seq !== loadSeq.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  function confirmLogout() {
    Alert.alert(t("profile.signOutConfirmTitle"), t("profile.signOutConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.signOutConfirmButton"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            try {
              await signOut();
              router.replace("/(auth)/login");
            } catch {
              router.replace("/(auth)/login");
            }
          })();
        },
      },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(t("legal.deleteAccount.confirmTitle"), t("legal.deleteAccount.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("legal.deleteAccount.confirmDelete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteAccount();
              router.replace("/(auth)/login");
            } catch (e) {
              const msg =
                e instanceof ApiError
                  ? e.message
                  : e instanceof Error
                    ? e.message
                    : t("legal.deleteAccount.errorFallback");
              Alert.alert(t("legal.deleteAccount.errorTitle"), msg);
            }
          })();
        },
      },
    ]);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined);
  }, [load]);

  const pingPush = useCallback(async () => {
    if (!token) return;
    setPushBusy(true);
    try {
      const body =
        pingTemplate === "test"
          ? {
              template: "test" as const,
              title: t("profile.pingTestTitle"),
              body: t("profile.pingTestBody"),
            }
          : pingTemplate === "session_demo"
            ? { template: "session_demo" as const }
            : { template: "streak_demo" as const, streak_days: 12 };
      const r = await apiJson<{ attempted: number; delivered_ok: number; message?: string | null }>(
        "/notifications/ping-self",
        {
          token,
          method: "POST",
          body,
        },
      );
      Alert.alert(
        t("profile.pingResultTitle"),
        `${t("profile.pingDelivered", { ok: r.delivered_ok, attempted: r.attempted })}${r.message ? `\n${r.message}` : ""}`,
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      Alert.alert(t("profile.pingResultTitle"), msg);
    } finally {
      setPushBusy(false);
    }
  }, [pingTemplate, token, t]);

  const summary = stats?.summary;
  const showInitialLoading = loading && !refreshing && !summary && !error;
  const avatarUri = user?.profile_picture_url?.trim()
    ? user.profile_picture_url.startsWith("http")
      ? user.profile_picture_url
      : `${API_BASE_URL}${user.profile_picture_url}`
    : null;
  const avatarUriWithVersion = avatarUri
    ? `${avatarUri}${avatarUri.includes("?") ? "&" : "?"}v=${avatarVersion}`
    : null;

  const pickProfilePicture = useCallback(async () => {
    if (!token || pictureBusy) return;
    try {
      setPictureBusy(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("profile.picturePermissionTitle"), t("profile.picturePermissionMessage"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const file = await resolveProfilePictureUploadFile(asset, t);

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);

      await apiMultipart("/users/me/profile-picture", {
        method: "POST",
        token,
        formData,
        timeoutMs: 45_000,
      });
      await refreshUser().catch(() => undefined);
      setAvatarVersion((prev) => prev + 1);
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      const fallbackMessage =
        e instanceof ApiError
          ? extractProfilePictureErrorDetail(String(e.message || "")) || t("profile.pictureUploadFailed")
          : e instanceof Error
            ? e.message
            : t("profile.pictureUploadFailed");
      const userMsg = shouldOfferPictureFormatHint(fallbackMessage)
        ? t("profile.pictureUploadDetailWithHint", {
            detail: fallbackMessage,
            hint: t("profile.pictureFormatHelp"),
          })
        : fallbackMessage;
      Alert.alert(
        t("profile.pictureUploadFailedTitle"),
        userMsg,
      );
    } finally {
      setPictureBusy(false);
    }
  }, [load, pictureBusy, refreshUser, t, token]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          title={t("tabs.profile")}
          subtitle={t("profile.settingsTitle")}
          actionLabel={t("tabs.dashboard")}
          onActionPress={() => router.push("/(tabs)/dashboard")}
        />
        <View style={styles.profileHero}>
          <Pressable
            style={({ pressed }) => [styles.avatarPressable, pressed && styles.pressed]}
            onPress={() => pickProfilePicture()}
            disabled={pictureBusy}
          >
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUriWithVersion ?? avatarUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.username?.slice(0, 2).toUpperCase() ?? t("profile.defaultInitials")}
                </Text>
              )}
            </View>
            <Text style={styles.avatarHint}>
              {pictureBusy ? t("profile.pictureUploading") : t("profile.changePicture")}
            </Text>
          </Pressable>
          <Text style={styles.username}>{user?.username ?? t("profile.defaultDisplayName")}</Text>
          <Text style={styles.email}>{user?.email ?? t("profile.loadingEmail")}</Text>
        </View>

        {showInitialLoading ? <ProfileSkeleton /> : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => load().catch(() => undefined)}>
              <Text style={styles.retryText}>{t("profile.tryAgain")}</Text>
            </Pressable>
          </View>
        ) : null}

        {!showInitialLoading && summary ? (
          <View style={styles.statsGrid}>
            <StatCard label={t("profile.totalSessions")} value={summary.total_sessions} />
            <StatCard
              label={t("profile.currentStreak")}
              value={
                <View style={glyphRowStyle}>
                  <AppFlame size={18} />
                  <Text style={styles.streakStatValue}>{summary.current_streak_days}</Text>
                </View>
              }
            />
            <StatCard
              label={t("profile.bestStreak")}
              value={t("profile.bestStreakDays", { days: summary.best_streak_days })}
            />
            <StatCard label={t("profile.totalHours")} value={formatHours(summary.total_seconds)} />
          </View>
        ) : null}

        {!showInitialLoading && reliability ? (
          <View style={styles.reliabilityCard}>
            <View style={styles.reliabilityHead}>
              <Text style={styles.reliabilityLabel}>{t("profile.reliabilityTitle")}</Text>
              <Text style={styles.reliabilityTrend}>
                {reliability.trend === "up"
                  ? t("profile.reliabilityTrendUp")
                  : reliability.trend === "down"
                    ? t("profile.reliabilityTrendDown")
                    : t("profile.reliabilityTrendStable")}
              </Text>
            </View>
            <Text style={styles.reliabilityScore}>{reliability.score.toFixed(1)}/10</Text>
            <Text style={styles.reliabilityMeta}>
              {typeof reliability.rank_percent === "number"
                ? t("profile.reliabilityRank", { rank: reliability.rank_percent })
                : t("profile.reliabilityRankUnavailable")}
            </Text>
            <Text style={styles.reliabilityHint}>
              {t("profile.reliabilityHint", {
                consistency: Math.round(Number(reliability.consistency_90d) || 0),
                completion: Math.round(Number(reliability.completion_rate_90d) || 0),
              })}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t("profile.milestonesTitle")}</Text>
        {milestones ? (
          <Text style={styles.milestoneSub}>
            {t("profile.milestoneSub", { days: milestones.longest_streak_days })}
          </Text>
        ) : null}

        {!showInitialLoading && milestones ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesRow}
          >
            {milestones.milestones.map((item) => (
              <BadgeIcon key={item.days} label={item.title} unlocked={item.unlocked} />
            ))}
          </ScrollView>
        ) : null}

        {!showInitialLoading && !milestones && (!error || summary) ? (
          <Text style={styles.muted}>{t("profile.milestonesUnavailable")}</Text>
        ) : null}

        {__DEV__ ? (
          <>
            <Text style={styles.sectionTitle}>{t("profile.pushSectionTitle")}</Text>
            <Text style={styles.pushHint}>{t("profile.pushHint")}</Text>
            <View style={styles.pingChips}>
              {(
                [
                  { id: "test" as const, labelKey: "profile.pingTemplateTest" as const },
                  { id: "session_demo" as const, labelKey: "profile.pingTemplateSession" as const },
                  { id: "streak_demo" as const, labelKey: "profile.pingTemplateStreak" as const },
                ] as const
              ).map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.pingChip, pingTemplate === p.id && styles.pingChipOn]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    setPingTemplate(p.id);
                  }}
                >
                  <Text style={[styles.pingChipTxt, pingTemplate === p.id && styles.pingChipTxtOn]}>
                    {t(p.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              label={pushBusy ? t("profile.pingSending") : t("profile.pingSend")}
              onPress={pingPush}
              loading={pushBusy}
            />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t("profile.settingsTitle")}</Text>
        <View style={styles.settingsCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.manageNotifications")}
            style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            onPress={() =>
              router.push({ pathname: "/notifications", params: { source: "profile" } })
            }
          >
            <Text style={styles.legalRowText}>{t("profile.manageNotifications")}</Text>
            <Text style={styles.legalRowChevron}>›</Text>
          </Pressable>
          <View style={styles.legalDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("legal.linksPrivacy")}
            style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            onPress={() => router.push("/legal/privacy" as never)}
          >
            <Text style={styles.legalRowText}>{t("legal.linksPrivacy")}</Text>
            <Text style={styles.legalRowChevron}>›</Text>
          </Pressable>
          <View style={styles.legalDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("legal.linksTerms")}
            style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            onPress={() => router.push("/legal/terms" as never)}
          >
            <Text style={styles.legalRowText}>{t("legal.linksTerms")}</Text>
            <Text style={styles.legalRowChevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.deleteSection}>
          <Text style={styles.deleteSectionTitle}>{t("legal.deleteAccount.sectionTitle")}</Text>
          <Text style={styles.deleteDesc}>{t("legal.deleteAccount.description")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("legal.deleteAccount.button")}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            onPress={confirmDeleteAccount}
          >
            <Text style={styles.deleteBtnText}>{t("legal.deleteAccount.button")}</Text>
          </Pressable>
        </View>

        <View style={styles.signoutWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.signOut")}
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={confirmLogout}
          >
            <Text style={styles.outlineBtnText}>{t("profile.signOut")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  skeletonWrap: { gap: spacing.md, marginBottom: spacing.md },
  skeletonHero: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  skeletonAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  skeletonStat: {
    width: "48%",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  skeletonCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonLine: {
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  profileHero: { alignItems: "center", marginBottom: spacing.lg },
  avatarPressable: {
    alignItems: "center",
    gap: spacing.xs,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#2b2140",
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  avatarHint: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  username: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  email: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  loadingBlock: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingHint: { color: colors.textSecondary, ...typography.caption },
  inlineLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  inlineLoadingText: { color: colors.textSecondary, ...typography.caption },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,80,80,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.25)",
    marginBottom: spacing.md,
  },
  errorText: { color: "#ff9a9a", ...typography.caption, marginBottom: spacing.sm },
  retry: { alignSelf: "flex-start", paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  retryText: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  streakStatValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  reliabilityCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  reliabilityHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reliabilityLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  reliabilityTrend: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  reliabilityScore: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
  },
  reliabilityMeta: {
    color: colors.textPrimary,
    ...typography.body,
  },
  reliabilityHint: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  milestoneSub: {
    color: colors.textSecondary,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  pushHint: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  pingChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  pingChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pingChipOn: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.12)" },
  pingChipTxt: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  pingChipTxtOn: { color: colors.textPrimary },
  muted: { color: colors.textSecondary, ...typography.caption, marginBottom: spacing.sm },
  badgesRow: {
    gap: spacing.sm,
  },
  settingsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  legalRowText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.body,
  },
  legalRowChevron: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: "300",
  },
  legalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  deleteSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  deleteSectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.subheadline,
  },
  deleteDesc: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 20,
  },
  deleteBtn: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.45)",
    backgroundColor: "rgba(255,80,80,0.08)",
  },
  deleteBtnText: {
    color: "#ff9a9a",
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  signoutWrap: {
    marginTop: spacing.sm,
  },
  outlineBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  outlineBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
});
