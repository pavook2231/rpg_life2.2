import React from "react";
import { Modal as NativeModal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTranslation } from "../context/LocalizationContext";
import { GameIcon } from "./GameIcon";
import { colors, radii } from "./theme";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  children?: React.ReactNode;
  onClose: () => void;
};

export function Modal({ visible, title, subtitle, description, children, onClose }: Props) {
  const t = useTranslation();

  return (
    <NativeModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} style={styles.overlay}>
        <Animated.View entering={FadeInDown.duration(220)} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <Pressable style={styles.closeIconButton} onPress={onClose}>
              <GameIcon name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>{t("common.close")}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </NativeModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
    padding: 20,
  },
  card: {
    maxHeight: "82%",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  header: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.primary,
    fontWeight: "800",
  },
  description: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  closeIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.backgroundInset,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    maxHeight: 420,
  },
  bodyContent: {
    gap: 10,
  },
  closeButton: {
    borderRadius: radii.md,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeText: {
    color: colors.text,
    fontWeight: "800",
  },
});
