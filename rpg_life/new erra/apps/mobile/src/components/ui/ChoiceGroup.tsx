import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../theme/theme-context";

type ChoiceOption = {
  label: string;
  value: string;
};

type Props = {
  label: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
};

export function ChoiceGroup({ label, value, options, onChange }: Props) {
  const { colors, radius, spacing } = useAppTheme();
  const styles = createStyles(colors, radius, spacing);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => onChange(option.value)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  radius: ReturnType<typeof useAppTheme>["radius"],
  spacing: ReturnType<typeof useAppTheme>["spacing"]
) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.xs
    },
    label: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text
    },
    options: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    option: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted
    },
    optionSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent
    },
    optionLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600"
    },
    optionLabelSelected: {
      color: "#fff8f2"
    }
  });
