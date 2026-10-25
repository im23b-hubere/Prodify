import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { paywallStyles as styles } from "../paywall.styles";

type Props = {
  title: string;
  amount: string;
  isPerWeek: boolean;
  billing: string;
  /** A small label resting on the tile's top edge, e.g. the saving. */
  badge: string | null;
  selected: boolean;
  disabled: boolean;
  accessibilityLabel: string;
  onSelect: () => void;
};

export function PaywallPlanTile(props: Props) {
  const { t } = useTranslation();
  const { selected } = props;
  return (
    <View style={styles.tileWrap}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled: props.disabled }}
        accessibilityLabel={props.accessibilityLabel}
        disabled={props.disabled}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          props.onSelect();
        }}
        style={({ pressed }) => [
          styles.tile,
          selected && styles.tileSelected,
          pressed && styles.tilePressed,
          props.disabled && styles.tileDisabled,
        ]}
      >
        <View style={styles.tileHeader}>
          <Text style={[styles.tileTitle, selected && styles.tileTitleSelected]}>
            {props.title}
          </Text>
          <View style={[styles.radio, selected && styles.radioSelected]}>
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceAmount}>{props.amount}</Text>
          {props.isPerWeek ? (
            <Text style={styles.priceUnit}>{t("paywall.plan.perWeek")}</Text>
          ) : null}
        </View>
        {props.billing ? <Text style={styles.billing}>{props.billing}</Text> : null}
      </Pressable>
      {props.badge ? (
        <View pointerEvents="none" style={styles.badgeAnchor}>
          <View style={[styles.badge, selected && styles.badgeSelected]}>
            <Text style={styles.badgeText}>{props.badge}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
