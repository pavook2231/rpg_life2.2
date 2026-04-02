import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../theme/theme-context";

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function ScreenShell({ title, subtitle, children }: Props) {
  const { colors, spacing } = useAppTheme();
  const styles = createStyles(colors, spacing);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </ScrollView>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  spacing: ReturnType<typeof useAppTheme>["spacing"]
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md
    },
    hero: {
      gap: spacing.sm,
      paddingTop: spacing.md
    },
    title: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "800",
      color: colors.text
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted
    }
  });
