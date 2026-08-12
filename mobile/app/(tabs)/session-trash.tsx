import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useSessionTrash } from "../../features/sessions/hooks/useSessionTrash";
import { styles } from "../../features/sessions/sessionTrash.styles";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { ScreenHeader } from "../../components/ui/ScreenHeader";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SessionTrashScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const {
    sessions,
    refreshing,
    busyId,
    error,
    loading,
    hasMore,
    loadingMore,
    refresh,
    loadMore,
    restore,
    retry,
  } = useSessionTrash(token, {
    notSignedIn: t("sessionTrash.notSignedIn"),
    loadFailed: t("sessionTrash.loadFailed"),
    refreshFailed: t("sessionTrash.refreshFailed"),
    loadMoreFailed: t("sessionTrash.loadMoreFailed"),
    restoreFailed: t("sessionTrash.restoreFailed"),
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          title={t("sessionTrash.title")}
          subtitle={t("sessionTrash.subtitle")}
          actionLabel={t("sessionFeedback.backToDashboard")}
          onActionPress={() => router.replace("/(tabs)/dashboard")}
        />
        {loading && !refreshing ? <LoadingState message={t("sessionTrash.loading")} /> : null}

        {error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.reload")}
            onRetry={retry}
          />
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <EmptyState
            iconNode={<Trash2 color={colors.primary} size={40} />}
            title={t("sessionTrash.emptyTitle")}
            message={t("sessionTrash.emptyBody")}
            secondaryActionLabel={t("sessionFeedback.backToDashboard")}
            onSecondaryAction={() => router.replace("/(tabs)/dashboard")}
          />
        ) : (
          <>
            {sessions.map((session) => (
              <View key={session.id} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>
                    {sessionTypeLabel(String(session.session_type), t)}
                  </Text>
                  <Text style={styles.rowMeta}>{formatDate(session.started_at)}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.restoreBtn,
                    pressed && styles.pressed,
                    busyId === session.id && styles.disabled,
                  ]}
                  onPress={() => void restore(session.id)}
                  disabled={busyId === session.id}
                >
                  <Text style={styles.restoreLabel}>
                    {busyId === session.id
                      ? t("sessionTrash.restoring")
                      : t("sessionTrash.restore")}
                  </Text>
                </Pressable>
              </View>
            ))}
            {hasMore ? (
              <Pressable
                style={({ pressed }) => [
                  styles.loadMoreBtn,
                  pressed && styles.pressed,
                  loadingMore && styles.disabled,
                ]}
                onPress={() => void loadMore()}
                disabled={loadingMore}
              >
                <Text style={styles.loadMoreLabel}>
                  {loadingMore ? t("sessionTrash.loadingMore") : t("sessionTrash.loadMore")}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
