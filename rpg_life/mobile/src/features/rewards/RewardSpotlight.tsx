import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { GameIcon } from "../../ui/GameIcon";
import { colors, radii } from "../../ui/theme";
import type { Reward } from "./types";

type Props = {
  reward: Reward | null;
  visible: boolean;
  onClose: () => void;
};

const rarityAccent: Record<string, string> = {
  rare: "#38bdf8",
  mythical: "#c084fc",
  legendary: "#f59e0b",
};

export function RewardSpotlight({ reward, visible, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.86)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !reward) {
      scale.setValue(0.86);
      opacity.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        damping: 10,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, reward, scale, visible]);

  if (!reward) {
    return null;
  }

  const accent = rarityAccent[reward.rarity] ?? colors.primary;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }], borderColor: accent, shadowColor: accent }]}>
          <Text style={styles.kicker}>REWARD</Text>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}22`, borderColor: accent }]}>
            <GameIcon name={reward.icon} size={34} color={accent} />
          </View>
          <Text style={styles.title}>{reward.title}</Text>
          <Text style={[styles.rarity, { color: accent }]}>{reward.rarity.toUpperCase()}</Text>
          <Text style={styles.description}>{reward.description}</Text>
          <Pressable style={[styles.button, { borderColor: accent }]} onPress={onClose}>
            <Text style={styles.buttonText}>Продолжить</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.84)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    backgroundColor: "#151f31",
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: "center",
    gap: 10,
    shadowOpacity: 0.38,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  rarity: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  description: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 6,
    minWidth: 180,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    backgroundColor: "#432803",
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
});

