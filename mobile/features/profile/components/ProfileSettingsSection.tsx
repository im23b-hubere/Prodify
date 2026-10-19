import {
  Activity,
  Bell,
  Building2,
  ChevronRight,
  FileText,
  Languages,
  LogOut,
  Shield,
  Trash2,
  UserX,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../constants/theme";
import { profileScreenStyles as styles } from "../profileScreen.styles";
import type { SettingsScreenController } from "../hooks/useSettingsScreenController";

type Props = {
  controller: Pick<SettingsScreenController, "t" | "accountActions" | "languageName"> & {
    navigation: Pick<
      SettingsScreenController["navigation"],
      | "openLanguageSettings"
      | "openNotifications"
      | "openPrivacy"
      | "openTerms"
      | "openImprint"
      | "openBlockedUsers"
      | "openEngagementDebug"
    >;
  };
};

function SettingsLink({
  label,
  value,
  onPress,
  Icon,
  chevron = true,
  danger = false,
}: {
  label: string;
  /** Current setting, shown on the right before the chevron. */
  value?: string;
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
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.legalRowLeft}>
        <Icon color={iconTint} size={18} strokeWidth={2.2} />
        <Text style={[styles.legalRowText, { color: tint }]}>{label}</Text>
      </View>
      <View style={styles.legalRowRight}>
        {value ? <Text style={styles.legalRowValue}>{value}</Text> : null}
        {chevron ? <ChevronRight color={colors.textSecondary} size={18} strokeWidth={2.2} /> : null}
      </View>
    </Pressable>
  );
}

export function ProfileSettingsSection({ controller }: Props) {
  const { t, navigation, accountActions, languageName } = controller;
  return (
    <>
      <View style={styles.settingsCard}>
        <SettingsLink
          label={t("profile.language")}
          value={languageName}
          Icon={Languages}
          onPress={navigation.openLanguageSettings}
        />
        <View style={styles.legalDivider} />
        <SettingsLink
          label={t("profile.manageNotifications")}
          Icon={Bell}
          onPress={navigation.openNotifications}
        />
        <View style={styles.legalDivider} />
        <SettingsLink
          label={t("safety.blocked.title")}
          Icon={UserX}
          onPress={navigation.openBlockedUsers}
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
        <View style={styles.legalDivider} />
        <SettingsLink
          label={t("legal.linksImprint")}
          Icon={Building2}
          onPress={navigation.openImprint}
        />
        {__DEV__ ? (
          <>
            <View style={styles.legalDivider} />
            <SettingsLink
              label={t("engagementDebug.title")}
              Icon={Activity}
              onPress={navigation.openEngagementDebug}
            />
          </>
        ) : null}
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
