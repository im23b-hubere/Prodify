/** Whether the OS currently lets this app show notifications. Unknown counts as allowed. */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  try {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    return status !== "denied";
  } catch {
    return true;
  }
}
