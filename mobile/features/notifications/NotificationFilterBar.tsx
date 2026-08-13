import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import type { NotificationCategory } from "../../lib/notificationInbox";
import { notificationStyles as styles } from "./notification.styles";
import { NOTIFICATION_FILTER_LABELS } from "./notificationPresentation";

type Filter = NotificationCategory | "all";

const FILTERS: Filter[] = ["all", "streak", "achievement", "social", "tips"];

export function NotificationFilterBar({
  selected,
  onSelect,
}: {
  selected: Filter;
  onSelect: (filter: Filter) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.filterRow}>
      {FILTERS.map((filter) => (
        <Pressable
          key={filter}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            onSelect(filter);
          }}
          style={[styles.filterChip, selected === filter && styles.filterChipOn]}
        >
          <Text style={[styles.filterTxt, selected === filter && styles.filterTxtOn]}>
            {t(NOTIFICATION_FILTER_LABELS[filter])}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
