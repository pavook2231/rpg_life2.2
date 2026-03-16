import * as Haptics from "expo-haptics";

type HapticTone = "press" | "selection" | "success" | "reward" | "warning" | "level";

export async function triggerHaptic(tone: HapticTone = "selection") {
  try {
    if (tone === "press") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    if (tone === "selection") {
      await Haptics.selectionAsync();
      return;
    }

    if (tone === "warning") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (tone === "level") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    if (tone === "reward") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics should never block the gameplay flow.
  }
}
