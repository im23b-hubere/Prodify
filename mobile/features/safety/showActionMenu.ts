import { ActionSheetIOS, Alert, Platform } from "react-native";

export type ActionMenuItem = { label: string; destructive?: boolean; onSelect: () => void };

type ActionMenu = { title: string; cancelLabel: string; items: ActionMenuItem[] };

/** A native action sheet on iOS; Android dialogs hold at most three buttons and dismiss on tap outside. */
export function showActionMenu({ title, cancelLabel, items }: ActionMenu): void {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...items.map((item) => item.label), cancelLabel],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: items.flatMap((item, index) => (item.destructive ? [index] : [])),
      },
      (index) => items[index]?.onSelect(),
    );
    return;
  }
  Alert.alert(
    title,
    undefined,
    items.slice(0, 3).map((item) => ({
      text: item.label,
      style: item.destructive ? "destructive" : "default",
      onPress: item.onSelect,
    })),
    { cancelable: true },
  );
}
