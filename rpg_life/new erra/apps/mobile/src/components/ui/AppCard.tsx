import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "../../theme/theme-context";

export function AppCard({ children }: PropsWithChildren) {
  const { colors, radius, spacing } = useAppTheme();
  const styles = createStyles(colors, radius, spacing);

  return <View style={styles.card}>{children}</View>;
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  radius: ReturnType<typeof useAppTheme>["radius"],
  spacing: ReturnType<typeof useAppTheme>["spacing"]
) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 1,
      shadowRadius: 20,
      elevation: 4
    }
  });
