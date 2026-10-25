import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";

import { paywallStyles as styles } from "../paywall.styles";

type Props = {
  title: string;
  /** What the store bills for the plan: the most prominent price on the tile. */
  price: string;
  /** Subordinate line beneath the price, e.g. a weekly comparison. */
  caption: string;
  /** A small label resting on the tile's top edge, e.g. the saving. */
  badge: string | null;
  selected: boolean;
  disabled: boolean;
  accessibilityLabel: string;
  onSelect: () => void;
};

export function PaywallPlanTile(props: Props) {
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
        {/* Local prices like "CHF 49.00" shrink a touch on narrow tiles instead of wrapping. */}
        <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {props.price}
        </Text>
        {props.caption ? <Text style={styles.caption}>{props.caption}</Text> : null}
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
