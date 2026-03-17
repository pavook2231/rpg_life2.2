import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { changePassword, recoverAccount } from "../api/auth";
import { Screen } from "../components/Screen";
import { StateBlock } from "../components/StateBlock";
import { ENABLE_ACCOUNT_RECOVERY } from "../config/env";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAppPreferences } from "../context/AppPreferencesContext";
import { useAuth } from "../context/AuthContext";
import { useOffline } from "../context/OfflineContext";
import { useTranslation } from "../context/LocalizationContext";
import { Button, Card, radii, useThemeColors, useThemeMode } from "../ui";

export function SettingsScreen() {
  const t = useTranslation();
  const { notificationsEnabled, setNotificationsEnabled, themeMode, setThemeMode } = useAppPreferences();
  const colors = useThemeColors();
  const currentThemeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, currentThemeMode), [colors, currentThemeMode]);
  const { signOut, user } = useAuth();
  const { isOnline, pendingActionsCount } = useOffline();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState(user?.email ?? "");
  const trimmedRecoveryEmail = recoveryEmail.trim();
  const canChangePassword = currentPassword.trim().length >= 8 && newPassword.trim().length >= 8;
  const canRecoverAccount = trimmedRecoveryEmail.includes("@");

  async function handleChangePassword() {
    if (!canChangePassword) {
      Alert.alert(t("screens.settings.passwordChangeFailed"), t("screens.settings.quick.passwordValidation"));
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert(t("screens.settings.passwordChangedTitle"), t("screens.settings.passwordChangedDescription"));
    } catch (error) {
      Alert.alert(t("screens.settings.passwordChangeFailed"), error instanceof Error ? error.message : t("errors.unknownError"));
    }
  }

  async function handleRecoverAccount() {
    if (!canRecoverAccount) {
      Alert.alert(t("screens.settings.recoveryFailed"), t("screens.settings.quick.recoveryValidation"));
      return;
    }

    try {
      await recoverAccount(trimmedRecoveryEmail);
      Alert.alert(t("screens.settings.recoveryTitle"), t("screens.settings.recoveryDescription"));
    } catch (error) {
      Alert.alert(t("screens.settings.recoveryFailed"), error instanceof Error ? error.message : t("errors.unknownError"));
    }
  }

  return (
    <Screen title={t("screens.settings.title")} subtitle={t("screens.settings.subtitle")}>
      <Card>
        <Text style={styles.sectionTitle}>{t("screens.settings.general")}</Text>
        <Text style={styles.sectionHint}>{t("screens.settings.quick.generalHint")}</Text>
        <LanguageSwitcher style={styles.blockSpacing} />
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>{t("screens.settings.notificationsTitle")}</Text>
            <Text style={styles.preferenceDescription}>{t("screens.settings.notificationsDescription")}</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={(value) => void setNotificationsEnabled(value)} />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>{t("screens.settings.themeTitle")}</Text>
            <Text style={styles.preferenceDescription}>{t("screens.settings.themeDescription")}</Text>
          </View>
          <View style={styles.themeSwitchRow}>
            <Pressable style={[styles.themeChip, themeMode === "dark" ? styles.themeChipActive : null]} onPress={() => void setThemeMode("dark")}>
              <Text style={styles.themeChipText}>{t("screens.settings.themeDark")}</Text>
            </Pressable>
            <Pressable style={[styles.themeChip, themeMode === "light" ? styles.themeChipActive : null]} onPress={() => void setThemeMode("light")}>
              <Text style={styles.themeChipText}>{t("screens.settings.themeLight")}</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.settings.security")}</Text>
        <Text style={styles.sectionHint}>{t("screens.settings.quick.securityHint")}</Text>
        <TextInput
          placeholder={t("screens.settings.currentPassword")}
          placeholderTextColor={colors.textDim}
          secureTextEntry
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          placeholder={t("screens.settings.newPassword")}
          placeholderTextColor={colors.textDim}
          secureTextEntry
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        {!canChangePassword ? (
          <StateBlock
            icon="shield-alert-outline"
            title={t("screens.settings.quick.passwordStateTitle")}
            description={t("screens.settings.quick.passwordValidation")}
            tone="warning"
          />
        ) : null}
        <Button label={t("screens.settings.changePassword")} icon="lock-reset" onPress={handleChangePassword} />
      </Card>

      {ENABLE_ACCOUNT_RECOVERY ? (
        <Card>
          <Text style={styles.sectionTitle}>{t("screens.settings.recoverySection")}</Text>
          <Text style={styles.sectionHint}>{t("screens.settings.quick.recoveryHint")}</Text>
          <TextInput
            placeholder={t("screens.settings.recoveryEmail")}
            placeholderTextColor={colors.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            value={recoveryEmail}
            onChangeText={setRecoveryEmail}
          />
          {!canRecoverAccount ? (
            <StateBlock
              icon="email-alert-outline"
              title={t("screens.settings.quick.recoveryStateTitle")}
              description={t("screens.settings.quick.recoveryValidation")}
              tone="warning"
            />
          ) : null}
          <Button label={t("screens.settings.restoreAccount")} icon="email-fast-outline" onPress={handleRecoverAccount} variant="secondary" />
        </Card>
      ) : (
        <StateBlock
          icon="email-lock-outline"
          title={t("screens.settings.quick.recoveryDisabledTitle")}
          description={t("screens.settings.quick.recoveryDisabledDescription")}
          tone="info"
        />
      )}

      <Card>
        <Text style={styles.sectionTitle}>{t("screens.settings.syncSection")}</Text>
        <StateBlock
          icon={isOnline ? "cloud-check-outline" : "cloud-off-outline"}
          title={isOnline ? t("screens.settings.quick.syncOnlineTitle") : t("screens.settings.quick.syncOfflineTitle")}
          description={t("screens.settings.quick.syncSummary", {
            status: isOnline ? t("screens.settings.online") : t("screens.settings.offline"),
            count: pendingActionsCount,
          })}
          tone={isOnline ? "info" : "warning"}
        />
        <Text style={styles.syncText}>{t("screens.settings.quick.syncHint")}</Text>
      </Card>

      <Button label={t("screens.settings.logout")} icon="logout-variant" variant="danger" onPress={signOut} />
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    sectionHint: {
      color: colors.textMuted,
      lineHeight: 19,
    },
    blockSpacing: {
      marginTop: 12,
    },
    preferenceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 16,
      alignItems: "center",
    },
    preferenceCopy: {
      flex: 1,
      gap: 4,
    },
    preferenceTitle: {
      color: colors.text,
      fontWeight: "800",
    },
    preferenceDescription: {
      color: colors.textMuted,
      lineHeight: 19,
    },
    themeSwitchRow: {
      flexDirection: "row",
      gap: 8,
    },
    themeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeChipActive: {
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "#f2dfbf" : "#3b290f",
    },
    themeChipText: {
      color: colors.text,
      fontWeight: "700",
    },
    input: {
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
    },
    syncText: {
      color: colors.textMuted,
      lineHeight: 20,
    },
  });
}
