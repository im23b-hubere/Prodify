import type { TFunction } from "i18next";
import { Alert } from "react-native";

/** Blocking ends the friendship and hides both people from each other, so it always asks first. */
export function confirmBlock({ name, t, onConfirm }: { name: string; t: TFunction; onConfirm: () => void }) {
  Alert.alert(t("safety.block.confirmTitle", { name }), t("safety.block.confirmBody"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("safety.block.confirmAction"), style: "destructive", onPress: onConfirm },
  ]);
}
