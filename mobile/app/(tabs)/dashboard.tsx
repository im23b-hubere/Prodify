import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
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

function getLocalDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, delta: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + delta);
  return next;
}

function getStreakData(sessions: SessionDto[]) {
  const dayKeys = Array.from(new Set(sessions.map((session) => getLocalDateKey(session.started_at)))).sort();

  if (dayKeys.length === 0) {
    return { current: 0, best: 0 };
  }

  const keySet = new Set(dayKeys);
  const today = new Date();
  const todayKey = getLocalDateKey(today);
  const yesterdayKey = getLocalDateKey(addDays(today, -1));

  let current = 0;
  if (keySet.has(todayKey) || keySet.has(yesterdayKey)) {
    let cursor = keySet.has(todayKey) ? new Date(today) : addDays(today, -1);
    while (keySet.has(getLocalDateKey(cursor))) {
      current += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < dayKeys.length; i += 1) {
    const prev = new Date(`${dayKeys[i - 1]}T12:00:00`);
    const currentDay = new Date(`${dayKeys[i]}T12:00:00`);
    const diffDays = Math.round((currentDay.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }

  return { current, best };
}

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [active, setActive] = useState<SessionDto | null>(null);
  const [notes, setNotes] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const streak = getStreakData(sessions);

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

  const renderSessionItem: ListRenderItem<SessionDto> = ({ item }) => (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>Session #{item.id}</Text>
      <Text style={styles.rowMeta}>
        {item.stopped_at ? `${Math.round((item.duration_seconds ?? 0) / 60)} min` : "laeuft..."}
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.streakCard}>
        <View>
          <Text style={styles.streakEyebrow}>Dein Streak</Text>
          <Text style={styles.streakValue}>{streak.current} Tage</Text>
          <Text style={styles.streakHint}>
            {streak.current > 0 ? "Bleib dran - heute zaehlt." : "Starte heute deinen ersten Run."}
          </Text>
        </View>
        <View style={styles.flameWrap}>
          <Text style={styles.flame}>🔥</Text>
        </View>
      </View>

      <View style={styles.streakMetaRow}>
        <View style={styles.streakMetaCard}>
          <Text style={styles.streakMetaLabel}>Bester Streak</Text>
          <Text style={styles.streakMetaValue}>{streak.best} Tage</Text>
        </View>
        <View style={styles.streakMetaCard}>
          <Text style={styles.streakMetaLabel}>Sessions</Text>
          <Text style={styles.streakMetaValue}>{sessions.length}</Text>
        </View>
      </View>

      <Text style={styles.greeting}>Hallo{user ? `, ${user.username}` : ""}</Text>
      <Text style={styles.lead}>Tracke deine Produktion heute.</Text>

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
        renderItem={renderSessionItem}
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
  streakCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#2f2f2f",
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  streakEyebrow: {
    fontSize: 13,
    color: "#a3a3a3",
    fontWeight: "600",
    marginBottom: 6,
  },
  streakValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fafafa",
    letterSpacing: -0.8,
  },
  streakHint: {
    marginTop: 4,
    color: "#d4d4d4",
    fontSize: 14,
  },
  flameWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#404040",
  },
  flame: {
    fontSize: 32,
  },
  streakMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  streakMetaCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#242424",
  },
  streakMetaLabel: {
    color: "#8f8f8f",
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "600",
  },
  streakMetaValue: {
    color: "#f5f5f5",
    fontSize: 20,
    fontWeight: "800",
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
