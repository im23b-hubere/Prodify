import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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

type TrashController = ReturnType<typeof useSessionTrash>;

function SessionTrashRow({
  session,
  controller,
  t,
}: {
  session: TrashController["sessions"][number];
  controller: TrashController;
  t: TFunction;
}) {
  const restoring = controller.busyId === session.id;
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{sessionTypeLabel(String(session.session_type), t)}</Text>
        <Text style={styles.rowMeta}>{formatDate(session.started_at)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("sessionTrash.restore")}
        style={({ pressed }) => [
          styles.restoreBtn,
          pressed && styles.pressed,
          restoring && styles.disabled,
        ]}
        onPress={() => void controller.restore(session.id)}
        disabled={restoring}
      >
        <Text style={styles.restoreLabel}>
          {t(restoring ? "sessionTrash.restoring" : "sessionTrash.restore")}
        </Text>
      </Pressable>
    </View>
  );
}

function SessionTrashList({ controller, t }: { controller: TrashController; t: TFunction }) {
  return (
    <>
      {controller.sessions.map((session) => (
        <SessionTrashRow key={session.id} session={session} controller={controller} t={t} />
      ))}
      {controller.hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("sessionTrash.loadMore")}
          style={({ pressed }) => [
            styles.loadMoreBtn,
            pressed && styles.pressed,
            controller.loadingMore && styles.disabled,
          ]}
          onPress={() => void controller.loadMore()}
          disabled={controller.loadingMore}
        >
          <Text style={styles.loadMoreLabel}>
            {t(controller.loadingMore ? "sessionTrash.loadingMore" : "sessionTrash.loadMore")}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

function SessionTrashContent({
  controller,
  t,
  goBack,
}: {
  controller: TrashController;
  t: TFunction;
  goBack: () => void;
}) {
  const stableEmpty = !controller.loading && !controller.error && controller.sessions.length === 0;
  return (
    <>
      {controller.loading && !controller.refreshing ? (
        <LoadingState message={t("sessionTrash.loading")} />
      ) : null}
      {controller.error ? (
        <ErrorState
          title={t("common.oops")}
          message={controller.error}
          retryLabel={t("common.reload")}
          onRetry={controller.retry}
        />
      ) : null}
      {stableEmpty ? (
        <EmptyState
          iconNode={<Trash2 color={colors.primary} size={40} />}
          title={t("sessionTrash.emptyTitle")}
          message={t("sessionTrash.emptyBody")}
          secondaryActionLabel={t("sessionFeedback.backToDashboard")}
          onSecondaryAction={goBack}
        />
      ) : (
        <SessionTrashList controller={controller} t={t} />
      )}
    </>
  );
}

export default function SessionTrashScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const controller = useSessionTrash(token, {
    notSignedIn: t("sessionTrash.notSignedIn"),
    loadFailed: t("sessionTrash.loadFailed"),
    refreshFailed: t("sessionTrash.refreshFailed"),
    loadMoreFailed: t("sessionTrash.loadMoreFailed"),
    restoreFailed: t("sessionTrash.restoreFailed"),
  });
  const goBack = () => router.replace("/(tabs)/dashboard");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={controller.refreshing}
            onRefresh={() => void controller.refresh()}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          title={t("sessionTrash.title")}
          subtitle={t("sessionTrash.subtitle")}
          actionLabel={t("sessionFeedback.backToDashboard")}
          onActionPress={goBack}
        />
        <SessionTrashContent controller={controller} t={t} goBack={goBack} />
      </ScrollView>
    </SafeAreaView>
  );
}
