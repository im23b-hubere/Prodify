import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { ONBOARDING_COMPLETE_KEY } from "../../constants/storageKeys";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";

const GOALS = [3, 5, 7, 10, 14] as const;

export default function OnboardingScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<number>(7);
  const [busy, setBusy] = useState(false);

  const slides = useMemo(
    () => [
      {
        title: "Track every session",
        body: "Time your studio work with clarity — type, mood, tags, and streak-aware focus.",
      },
      {
        title: "Build your streak",
        body: "Daily momentum beats motivation spikes. We will guard your chain with smart reminders.",
      },
      {
        title: "Beat your friends",
        body: "Leaderboards and activity keep you accountable — produce like it is a sport.",
      },
    ],
    []
  );

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      if (token) {
        try {
          await apiJson("/goals/set", {
            token,
            method: "POST",
            body: { goal_type: "weekly_sessions", target_value: goal },
          });
        } catch {
          /* goal sync is best-effort */
        }
      }
      try {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
      } catch {
        /* Expo Go / mismatched native module: still continue to app */
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.replace("/(tabs)/dashboard");
    } finally {
      setBusy(false);
    }
  }, [goal, router, token]);

  const requestNotif = useCallback(async () => {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync();
      await finish();
    } finally {
      setBusy(false);
    }
  }, [finish]);

  if (step < 3) {
    const s = slides[step];
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              setStep(3);
            }}
          >
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
          <Text style={styles.dots}>
            {step + 1}/{slides.length}
          </Text>
        </View>
        <View style={styles.slide}>
          <Text style={styles.heroTitle}>{s.title}</Text>
          <Text style={styles.heroBody}>{s.body}</Text>
        </View>
        <PrimaryButton
          label={step === slides.length - 1 ? "Continue" : "Next"}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            setStep((x) => x + 1);
          }}
        />
      </SafeAreaView>
    );
  }

  if (step === 3) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heroTitle}>Weekly session goal</Text>
          <Text style={styles.heroBody}>Pick a target you can defend. You can change this anytime.</Text>
          <View style={styles.goalRow}>
            {GOALS.map((g) => (
              <Pressable
                key={g}
                style={[styles.goalChip, goal === g && styles.goalChipOn]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setGoal(g);
                }}
              >
                <Text style={[styles.goalTxt, goal === g && styles.goalTxtOn]}>{g}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label="Continue" onPress={() => setStep(4)} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.slide}>
        <Text style={styles.heroTitle}>Stay in the loop</Text>
        <Text style={styles.heroBody}>
          Enable notifications for streak protection — we will ping you before the day slips away.
        </Text>
      </View>
      <PrimaryButton label="Enable notifications" onPress={requestNotif} loading={busy} />
      <Pressable style={styles.secondaryBtn} onPress={finish} disabled={busy}>
        <Text style={styles.secondaryTxt}>Not now</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "space-between" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skip: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  dots: { color: colors.textSecondary, ...typography.caption },
  slide: { flex: 1, justifyContent: "center", gap: spacing.md },
  heroTitle: { color: colors.textPrimary, fontFamily: fontFamily.heading, fontSize: 32, lineHeight: 38 },
  heroBody: { color: colors.textSecondary, ...typography.body, lineHeight: 22 },
  scroll: { gap: spacing.lg, paddingBottom: spacing.xxl },
  goalRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  goalChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  goalChipOn: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.15)" },
  goalTxt: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold },
  goalTxtOn: { color: colors.textPrimary },
  secondaryBtn: { alignItems: "center", paddingVertical: spacing.md },
  secondaryTxt: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.body },
});
