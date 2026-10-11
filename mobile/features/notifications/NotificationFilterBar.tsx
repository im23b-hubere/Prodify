import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { NotificationCategory } from "../../lib/notificationInbox";
import { notificationStyles as styles } from "./notification.styles";
import { NOTIFICATION_FILTER_LABELS } from "./notificationPresentation";

type Filter = NotificationCategory | "all";

const FILTERS: Filter[] = ["all", "streak", "achievement", "social", "tips"];

/** Text tabs under the title; the chosen one is underlined in the accent colour. */
export function NotificationFilterBar({
  selected,
  onSelect,
}: {
  selected: Filter;
  onSelect: (filter: Filter) => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabs}
      contentContainerStyle={styles.tabsContent}
    >
      {FILTERS.map((filter) => {
        const on = selected === filter;
        return (
          <Pressable
            key={filter}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync().catch(() => undefined);
              onSelect(filter);
            }}
            style={styles.tab}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]}>
              {t(NOTIFICATION_FILTER_LABELS[filter])}
            </Text>
            <View style={[styles.tabUnderline, on && styles.tabUnderlineOn]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
