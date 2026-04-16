import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import type { SessionDto } from "../../types/session";

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [active, setActive] = useState<SessionDto | null>(null);
  const [notes, setNotes] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const list = await apiJson<SessionDto[]>("/sessions/list", { token });
    setSessions(list);
    const open = list.find((s) => s.stopped_at === null) ?? null;
    setActive(open);
  }, [token]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Laden fehlgeschlagen"));
  }, [load]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
    } finally {
      setRefreshing(false);
    }
  }, [load, token]);

  async function startSession() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = notes.trim() ? { notes: notes.trim() } : {};
      await apiJson<SessionDto>("/sessions/start", { token, method: "POST", body });
      setNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function stopSession() {
    if (!token || !active || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiJson<SessionDto>("/sessions/stop", {
        token,
        method: "POST",
        body: { session_id: active.id },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stopp fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.greeting}>Hallo{user ? `, ${user.username}` : ""}</Text>
      <Text style={styles.lead}>Produktionssession starten oder beenden.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.panel}>
        {active ? (
          <>
            <Text style={styles.activeLabel}>Laufende Session</Text>
            <Text style={styles.mono}>#{active.id} · seit {new Date(active.started_at).toLocaleString()}</Text>
            <Pressable
              style={({ pressed }) => [styles.dangerBtn, pressed && styles.btnPressed, busy && styles.btnDisabled]}
              onPress={stopSession}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fafafa" /> : <Text style={styles.dangerBtnText}>Session stoppen</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Notizen (optional)"
              placeholderTextColor="#737373"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, busy && styles.btnDisabled]}
              onPress={startSession}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#0a0a0a" />
              ) : (
                <Text style={styles.primaryBtnText}>Session starten</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Letzte Sessions</Text>
      <FlatList
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fafafa" />}
        ListEmptyComponent={
          <Text style={styles.empty}>Noch keine Sessions — starte deine erste.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Session #{item.id}</Text>
            <Text style={styles.rowMeta}>
              {item.stopped_at
                ? `${Math.round((item.duration_seconds ?? 0) / 60)} min`
                : "läuft…"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fafafa",
  },
  lead: {
    marginTop: 6,
    fontSize: 15,
    color: "#a3a3a3",
    marginBottom: 16,
  },
  error: {
    color: "#f87171",
    marginBottom: 12,
  },
  panel: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#262626",
    marginBottom: 20,
  },
  activeLabel: {
    color: "#86efac",
    fontWeight: "700",
    marginBottom: 6,
  },
  mono: {
    color: "#a3a3a3",
    fontSize: 13,
    marginBottom: 16,
  },
  input: {
    minHeight: 72,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: "#fafafa",
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    textAlignVertical: "top",
    marginBottom: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  primaryBtnText: {
    fontWeight: "700",
    color: "#0a0a0a",
    fontSize: 16,
  },
  dangerBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#7f1d1d",
  },
  dangerBtnText: {
    fontWeight: "700",
    color: "#fecaca",
    fontSize: 16,
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fafafa",
    marginBottom: 10,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#262626",
  },
  rowTitle: {
    color: "#fafafa",
    fontWeight: "600",
  },
  rowMeta: {
    color: "#737373",
    marginTop: 4,
    fontSize: 13,
  },
  empty: {
    color: "#737373",
    fontSize: 15,
    marginTop: 8,
  },
});
