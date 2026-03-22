import type { EquipmentOverviewPayload } from "../items/types";
import type { SocialUserPreview } from "../friends/types";

export type SocialProfileGoalSummary = {
  goal_type?: string | null;
  goal_title?: string | null;
  goal_description?: string | null;
  goal_icon?: string | null;
  goal_accent_color?: string | null;
  goal_term_months?: number | null;
  goal_cycle_xp?: number | null;
  goal_target_xp?: number | null;
  goal_progress_percent?: number | null;
};

export type SocialProfileCharacter = {
  id: number;
  name: string;
  level: number;
  class: string;
  streak: number;
  crystals: number;
  goal_cycle_xp?: number | null;
  goal_target_xp?: number | null;
  goal_progress_percent?: number | null;
  strength: number;
  agility: number;
  intellect: number;
  stamina?: number | null;
  current_xp: number;
  next_level_xp: number;
  xp_percent: number;
};

export type SocialProfilePayload = {
  user: SocialUserPreview;
  goal: SocialProfileGoalSummary;
  has_character: boolean;
  character: SocialProfileCharacter | null;
  equipment_overview: EquipmentOverviewPayload | null;
};

export type SocialProfileRouteParams = {
  userId: number;
  userName?: string | null;
};
