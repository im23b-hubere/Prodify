import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/** Widgets and Live Activities exist on iOS only, and Expo Go ships without their native module. */
export function canUseWidgetExtension(): boolean {
  return (
    Platform.OS === "ios" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}
