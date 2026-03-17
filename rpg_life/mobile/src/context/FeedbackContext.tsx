import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { triggerHaptic } from "../lib/haptics";
import { palette, radii, shadows } from "../theme/gameTheme";
import { GameDialog } from "../ui/GameDialog";
import { GameIcon } from "../ui/GameIcon";

type SoundKey = "quest" | "achievement" | "item" | "level" | "select";
type ToastTone = "info" | "success" | "reward" | "warning";
type DialogTone = ToastTone;

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  icon?: string;
  tone?: ToastTone;
  variant?: "default" | "achievement" | "achievementLegendary";
};

type ToastHaptic = "success" | "reward" | "warning" | "level";

type ToastOptions = {
  sound?: SoundKey;
  haptic?: ToastHaptic;
  durationMs?: number;
  variant?: "default" | "achievement" | "achievementLegendary";
};

type QueuedToast = ToastItem & {
  sound?: SoundKey;
  haptic?: ToastHaptic;
  durationMs: number;
  variant: "default" | "achievement" | "achievementLegendary";
  resolve: () => void;
};

type DialogAction = {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost" | "gold";
  icon?: string;
  closeOnPress?: boolean;
};

type DialogItem = {
  title: string;
  description?: string;
  icon?: string;
  tone?: DialogTone;
  actions?: DialogAction[];
  onClose?: () => void;
};

type SoundHandle = {
  loadAsync: (source: number) => Promise<unknown>;
  unloadAsync: () => Promise<unknown>;
  setPositionAsync: (positionMillis: number) => Promise<unknown>;
  playAsync: () => Promise<unknown>;
};

type ExpoAvModule = {
  Audio: {
    setAudioModeAsync: (mode: { playsInSilentModeIOS: boolean; staysActiveInBackground: boolean }) => Promise<unknown>;
    Sound: new () => SoundHandle;
  };
};

type FeedbackContextValue = {
  playSound: (key: SoundKey) => Promise<void>;
  pushToast: (toast: Omit<ToastItem, "id">, options?: ToastOptions) => Promise<void>;
  showDialog: (dialog: DialogItem) => void;
  hideDialog: () => void;
};

const soundSources: Record<SoundKey, number> = {
  achievement: require("../../assets/sounds/achievement.mp3"),
  quest: require("../../assets/sounds/quest_complete.mp3"),
  item: require("../../assets/sounds/select.mp3"),
  level: require("../../assets/sounds/select.mp3"),
  select: require("../../assets/sounds/select.mp3"),
};

const soundDurations: Record<SoundKey, number> = {
  achievement: 1550,
  quest: 1250,
  item: 900,
  level: 1100,
  select: 360,
};

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogItem | null>(null);
  const queueRef = useRef<QueuedToast[]>([]);
  const idRef = useRef(1);
  const soundsRef = useRef<Partial<Record<SoundKey, SoundHandle>>>({});
  const dialogRef = useRef<DialogItem | null>(null);
  const isProcessingToastRef = useRef(false);
  const soundQueueRef = useRef(Promise.resolve());
  const translateY = useRef(new Animated.Value(42)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.28)).current;

  useEffect(() => {
    let cancelled = false;

    async function loadSounds() {
      try {
        const expoAv = (await import("expo-av")) as ExpoAvModule;
        await expoAv.Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const entries = await Promise.all(
          (Object.keys(soundSources) as SoundKey[]).map(async (key) => {
            const sound = new expoAv.Audio.Sound();
            await sound.loadAsync(soundSources[key]);
            return [key, sound] as const;
          }),
        );

        if (cancelled) {
          await Promise.all(entries.map(([, sound]) => sound.unloadAsync().catch(() => undefined)));
          return;
        }

        entries.forEach(([key, sound]) => {
          soundsRef.current[key] = sound;
        });
      } catch {
        // Keep audio best-effort to avoid impacting core gameplay.
      }
    }

    void loadSounds();

    return () => {
      cancelled = true;
      const sounds = Object.values(soundsRef.current);
      sounds.forEach((sound) => {
        sound?.unloadAsync().catch(() => undefined);
      });
    };
  }, []);

  useEffect(() => {
    dialogRef.current = activeDialog;
  }, [activeDialog]);

  const playSound = useCallback((key: SoundKey) => {
    soundQueueRef.current = soundQueueRef.current.then(async () => {
      const sound = soundsRef.current[key];
      if (!sound) {
        return;
      }
      try {
        await sound.setPositionAsync(0);
        await sound.playAsync();
        await new Promise((resolve) => setTimeout(resolve, soundDurations[key] ?? 900));
      } catch {
        // Ignore audio glitches to avoid blocking gameplay flows.
      }
    });
    return soundQueueRef.current;
  }, []);

  const showNextToast = useCallback(async () => {
    if (activeToast || isProcessingToastRef.current || queueRef.current.length === 0) {
      return;
    }
    const next = queueRef.current.shift() ?? null;
    if (!next) {
      return;
    }
    isProcessingToastRef.current = true;
    setActiveToast(next);
    translateY.setValue(42);
    scale.setValue(0.9);
    opacity.setValue(0);
    glow.setValue(0.28);

    if (next.haptic) {
      await triggerHaptic(next.haptic);
    }

    if (next.sound) {
      await playSound(next.sound);
    }

    await new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 340,
            easing: Easing.out(Easing.back(1.08)),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 240,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(next.durationMs),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -18,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.96,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.14,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => resolve());
    });

    setActiveToast(null);
    next.resolve();
    isProcessingToastRef.current = false;
  }, [activeToast, glow, opacity, playSound, scale, translateY]);

  useEffect(() => {
    if (!activeToast) {
      const timer = setTimeout(showNextToast, 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeToast, showNextToast]);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">, options?: ToastOptions) => {
    const inferredHaptic =
      options?.haptic ?? (toast.tone === "reward" ? "reward" : toast.tone === "warning" ? "warning" : toast.tone === "success" ? "success" : undefined);

    return new Promise<void>((resolve) => {
      queueRef.current.push({
        ...toast,
        id: idRef.current++,
        sound: options?.sound,
        haptic: inferredHaptic,
        durationMs: options?.durationMs ?? 2200,
        variant: options?.variant ?? "default",
        resolve,
      });
      if (!activeToast) {
        void showNextToast();
      }
    });
  }, [activeToast, showNextToast]);

  const hideDialog = useCallback(() => {
    const dialog = dialogRef.current;
    setActiveDialog(null);
    dialog?.onClose?.();
  }, []);

  const showDialog = useCallback((dialog: DialogItem) => {
    if (dialog.tone === "reward") {
      void triggerHaptic("reward");
    } else if (dialog.tone === "warning") {
      void triggerHaptic("warning");
    } else if (dialog.tone === "success") {
      void triggerHaptic("success");
    }

    setActiveDialog(dialog);
  }, []);

  const value = useMemo(
    () => ({
      playSound,
      pushToast,
      showDialog,
      hideDialog,
    }),
    [hideDialog, playSound, pushToast, showDialog],
  );

  const toneStyle =
    activeToast?.tone === "reward"
      ? styles.toastReward
      : activeToast?.tone === "warning"
        ? styles.toastWarning
        : activeToast?.tone === "success"
          ? styles.toastSuccess
          : styles.toastInfo;
  const isLegendaryAchievementToast = activeToast?.variant === "achievementLegendary";
  const isAchievementToast = activeToast?.variant === "achievement" || isLegendaryAchievementToast;
  const isRewardToast = activeToast?.tone === "reward";
  const accentStyle =
    isLegendaryAchievementToast
      ? styles.toastAccentAchievementLegendary
      : isAchievementToast
      ? styles.toastAccentAchievement
      : activeToast?.tone === "reward"
      ? styles.toastAccentReward
      : activeToast?.tone === "warning"
        ? styles.toastAccentWarning
        : activeToast?.tone === "success"
          ? styles.toastAccentSuccess
          : styles.toastAccentInfo;
  const pillStyle =
    isLegendaryAchievementToast
      ? styles.toastTonePillAchievementLegendary
      : isAchievementToast
      ? styles.toastTonePillAchievement
      : activeToast?.tone === "reward"
      ? styles.toastTonePillReward
      : activeToast?.tone === "warning"
        ? styles.toastTonePillWarning
        : activeToast?.tone === "success"
          ? styles.toastTonePillSuccess
          : styles.toastTonePillInfo;
  const titleStyle =
    isLegendaryAchievementToast
      ? styles.toastTitleAchievementLegendary
      : isAchievementToast
      ? styles.toastTitleAchievement
      : activeToast?.tone === "reward"
      ? styles.toastTitleReward
      : activeToast?.tone === "warning"
        ? styles.toastTitleWarning
        : activeToast?.tone === "success"
          ? styles.toastTitleSuccess
          : styles.toastTitleInfo;
  const descriptionStyle =
    isLegendaryAchievementToast
      ? styles.toastDescriptionAchievementLegendary
      : isAchievementToast
      ? styles.toastDescriptionAchievement
      : activeToast?.tone === "reward"
      ? styles.toastDescriptionReward
      : activeToast?.tone === "warning"
        ? styles.toastDescriptionWarning
        : activeToast?.tone === "success"
          ? styles.toastDescriptionSuccess
          : styles.toastDescriptionInfo;
  const iconHaloStyle =
    isLegendaryAchievementToast
      ? styles.toastIconHaloAchievementLegendarySurface
      : isAchievementToast
      ? styles.toastIconHaloAchievementSurface
      : activeToast?.tone === "reward"
      ? styles.toastIconHaloRewardSurface
      : activeToast?.tone === "warning"
        ? styles.toastIconHaloWarning
        : activeToast?.tone === "success"
          ? styles.toastIconHaloSuccess
          : styles.toastIconHaloInfo;

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.overlay}>
        {activeToast ? (
          <Animated.View
            style={[
              styles.toast,
              toneStyle,
              {
                opacity,
                transform: [{ translateY }, { scale }],
                shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.34] }),
                shadowRadius: glow.interpolate({ inputRange: [0, 1], outputRange: [16, 30] }),
              },
            ]}
          >
            <View style={[styles.toastAccent, accentStyle]} />
            <Animated.View
              style={[
                styles.toastGlow,
                isLegendaryAchievementToast
                  ? styles.toastGlowAchievementLegendary
                  : isAchievementToast
                    ? styles.toastGlowAchievement
                    : isRewardToast
                      ? styles.toastGlowReward
                      : null,
                { opacity: glow },
              ]}
            />
            {isLegendaryAchievementToast ? (
              <>
                <View style={styles.toastAchievementCrestLegendary} />
                <View style={styles.toastLegendaryOrbit} />
              </>
            ) : isAchievementToast ? (
              <View style={styles.toastAchievementCrest} />
            ) : isRewardToast ? (
              <View style={styles.toastRewardShine} />
            ) : null}
            <View style={styles.toastTopRow}>
              <View
                style={[
                  styles.toastIconWrap,
                  isRewardToast || isAchievementToast ? styles.toastIconWrapReward : null,
                  isLegendaryAchievementToast ? styles.toastIconWrapLegendary : null,
                ]}
              >
                <View
                  style={[
                    styles.toastIconHalo,
                    iconHaloStyle,
                    isRewardToast || isAchievementToast ? styles.toastIconHaloReward : null,
                    isLegendaryAchievementToast ? styles.toastIconHaloLegendary : null,
                  ]}
                >
                  <GameIcon
                    name={activeToast.icon ?? "sparkles"}
                    size={isLegendaryAchievementToast ? 38 : isAchievementToast ? 34 : isRewardToast ? 30 : 22}
                    color={palette.text}
                  />
                </View>
              </View>
              <View style={styles.toastBody}>
                <View style={styles.toastTitleRow}>
                  <Text style={[styles.toastTitle, titleStyle]}>{activeToast.title}</Text>
                  <View style={[styles.toastTonePill, pillStyle]}>
                    <Text style={styles.toastToneLabel}>
                      {isLegendaryAchievementToast
                        ? "LEGEND"
                        : isAchievementToast
                        ? "ACHIEVE"
                        : activeToast.tone === "reward"
                        ? "REWARD"
                        : activeToast.tone === "warning"
                          ? "WARN"
                          : activeToast.tone === "success"
                            ? "DONE"
                            : "INFO"}
                    </Text>
                  </View>
                </View>
                {activeToast.description ? <Text style={[styles.toastDescription, descriptionStyle]}>{activeToast.description}</Text> : null}
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
      <GameDialog
        visible={Boolean(activeDialog)}
        title={activeDialog?.title ?? ""}
        description={activeDialog?.description}
        icon={activeDialog?.icon}
        tone={activeDialog?.tone}
        actions={(activeDialog?.actions ?? []).map((action) => ({
          label: action.label,
          icon: action.icon,
          variant: action.variant,
          onPress: () => {
            const shouldClose = action.closeOnPress ?? true;
            if (shouldClose) {
              setActiveDialog(null);
            }
            if (action.onPress) {
              void Promise.resolve(action.onPress()).catch(() => undefined);
            }
          },
        }))}
        onClose={hideDialog}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used inside FeedbackProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 18,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  toast: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    width: "100%",
    maxWidth: 408,
    ...shadows.card,
  },
  toastAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 6,
  },
  toastAccentInfo: {
    backgroundColor: "#7dd3fc",
  },
  toastAccentSuccess: {
    backgroundColor: "#4ade80",
  },
  toastAccentReward: {
    backgroundColor: "#fbbf24",
  },
  toastAccentAchievement: {
    backgroundColor: "#f59e0b",
  },
  toastAccentAchievementLegendary: {
    backgroundColor: "#facc15",
  },
  toastAccentWarning: {
    backgroundColor: "#f87171",
  },
  toastGlow: {
    position: "absolute",
    top: -34,
    right: -18,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  toastGlowReward: {
    top: -44,
    right: -8,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(251,191,36,0.18)",
  },
  toastGlowAchievement: {
    top: -52,
    right: -2,
    width: 204,
    height: 204,
    borderRadius: 102,
    backgroundColor: "rgba(245,158,11,0.22)",
  },
  toastGlowAchievementLegendary: {
    top: -68,
    right: -18,
    width: 236,
    height: 236,
    borderRadius: 118,
    backgroundColor: "rgba(250,204,21,0.24)",
  },
  toastRewardShine: {
    position: "absolute",
    top: -18,
    left: 58,
    width: 120,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.08)",
    transform: [{ rotate: "-12deg" }],
  },
  toastAchievementCrest: {
    position: "absolute",
    top: -10,
    right: 18,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.22)",
  },
  toastAchievementCrestLegendary: {
    position: "absolute",
    top: -18,
    right: 8,
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1,
    borderColor: "rgba(253,224,71,0.34)",
  },
  toastLegendaryOrbit: {
    position: "absolute",
    top: 12,
    right: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    transform: [{ rotate: "18deg" }],
  },
  toastInfo: {
    backgroundColor: "#10263d",
    borderColor: "rgba(96,165,250,0.55)",
  },
  toastSuccess: {
    backgroundColor: "#102f1d",
    borderColor: "rgba(74,222,128,0.5)",
  },
  toastReward: {
    backgroundColor: "#4e2d08",
    borderColor: "rgba(251,191,36,0.52)",
  },
  toastWarning: {
    backgroundColor: "#612020",
    borderColor: "rgba(248,113,113,0.52)",
  },
  toastTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  toastIconWrap: {
    width: 48,
    alignItems: "center",
    paddingTop: 2,
  },
  toastIconWrapReward: {
    width: 56,
  },
  toastIconWrapLegendary: {
    width: 62,
  },
  toastIconHalo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  toastIconHaloInfo: {
    backgroundColor: "rgba(125,211,252,0.14)",
    borderColor: "rgba(125,211,252,0.24)",
  },
  toastIconHaloSuccess: {
    backgroundColor: "rgba(74,222,128,0.14)",
    borderColor: "rgba(74,222,128,0.24)",
  },
  toastIconHaloWarning: {
    backgroundColor: "rgba(248,113,113,0.14)",
    borderColor: "rgba(248,113,113,0.24)",
  },
  toastIconHaloRewardSurface: {
    backgroundColor: "rgba(251,191,36,0.16)",
    borderColor: "rgba(251,191,36,0.28)",
  },
  toastIconHaloAchievementSurface: {
    backgroundColor: "rgba(245,158,11,0.2)",
    borderColor: "rgba(251,191,36,0.34)",
  },
  toastIconHaloAchievementLegendarySurface: {
    backgroundColor: "rgba(250,204,21,0.24)",
    borderColor: "rgba(253,224,71,0.42)",
  },
  toastIconHaloReward: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.26)",
  },
  toastIconHaloLegendary: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.32)",
  },
  toastBody: {
    flex: 1,
    gap: 6,
  },
  toastTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  toastTitle: {
    color: palette.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  toastTitleInfo: {
    color: "#e0f2fe",
  },
  toastTitleSuccess: {
    color: "#dcfce7",
  },
  toastTitleReward: {
    color: "#fef3c7",
    fontSize: 17,
    letterSpacing: 0.2,
  },
  toastTitleAchievement: {
    color: "#fde68a",
    fontSize: 18,
    letterSpacing: 0.35,
  },
  toastTitleAchievementLegendary: {
    color: "#fef08a",
    fontSize: 20,
    letterSpacing: 0.45,
  },
  toastTitleWarning: {
    color: "#fee2e2",
  },
  toastTonePill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  toastTonePillInfo: {
    backgroundColor: "rgba(125,211,252,0.12)",
    borderColor: "rgba(125,211,252,0.2)",
  },
  toastTonePillSuccess: {
    backgroundColor: "rgba(74,222,128,0.12)",
    borderColor: "rgba(74,222,128,0.2)",
  },
  toastTonePillReward: {
    backgroundColor: "rgba(251,191,36,0.14)",
    borderColor: "rgba(251,191,36,0.24)",
  },
  toastTonePillAchievement: {
    backgroundColor: "rgba(245,158,11,0.18)",
    borderColor: "rgba(251,191,36,0.28)",
  },
  toastTonePillAchievementLegendary: {
    backgroundColor: "rgba(250,204,21,0.22)",
    borderColor: "rgba(253,224,71,0.36)",
  },
  toastTonePillWarning: {
    backgroundColor: "rgba(248,113,113,0.12)",
    borderColor: "rgba(248,113,113,0.2)",
  },
  toastToneLabel: {
    color: "rgba(248,250,252,0.88)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  toastDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  toastDescriptionInfo: {
    color: "rgba(224,242,254,0.86)",
  },
  toastDescriptionSuccess: {
    color: "rgba(220,252,231,0.86)",
  },
  toastDescriptionReward: {
    color: "rgba(254,243,199,0.9)",
  },
  toastDescriptionAchievement: {
    color: "rgba(253,230,138,0.92)",
  },
  toastDescriptionAchievementLegendary: {
    color: "rgba(254,240,138,0.96)",
  },
  toastDescriptionWarning: {
    color: "rgba(254,226,226,0.86)",
  },
});
