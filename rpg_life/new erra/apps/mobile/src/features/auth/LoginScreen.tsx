import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/layout/ScreenShell";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { AppInput } from "../../components/ui/AppInput";
import { useSession } from "../../lib/session-context";
import { useAppTheme } from "../../theme/theme-context";

type Props = {
  onSwitchToRegister: () => void;
};

export function LoginScreen({ onSwitchToRegister }: Props) {
  const { signIn, requestPasswordReset } = useSession();
  const { colors, spacing } = useAppTheme();
  const styles = createStyles(colors, spacing);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [errorText, setErrorText] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorText("");
      setNoticeText("");
      await signIn(email.trim(), password);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Не удалось войти.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    try {
      setErrorText("");
      const message = await requestPasswordReset((resetEmail || email).trim());
      setNoticeText(message);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Не удалось подготовить восстановление.");
    }
  };

  return (
    <ScreenShell
      title="С возвращением"
      subtitle="Продолжай путь к цели: вход займёт секунды, а все квесты и прогресс будут ждать внутри."
    >
      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Войти в аккаунт</Text>
          <AppInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="name@example.com"
          />
          <AppInput
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Твой пароль"
          />
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          {noticeText ? <Text style={styles.noticeText}>{noticeText}</Text> : null}
          <AppButton
            title={isSubmitting ? "Входим..." : "Войти"}
            onPress={handleSignIn}
            disabled={isSubmitting}
          />
          <AppButton title="Создать новый аккаунт" onPress={onSwitchToRegister} variant="ghost" />
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.section}>
          <Text style={styles.cardTitle}>Восстановление доступа</Text>
          <Text style={styles.cardText}>
            Если пароль забылся, подготовим инструкцию по восстановлению на указанный email.
          </Text>
          <AppInput
            label="Email для восстановления"
            value={resetEmail}
            onChangeText={setResetEmail}
            keyboardType="email-address"
            placeholder="Можно оставить тот же email"
          />
          <AppButton title="Подготовить восстановление" onPress={handleReset} variant="secondary" />
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
    errorText: {
      color: "#b24831",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600"
    },
    noticeText: {
      color: colors.success,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600"
    }
  });
