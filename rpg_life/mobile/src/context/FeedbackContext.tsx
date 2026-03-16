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
  pushToast: (toast: Omit<ToastItem, "id">) => void;
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

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogItem | null>(null);
  const queueRef = useRef<ToastItem[]>([]);
  const idRef = useRef(1);
  const soundsRef = useRef<Partial<Record<SoundKey, SoundHandle>>>({});
  const dialogRef = useRef<DialogItem | null>(null);
  const translateY = useRef(new Animated.Value(42)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

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

  const showNextToast = useCallback(() => {
    if (activeToast || queueRef.current.length === 0) {
      return;
    }
    const next = queueRef.current.shift() ?? null;
    if (!next) {
      return;
    }
    setActiveToast(next);
    translateY.setValue(42);
    scale.setValue(0.82);
    opacity.setValue(0);
    glow.setValue(0.35);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.back(1.25)),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.back(1.15)),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.03,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2100),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -20,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 190,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.2,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setActiveToast(null);
    });
  }, [activeToast, glow, opacity, scale, translateY]);

  useEffect(() => {
    if (!activeToast) {
      const timer = setTimeout(showNextToast, 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeToast, showNextToast]);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    if (toast.tone === "reward") {
      void triggerHaptic("reward");
    } else if (toast.tone === "warning") {
      void triggerHaptic("warning");
    } else if (toast.tone === "success") {
      void triggerHaptic("success");
    }

    queueRef.current.push({ ...toast, id: idRef.current++ });
    if (!activeToast) {
      showNextToast();
    }
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

  const playSound = useCallback(async (key: SoundKey) => {
    const sound = soundsRef.current[key];
    if (!sound) {
      return;
    }
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // Ignore audio glitches to avoid blocking gameplay flows.
    }
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
  const isRewardToast = activeToast?.tone === "reward";

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
                shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] }),
                shadowRadius: glow.interpolate({ inputRange: [0, 1], outputRange: [16, 28] }),
              },
            ]}
          >
            <Animated.View style={[styles.toastGlow, { opacity: glow }]} />
            <View style={[styles.toastIconWrap, isRewardToast ? styles.toastIconWrapReward : null]}>
              <View style={[styles.toastIconHalo, isRewardToast ? styles.toastIconHaloReward : null]}>
                <GameIcon name={activeToast.icon ?? "sparkles"} size={isRewardToast ? 32 : 24} color={palette.text} />
              </View>
            </View>
            <View style={styles.toastBody}>
              <Text style={styles.toastTitle}>{activeToast.title}</Text>
              {activeToast.description ? <Text style={styles.toastDescription}>{activeToast.description}</Text> : null}
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  toast: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    gap: 14,
    borderRadius: radii.lg,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 2,
    width: "100%",
    maxWidth: 388,
    ...shadows.card,
  },
  toastGlow: {
    position: "absolute",
    top: -22,
    right: -10,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  toastInfo: {
    backgroundColor: "#13365b",
    borderColor: "#60a5fa",
  },
  toastSuccess: {
    backgroundColor: "#14532d",
    borderColor: "#4ade80",
  },
  toastReward: {
    backgroundColor: "#5b3403",
    borderColor: "#fbbf24",
  },
  toastWarning: {
    backgroundColor: "#7f1d1d",
    borderColor: "#f87171",
  },
  toastIconWrap: {
    width: 44,
    alignItems: "center",
    marginTop: 2,
  },
  toastIconWrapReward: {
    width: 60,
  },
  toastIconHalo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  toastIconHaloReward: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.24)",
  },
  toastBody: {
    flex: 1,
    gap: 4,
  },
  toastTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "900",
  },
  toastDescription: {
    color: "#f1f5f9",
    fontSize: 14,
    lineHeight: 20,
  },
});
