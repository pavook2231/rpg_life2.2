import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import LottieView from "lottie-react-native";

import { useTranslation } from "../context/LocalizationContext";
import { colors } from "./theme";

type Props = {
  label?: string;
  style?: StyleProp<ViewStyle>;
  size?: number;
};

export function LoadingAnimation({ label, style, size = 160 }: Props) {
  const t = useTranslation();

  return (
    <View style={[styles.wrap, style]}>
      <LottieView autoPlay loop style={{ width: size, height: size }} source={require("../../assets/lottie/rpg-loader.json")} />
      <Text style={styles.label}>{label ?? t("common.loading")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
