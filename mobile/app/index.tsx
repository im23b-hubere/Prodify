import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { token, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fafafa" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
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
