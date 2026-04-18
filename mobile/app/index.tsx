import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ONBOARDING_COMPLETE_KEY } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { token, hydrated } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((v) => setOnboarded(v === "1"))
      .catch(() => setOnboarded(false));
  }, []);

  if (!hydrated || onboarded === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fafafa" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!onboarded) {
    return <Redirect href={"/onboarding" as never} />;
  }
  return <Redirect href="/(tabs)/dashboard" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
});
