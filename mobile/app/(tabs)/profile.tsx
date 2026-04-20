import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
import { StatCard } from "../../components/ui/StatCard";
import { API_BASE_URL } from "../../constants/api";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError, apiJson } from "../../lib/client";
import { tryParseSessionStatsDto } from "../../lib/statsDto";
import type { SessionStatsDto } from "../../types/session";
import type { StreakMilestonesDto } from "../../types/streak";

function formatHours(totalSeconds: number): string {
  const h = totalSeconds / 3600;
  if (h < 10) return h.toFixed(1);
  return Math.round(h).toString();
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, signOut, deleteAccount, token } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatsDto | null>(null);
  const [milestones, setMilestones] = useState<StreakMilestonesDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pingTemplate, setPingTemplate] = useState<"test" | "session_demo" | "streak_demo">("test");
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
      const [rawS, m] = await Promise.all([
        apiJson<unknown>("/sessions/stats?period=all", { token }),
        apiJson<StreakMilestonesDto>("/streak/milestones", { token }),
      ]);
      if (!mounted.current || seq !== loadSeq.current) return;
      setStats(tryParseSessionStatsDto(rawS));
      setMilestones(m);
    } catch (e) {
      if (!mounted.current || seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : t("profile.errorLoadProfile"));
      setStats(null);
      setMilestones(null);
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

  async function logout() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    await signOut();
    router.replace("/(auth)/login");
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
  const avatarUri = user?.profile_picture_url?.trim()
    ? user.profile_picture_url.startsWith("http")
      ? user.profile_picture_url
      : `${API_BASE_URL}${user.profile_picture_url}`
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
      const ext = asset.uri.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: `profile.${ext}`,
        type: ext === "png" ? "image/png" : "image/jpeg",
      } as unknown as Blob);

      const res = await fetch(`${API_BASE_URL}/users/me/profile-picture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || t("profile.pictureUploadFailed"));
      }
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      Alert.alert(
        t("profile.pictureUploadFailedTitle"),
        e instanceof Error ? e.message : t("profile.pictureUploadFailed"),
      );
    } finally {
      setPictureBusy(false);
    }
  }, [load, pictureBusy, t, token]);

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
        <View style={styles.profileHero}>
          <Pressable
            style={({ pressed }) => [styles.avatarPressable, pressed && styles.pressed]}
            onPress={() => pickProfilePicture()}
            disabled={pictureBusy}
          >
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
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

        {loading && !refreshing ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingHint}>{t("profile.loadingHint")}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => load().catch(() => undefined)}>
              <Text style={styles.retryText}>{t("profile.tryAgain")}</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && summary ? (
          <View style={styles.statsGrid}>
            <StatCard label={t("profile.totalSessions")} value={summary.total_sessions} />
            <StatCard
              label={t("profile.currentStreak")}
              value={`🔥 ${summary.current_streak_days}`}
            />
            <StatCard
              label={t("profile.bestStreak")}
              value={t("profile.bestStreakDays", { days: summary.best_streak_days })}
            />
            <StatCard label={t("profile.totalHours")} value={formatHours(summary.total_seconds)} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t("profile.milestonesTitle")}</Text>
        {milestones ? (
          <Text style={styles.milestoneSub}>
            {t("profile.milestoneSub", { days: milestones.longest_streak_days })}
          </Text>
        ) : null}

        {!loading && milestones ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesRow}
          >
            {milestones.milestones.map((item) => (
              <BadgeIcon key={item.days} label={item.title} unlocked={item.unlocked} />
            ))}
          </ScrollView>
        ) : null}

        {!loading && !milestones && !error ? (
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
            onPress={logout}
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
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
