import { Pressable, StyleSheet, Text } from "react-native";

import { useAppTheme } from "../../theme/theme-context";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

export function AppButton({ title, onPress, variant = "primary", disabled = false }: Props) {
  const { colors, radius, spacing } = useAppTheme();
  const styles = createStyles(colors, radius, spacing);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <Text style={[styles.label, variant === "primary" ? styles.primaryLabel : styles.secondaryLabel]}>
        {title}
      </Text>
    </Pressable>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  radius: ReturnType<typeof useAppTheme>["radius"],
  spacing: ReturnType<typeof useAppTheme>["spacing"]
) =>
  StyleSheet.create({
    base: {
      minHeight: 54,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg
    },
    primary: {
      backgroundColor: colors.accent,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 18,
      elevation: 5
    },
    secondary: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border
    },
    ghost: {
      backgroundColor: "transparent"
    },
    disabled: {
      opacity: 0.45
    },
    pressed: {
      transform: [{ scale: 0.985 }]
    },
    label: {
      fontSize: 16,
      fontWeight: "700"
    },
    primaryLabel: {
      color: "#fff8f2"
    },
    secondaryLabel: {
      color: colors.text
    }
  });
