type ClassInfo = {
  strength?: number;
  agility?: number;
  intellect?: number;
  stamina?: number;
  level?: number;
};

type Totals = {
  strength?: number;
  agility?: number;
  intellect?: number;
  stamina?: number;
  health?: number;
  armor?: number;
  critical_chance?: number;
  luck?: number;
};

type RewardEffects = {
  xp_bonus_percent?: number;
  gold_bonus_percent?: number;
  crit_reward_chance_percent?: number;
  loot_bonus_percent?: number;
  armor_reduction_percent?: number;
  system_daily_cap?: number;
};

export type DerivedStats = {
  strength: number;
  agility: number;
  intellect: number;
  stamina: number;
  health: number;
  armor: number;
  crit: number;
  luck: number;
  xpBonusPercent: number;
  goldBonusPercent: number;
  lootChancePercent: number;
  critRewardChancePercent: number;
  armorReductionPercent: number;
  systemDailyCap: number;
  extraSystemQuests: number;
};

export function buildDerivedStats(
  classInfo?: ClassInfo | null,
  totals?: Totals | null,
  rewardEffects?: RewardEffects | null,
): DerivedStats {
  const strength = Math.round((classInfo?.strength ?? 0) + (totals?.strength ?? 0));
  const agility = Math.round((classInfo?.agility ?? 0) + (totals?.agility ?? 0));
  const intellect = Math.round((classInfo?.intellect ?? 0) + (totals?.intellect ?? 0));
  const stamina = Math.round((classInfo?.stamina ?? 0) + (totals?.stamina ?? 0));

  const health = Math.max(100, Math.round(100 + stamina * 5));
  const armor = Math.round(totals?.armor ?? 0);
  const critRewardChancePercent = Number(
    (rewardEffects?.crit_reward_chance_percent ?? totals?.critical_chance ?? 0).toFixed(1),
  );
  const luck = Number((totals?.luck ?? 0).toFixed(1));
  const lootChancePercent = Number((rewardEffects?.loot_bonus_percent ?? luck).toFixed(1));
  const armorReductionPercent = Number(
    (rewardEffects?.armor_reduction_percent ?? Math.min(90, armor * 0.1)).toFixed(1),
  );
  const systemDailyCap = 10;

  return {
    strength,
    agility,
    intellect,
    stamina,
    health,
    armor,
    crit: critRewardChancePercent,
    luck,
    xpBonusPercent: Number((rewardEffects?.xp_bonus_percent ?? 0).toFixed(1)),
    goldBonusPercent: Number((rewardEffects?.gold_bonus_percent ?? 0).toFixed(1)),
    lootChancePercent,
    critRewardChancePercent,
    armorReductionPercent,
    systemDailyCap,
    extraSystemQuests: 0,
  };
}

export function getStatDescription(statKey: keyof DerivedStats, stats: DerivedStats) {
  const descriptions: Record<keyof DerivedStats, string> = {
    strength: "Сила показывает физическую подготовку героя и усиливает общий профиль персонажа.",
    agility: `Ловкость усиливает золото за задания. Текущий бонус: +${stats.goldBonusPercent}%.`,
    intellect: `Интеллект усиливает опыт за задания. Текущий бонус: +${stats.xpBonusPercent}%.`,
    stamina: `Выносливость увеличивает максимальное здоровье. Текущий максимум: ${stats.health} HP.`,
    health: `Здоровье показывает запас прочности героя. Текущий максимум: ${stats.health} HP.`,
    armor: `Броня уменьшает урон за пропущенные дни. Текущая защита: ${stats.armorReductionPercent}%.`,
    crit: `Крит дает шанс удвоить XP и золото за задание. Текущий шанс: ${stats.critRewardChancePercent}%.`,
    luck: `Удача повышает шанс редкой добычи и сундуков. Текущий бонус: +${stats.lootChancePercent}%.`,
    xpBonusPercent: `Текущий бонус к опыту: +${stats.xpBonusPercent}%.`,
    goldBonusPercent: `Текущий бонус к золоту: +${stats.goldBonusPercent}%.`,
    lootChancePercent: `Текущий шанс редкой добычи: +${stats.lootChancePercent}%.`,
    critRewardChancePercent: `Текущий шанс критической награды: ${stats.critRewardChancePercent}%.`,
    armorReductionPercent: `Текущая защита от урона: ${stats.armorReductionPercent}%.`,
    systemDailyCap: `Система выдает ${stats.systemDailyCap} целевых заданий в день.`,
    extraSystemQuests: "Дополнительные системные задания сейчас отключены.",
  };

  return descriptions[statKey];
}
