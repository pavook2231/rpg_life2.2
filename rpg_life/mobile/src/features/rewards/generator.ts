import type { Language } from "../../locales";
import type { Quest } from "../quests/types";
import type { Reward, RewardRarity } from "./types";

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickRarity(quest: Quest): RewardRarity {
  if (quest.type === "epic" || quest.difficulty === "hard") {
    return "legendary";
  }
  if (quest.difficulty === "medium") {
    return "mythical";
  }
  return "rare";
}

export function generateQuestRewards(params: { quest: Quest; language: Language; leveledUp: boolean }): Reward[] {
  const { quest, language, leveledUp } = params;
  const baseRewards: Reward[] = [
    {
      id: `reward-xp-${quest.id}`,
      type: "xp",
      title: language === "en" ? "XP earned" : "Получен опыт",
      description:
        language === "en"
          ? `You gained ${quest.xpReward} XP for ${quest.title.toLowerCase()}.`
          : `Ты получил ${quest.xpReward} XP за задание «${quest.title}».`,
      rarity: pickRarity(quest),
      icon: "star-circle",
      xpAmount: quest.xpReward,
      claimedAt: new Date().toISOString(),
    },
  ];

  const rewardHash = hashString(quest.id);

  if (quest.type !== "daily") {
    baseRewards.push({
      id: `reward-item-${quest.id}`,
      type: "item",
      title:
        language === "en"
          ? rewardHash % 2 === 0
            ? "Rune cache"
            : "Heroic supply pack"
          : rewardHash % 2 === 0
            ? "Тайник с рунами"
            : "Набор героя",
      description:
        language === "en"
          ? "A themed reward chest for your next upgrade."
          : "Тематическая награда для следующего апгрейда.",
      rarity: pickRarity(quest),
      icon: "treasure-chest",
      payload: rewardHash % 2 === 0 ? "rune_cache" : "heroic_supply_pack",
      claimedAt: new Date().toISOString(),
    });
  }

  if (quest.type === "epic") {
    baseRewards.push({
      id: `reward-title-${quest.id}`,
      type: "title",
      title: language === "en" ? "New title unlocked" : "Открыт новый титул",
      description:
        language === "en"
          ? rewardHash % 2 === 0
            ? "You earned the title Pathbreaker."
            : "You earned the title Iron Routine."
          : rewardHash % 2 === 0
            ? "Ты получил титул «Прокладывающий путь»."
            : "Ты получил титул «Железный ритм».",
      rarity: "legendary",
      icon: "badge-account-horizontal-outline",
      payload: rewardHash % 2 === 0 ? "Pathbreaker" : "Iron Routine",
      claimedAt: new Date().toISOString(),
    });
  }

  if (leveledUp) {
    baseRewards.push({
      id: `reward-cosmetic-${quest.id}`,
      type: "cosmetic",
      title: language === "en" ? "Cosmetic reward" : "Косметическая награда",
      description:
        language === "en"
          ? "A new profile aura reacts to your level growth."
          : "Новая аура профиля реагирует на рост твоего уровня.",
      rarity: "mythical",
      icon: "creation",
      payload: "level_aura",
      claimedAt: new Date().toISOString(),
    });
  }

  return baseRewards;
}

export function generateSkillUnlockReward(params: {
  language: Language;
  skillTitle: string;
  skillNodeId: string;
  xpReward: number;
}): Reward {
  const { language, skillTitle, skillNodeId, xpReward } = params;

  return {
    id: `reward-skill-${skillNodeId}`,
    type: "skill_unlock",
    title: language === "en" ? "Skill node unlocked" : "Открыт узел навыка",
    description:
      language === "en"
        ? `${skillTitle} is now active and brought ${xpReward} bonus XP.`
        : `Узел «${skillTitle}» активирован и принес ${xpReward} бонусного XP.`,
    rarity: "mythical",
    icon: "sitemap-outline",
    payload: skillNodeId,
    xpAmount: xpReward,
    claimedAt: new Date().toISOString(),
  };
}

