import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../context/AuthContext";

export default function ProfilScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function logout() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Profil</Text>
      {user ? (
        <View style={styles.card}>
          <Text style={styles.label}>Nutzername</Text>
          <Text style={styles.value}>{user.username}</Text>
          <Text style={[styles.label, styles.mt]}>E-Mail</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
      ) : (
        <Text style={styles.body}>Profil wird geladen…</Text>
      )}

      <Pressable style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]} onPress={logout}>
        <Text style={styles.outlineBtnText}>Abmelden</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fafafa",
    marginBottom: 16,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#262626",
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  mt: {
    marginTop: 14,
  },
  value: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: "600",
    color: "#fafafa",
  },
  body: {
    fontSize: 15,
    color: "#a3a3a3",
    marginBottom: 24,
  },
  outlineBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#404040",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  outlineBtnText: {
    color: "#fafafa",
    fontWeight: "700",
    fontSize: 16,
  },
});
