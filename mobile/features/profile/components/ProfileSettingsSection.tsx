import { Pressable, Text, View } from "react-native";

import { profileScreenStyles as styles } from "../profileScreen.styles";
import type { ProfileScreenController } from "../hooks/useProfileScreenController";

type Props = { controller: ProfileScreenController };

function SettingsLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={styles.legalRowText}>{label}</Text>
      <Text style={styles.legalRowChevron}>›</Text>
    </Pressable>
  );
}

export function ProfileSettingsSection({ controller }: Props) {
  const { t, navigation, accountActions } = controller;
  const links = [
    [t("profile.manageNotifications"), navigation.openNotifications],
    [t("legal.linksPrivacy"), navigation.openPrivacy],
    [t("legal.linksTerms"), navigation.openTerms],
  ] as const;
  return (
    <>
      <Text style={styles.sectionTitle}>{t("profile.settingsTitle")}</Text>
      <View style={styles.settingsCard}>
        {links.map(([label, onPress], index) => (
          <View key={label}>
            {index > 0 ? <View style={styles.legalDivider} /> : null}
            <SettingsLink label={label} onPress={onPress} />
          </View>
        ))}
      </View>
      <View style={styles.deleteSection}>
        <Text style={styles.deleteSectionTitle}>{t("legal.deleteAccount.sectionTitle")}</Text>
        <Text style={styles.deleteDesc}>{t("legal.deleteAccount.description")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("legal.deleteAccount.button")}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          onPress={accountActions.confirmDeleteAccount}
        >
          <Text style={styles.deleteBtnText}>{t("legal.deleteAccount.button")}</Text>
        </Pressable>
      </View>
      <View style={styles.signoutWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.signOut")}
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
          onPress={accountActions.confirmSignOut}
        >
          <Text style={styles.outlineBtnText}>{t("profile.signOut")}</Text>
        </Pressable>
      </View>
    </>
  );
}
