import {
  Bell,
  ChevronRight,
  FileText,
  LogOut,
  Shield,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../constants/theme";
import { profileScreenStyles as styles } from "../profileScreen.styles";
import type { ProfileScreenController } from "../hooks/useProfileScreenController";

type Props = { controller: ProfileScreenController };

function SettingsLink({
  label,
  onPress,
  Icon,
  chevron = true,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  Icon: LucideIcon;
  chevron?: boolean;
  danger?: boolean;
}) {
  const tint = danger ? colors.danger : colors.textPrimary;
  const iconTint = danger ? colors.danger : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.legalRowLeft}>
        <Icon color={iconTint} size={18} strokeWidth={2.2} />
        <Text style={[styles.legalRowText, { color: tint }]}>{label}</Text>
      </View>
      {chevron ? (
        <ChevronRight color={colors.textSecondary} size={18} strokeWidth={2.2} />
      ) : null}
    </Pressable>
  );
}

export function ProfileSettingsSection({ controller }: Props) {
  const { t, navigation, accountActions } = controller;
  return (
    <>
      <Text style={styles.sectionTitle}>{t("profile.settingsTitle")}</Text>
      <View style={styles.settingsCard}>
        <SettingsLink
          label={t("profile.manageNotifications")}
          Icon={Bell}
          onPress={navigation.openNotifications}
        />
        <View style={styles.legalDivider} />
        <SettingsLink
          label={t("legal.linksPrivacy")}
          Icon={Shield}
          onPress={navigation.openPrivacy}
        />
        <View style={styles.legalDivider} />
        <SettingsLink
          label={t("legal.linksTerms")}
          Icon={FileText}
          onPress={navigation.openTerms}
        />
      </View>
      <View style={styles.settingsCard}>
        <SettingsLink
          label={t("profile.signOut")}
          Icon={LogOut}
          chevron={false}
          onPress={accountActions.confirmSignOut}
        />
        <View style={styles.legalDivider} />
        <SettingsLink
          label={t("legal.deleteAccount.button")}
          Icon={Trash2}
          chevron={false}
          danger
          onPress={accountActions.confirmDeleteAccount}
        />
      </View>
    </>
  );
}
