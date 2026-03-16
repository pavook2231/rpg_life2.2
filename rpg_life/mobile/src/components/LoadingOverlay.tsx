import React from "react";
import { StyleSheet, View } from "react-native";

import { useTranslation } from "../context/LocalizationContext";
import { LoadingAnimation } from "../ui/LoadingAnimation";

export function LoadingOverlay({ label }: { label?: string }) {
  const t = useTranslation();

  return (
    <View style={styles.wrap}>
      <LoadingAnimation label={label ?? t("common.loading")} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 28,
  },
});
