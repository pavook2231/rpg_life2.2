import { useMemo } from "react";

import { useGameProgress } from "./GameContext";

export function useRpgLifeSystem() {
  const { profile, hero } = useGameProgress();

  return useMemo(
    () => ({
      selectedGoal: profile?.goal
        ? {
            id: profile.goal.goal_type,
            title: profile.goal.goal_title,
            description: profile.goal.goal_description,
            icon: profile.goal.goal_icon,
          }
        : null,
      goalProgress: profile?.goal
        ? {
            completionPercent: profile.goal.goal_progress_percent ?? 0,
            currentXp: profile.goal.goal_cycle_xp ?? 0,
            targetXp: profile.goal.goal_target_xp ?? 0,
          }
        : null,
      currentLevel: hero?.level ?? 1,
      currentStreak: hero?.streak ?? 0,
    }),
    [hero?.level, hero?.streak, profile?.goal],
  );
}
