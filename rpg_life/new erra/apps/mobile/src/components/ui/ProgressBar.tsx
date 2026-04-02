import { StyleSheet, View } from "react-native";

import { useAppTheme } from "../../theme/theme-context";

type Props = {
  progress: number;
};

export function ProgressBar({ progress }: Props) {
  const { colors, radius } = useAppTheme();
  const styles = createStyles(colors, radius);

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>["colors"],
  radius: ReturnType<typeof useAppTheme>["radius"]
) =>
  StyleSheet.create({
    track: {
      height: 10,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      overflow: "hidden"
    },
    fill: {
      height: 10,
      backgroundColor: colors.accent,
      borderRadius: radius.pill
    }
  });
