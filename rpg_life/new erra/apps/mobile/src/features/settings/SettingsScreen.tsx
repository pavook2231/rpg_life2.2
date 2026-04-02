import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/layout/ScreenShell";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { ChoiceGroup } from "../../components/ui/ChoiceGroup";
import { AppInput } from "../../components/ui/AppInput";
import { useSession } from "../../lib/session-context";
import { useAppTheme } from "../../theme/theme-context";

export function SettingsScreen() {
  const { session, updatePreferences, changePassword, signOut } = useSession();
  const { colors, spacing } = useAppTheme();
  const styles = createStyles(colors, spacing);

  const [language, setLanguage] = useState<"ru" | "en">("ru");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!session) {
      return;
    }

    setLanguage(session.preferences.language);
    setTheme(session.preferences.theme);
  }, [session]);

  if (!session) {
    return null;
  }

  const savePreferences = async () => {
    await updatePreferences({ language, theme });
    setNoticeText("Настройки сохранены.");
    setErrorText("");
  };

  const savePassword = async () => {
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setNoticeText("Пароль обновлён.");
      setErrorText("");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Не удалось обновить пароль.");
    }
  };

  return (
    <ScreenShell
      title="Настройки"
      subtitle="Сделай приложение удобным под себя: выбери тему, язык и обнови пароль."
    >
      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Предпочтения</Text>
          <ChoiceGroup
            label="Язык"
            value={language}
            options={[
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" }
            ]}
            onChange={(value) => setLanguage(value as "ru" | "en")}
          />
          <ChoiceGroup
            label="Тема"
            value={theme}
            options={[
              { value: "system", label: "Как на устройстве" },
              { value: "light", label: "Светлая" },
              { value: "dark", label: "Тёмная" }
            ]}
            onChange={(value) => setTheme(value as "system" | "light" | "dark")}
          />
          <AppButton title="Сохранить предпочтения" onPress={savePreferences} />
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Безопасность</Text>
          <AppInput
            label="Текущий пароль"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <AppInput
            label="Новый пароль"
            value={nextPassword}
            onChangeText={setNextPassword}
            secureTextEntry
          />
          {noticeText ? <Text style={styles.noticeText}>{noticeText}</Text> : null}
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          <AppButton title="Изменить пароль" onPress={savePassword} variant="secondary" />
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Аккаунт</Text>
          <Text style={styles.cardText}>
            Если нужно выйти и зайти позже, текущий демо-прогресс сохранится в памяти сессии.
          </Text>
          <AppButton title="Выйти из аккаунта" onPress={signOut} variant="ghost" />
        </View>
      </AppCard>
    </ScreenShell>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  spacing: ReturnType<typeof useAppTheme>["spacing"]
) =>
  StyleSheet.create({
    section: {
      gap: spacing.md
    },
    cardTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800",
      color: colors.text
    },
    cardText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted
    },
    noticeText: {
      color: colors.success,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600"
    },
    errorText: {
      color: "#b24831",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600"
    }
  });
