import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionSetupForm } from "../../components/session/SessionSetupForm";
import { CrashBoundary } from "../../components/ui/CrashBoundary";
import { colors } from "../../constants/theme";

export default function SessionSetupScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <CrashBoundary
        scope="session_setup_screen"
        fallbackTitle="Session setup failed"
        fallbackMessage="Please go back and open setup again."
        onRecover={() => router.back()}
      >
        <SessionSetupForm
          onStarted={() => router.replace("/(tabs)/dashboard")}
          onRequestClose={() => router.back()}
        />
      </CrashBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
