import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionSetupForm } from "../../components/session/SessionSetupForm";
import { colors } from "../../constants/theme";

export default function SessionSetupScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <SessionSetupForm
        onStarted={() => router.replace("/(tabs)/dashboard")}
        onRequestClose={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
