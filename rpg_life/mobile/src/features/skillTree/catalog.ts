/**
 * Enhanced Skill Tree Catalog
 * 
 * Each skill now includes detailed descriptions explaining:
 * - What aspects of gameplay the skill affects
 * - How it influences character stats
 * - How it interacts with other game systems
 */

import type { Language } from "../../locales";
import { pickLocalized, pickLocalizedArray } from "../shared/localize";
import type { SkillCategory, SkillNode } from "./types";

type LocalizedString = { ru: string; en: string };
type LocalizedArray = { ru: string[]; en: string[] };

interface SkillNodeTemplate {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  extendedDescription: LocalizedString;
  mechanics: LocalizedArray;
  synergies: LocalizedArray;
  requiredNodes: string[];
  unlockCondition: string;
  xpReward: number;
  category: SkillCategory;
  icon: string;
  accentColor: string;
}

const SKILL_NODE_TEMPLATES: SkillNodeTemplate[] = [
  // ============ BODY CATEGORY ============
  {
    id: "body-rhythm",
    title: { ru: "Ритм тела", en: "Body rhythm" },
    description: { ru: "Базовая ветка дисциплины тела и энергии.", en: "A foundational branch for body discipline and energy." },
    extendedDescription: {
      ru: "Ритм тела — это основа физического развития. Этот навык устанавливает связь между твоими ежедневными действиями и игровым прогрессом. Когда ты поддерживаешь регулярный режим активности, твой персонаж получает бонусы к восстановлению энергии и общей выносливости.",
      en: "Body rhythm is the foundation of physical development. This skill establishes a connection between your daily actions and game progress. When you maintain a regular activity routine, your character receives bonuses to energy recovery and overall stamina."
    },
    mechanics: {
      ru: [
        "Увеличивает восстановление энергии на 5% за каждый уровень навыка",
        "Даёт +10% к эффективности водных тренировок",
        "Открывает доступ к продвинутым физическим квестам"
      ],
      en: [
        "Increases energy recovery by 5% per skill level",
        "Provides +10% efficiency for water training quests",
        "Unlocks access to advanced physical quests"
      ]
    },
    synergies: {
      ru: ["Синергия с навыком 'Выносливость' — совместное использование удваивает бонус"],
      en: ["Synergy with 'Stamina' skill — combined use doubles the bonus"]
    },
    requiredNodes: [],
    unlockCondition: "goal_selected",
    xpReward: 40,
    category: "body",
    icon: "run-fast",
    accentColor: "#22c55e",
  },
  {
    id: "body-stamina",
    title: { ru: "Выносливость", en: "Stamina" },
    description: { ru: "Закрепляет регулярную физическую нагрузку.", en: "Strengthens regular physical effort." },
    extendedDescription: {
      ru: "Выносливость — это способность тела справляться с повышенными нагрузками. Этот навык напрямую влияет на максимальный запас здоровья персонажа и позволяет выполнять более сложные физические задачи без штрафов к эффективности.",
      en: "Stamina is the body's ability to handle increased loads. This skill directly affects the character's maximum health pool and allows completing more complex physical tasks without efficiency penalties."
    },
    mechanics: {
      ru: [
        "+15 HP к максимальному здоровью за уровень",
        "Уменьшает штраф за пропущенные тренировки на 20%",
        "Увеличивает дневной лимит активных квестов на 1"
      ],
      en: [
        "+15 HP to maximum health per level",
        "Reduces penalty for missed workouts by 20%",
        "Increases daily limit of active quests by 1"
      ]
    },
    synergies: {
      ru: ["Работает с 'Ритм тела' для общего увеличения выносливости", "Усиливает эффект экипировки с атрибутом выносливости"],
      en: ["Works with 'Body rhythm' for overall stamina increase", "Enhances equipment effects with stamina attribute"]
    },
    requiredNodes: ["body-rhythm"],
    unlockCondition: "goal_points:4",
    xpReward: 60,
    category: "body",
    icon: "heart-pulse",
    accentColor: "#22c55e",
  },
  {
    id: "body-strength",
    title: { ru: "Сила", en: "Strength" },
    description: { ru: "Развивает физическую силу и мощь.", en: "Develops physical strength and power." },
    extendedDescription: {
      ru: "Сила определяет способность персонажа выполнять задачи, требующие физического усилия. Этот навык влияет на боеспособность в физических испытаниях и открывает доступ к оружию ближнего боя с повышенным уроном.",
      en: "Strength determines the character's ability to perform tasks requiring physical effort. This skill affects combat capability in physical challenges and unlocks melee weapons with increased damage."
    },
    mechanics: {
      ru: [
        "+10% к урону в физических испытаниях",
        "Увеличивает награды за силовые квесты на 15%",
        "Открывает класс 'Воин' для прогресса"
      ],
      en: [
        "+10% damage in physical challenges",
        "Increases rewards for strength quests by 15%",
        "Unlocks 'Warrior' class for progression"
      ]
    },
    synergies: {
      ru: ["Синергия с экипировкой ближнего боя", "Усиливает эффект 'Выносливости' при ношении брони"],
      en: ["Synergy with melee equipment", "Enhances 'Stamina' effect when wearing armor"]
    },
    requiredNodes: ["body-stamina"],
    unlockCondition: "goal_points:8",
    xpReward: 80,
    category: "body",
    icon: "arm-flex",
    accentColor: "#16a34a",
  },

  // ============ MIND CATEGORY ============
  {
    id: "mind-focus",
    title: { ru: "Фокус ума", en: "Mental focus" },
    description: { ru: "Учит держать внимание и не распыляться.", en: "Trains focus and protects attention." },
    extendedDescription: {
      ru: "Фокус ума — это способность концентрироваться на поставленных целях и не отвлекаться на внешние раздражители. Этот навык критически важен для выполнения квестов, требующих точности и внимательности, а также для эффективного обучения.",
      en: "Mental focus is the ability to concentrate on set goals and not be distracted by external stimuli. This skill is critical for completing quests requiring precision and attentiveness, as well as for effective learning."
    },
    mechanics: {
      ru: [
        "+20% к эффективности квестов концентрации",
        "Увеличивает время удержания цели на 25%",
        "Даёт бонус к 'Интеллекту' при медитации"
      ],
      en: [
        "+20% efficiency for concentration quests",
        "Increases goal retention time by 25%",
        "Provides bonus to 'Intellect' during meditation"
      ]
    },
    synergies: {
      ru: ["Работает с 'Глубина обучения' для усиления прогресса в знаниях"],
      en: ["Works with 'Learning depth' to enhance knowledge progression"]
    },
    requiredNodes: [],
    unlockCondition: "goal_selected",
    xpReward: 40,
    category: "mind",
    icon: "brain",
    accentColor: "#3b82f6",
  },
  {
    id: "mind-depth",
    title: { ru: "Глубина обучения", en: "Learning depth" },
    description: { ru: "Продвигает в сторону глубокого понимания и системного роста.", en: "Pushes you toward deep understanding and structured growth." },
    extendedDescription: {
      ru: "Глубина обучения отражает способность не просто запоминать информацию, но и понимать её на более глубоком уровне. Этот навык влияет на качество прогресса в интеллектуальных квестах и открывает доступ к сложным образовательным активностям.",
      en: "Learning depth reflects the ability to not just memorize information, but understand it at a deeper level. This skill affects the quality of progress in intellectual quests and unlocks access to complex educational activities."
    },
    mechanics: {
      ru: [
        "+25% XP за образовательные квесты",
        "Увеличивает бонус к 'Интеллекту' на 15%",
        "Открывает доступ к 'Магу' классу"
      ],
      en: [
        "+25% XP for educational quests",
        "Increases 'Intellect' bonus by 15%",
        "Unlocks access to 'Mage' class"
      ]
    },
    synergies: {
      ru: ["Синергия с 'Фокус ума' — вместе дают двойной бонус к XP", "Усиливает эффект книг и лекций"],
      en: ["Synergy with 'Mental focus' — together give double XP bonus", "Enhances effect of books and lectures"]
    },
    requiredNodes: ["mind-focus"],
    unlockCondition: "goal_points:6",
    xpReward: 70,
    category: "mind",
    icon: "book-open-page-variant",
    accentColor: "#3b82f6",
  },
  {
    id: "mind-meditation",
    title: { ru: "Осознанность", en: "Mindfulness" },
    description: { ru: "Развивает практику осознанности и присутствия.", en: "Develops mindfulness and presence practice." },
    extendedDescription: {
      ru: "Осознанность — это практика нахождения в настоящем моменте без суждений. Этот навык помогает справляться со стрессом, улучшает качество сна и открывает доступ к специальным медитативным кветам с уникальными наградами.",
      en: "Mindfulness is the practice of being in the present moment without judgment. This skill helps cope with stress, improves sleep quality, and unlocks access to special meditative quests with unique rewards."
    },
    mechanics: {
      ru: [
        "+10% к восстановлению здоровья во сне",
        "Увеличивает бонус серии на 5%",
        "Открывает медитативные квесты"
      ],
      en: [
        "+10% to health recovery during sleep",
        "Increases streak bonus by 5%",
        "Unlocks meditative quests"
      ]
    },
    synergies: {
      ru: ["Работает со всеми навыками категории 'Mind' для общего усиления"],
      en: ["Works with all 'Mind' category skills for overall enhancement"]
    },
    requiredNodes: ["mind-focus"],
    unlockCondition: "level:2",
    xpReward: 55,
    category: "mind",
    icon: "meditation",
    accentColor: "#60a5fa",
  },

  // ============ CAREER CATEGORY ============
  {
    id: "career-discipline",
    title: { ru: "Карьерная дисциплина", en: "Career discipline" },
    description: { ru: "Поддерживает системные действия в работе и профессии.", en: "Supports consistent action in work and career." },
    extendedDescription: {
      ru: "Карьерная дисциплина — это способность поддерживать продуктивность в профессиональной деятельности. Этот навык помогает фокусироваться на рабочих задачах и получать дополнительные награды за продуктивность.",
      en: "Career discipline is the ability to maintain productivity in professional activity. This skill helps focus on work tasks and receive additional rewards for productivity."
    },
    mechanics: {
      ru: [
        "+15% к эффективности рабочих квестов",
        "Увеличивает дневную продуктивность на 10%",
        "Открывает карьерные испытания"
      ],
      en: [
        "+15% efficiency for work quests",
        "Increases daily productivity by 10%",
        "Unlocks career challenges"
      ]
    },
    synergies: {
      ru: ["Работает с 'Мастерство' для максимизации карьерного роста"],
      en: ["Works with 'Mastery' to maximize career growth"]
    },
    requiredNodes: [],
    unlockCondition: "goal_selected",
    xpReward: 40,
    category: "career",
    icon: "briefcase-variant-outline",
    accentColor: "#c084fc",
  },
  {
    id: "career-mastery",
    title: { ru: "Мастерство", en: "Mastery" },
    description: { ru: "Ведет к качественной практике и заметному результату.", en: "Leads to high-quality practice and visible results." },
    extendedDescription: {
      ru: "Мастерство представляет собой высокий уровень профессионального мастерства в выбранной области. Этот навык открывает доступ к сложным проектам и значительно увеличивает награды за качественную работу.",
      en: "Mastery represents a high level of professional expertise in a chosen field. This skill unlocks access to complex projects and significantly increases rewards for quality work."
    },
    mechanics: {
      ru: [
        "+30% к наградам за проекты",
        "Увеличивает шанс 'Критической работы' на 15%",
        "Открывает эпические карьерные квесты"
      ],
      en: [
        "+30% to project rewards",
        "Increases 'Critical work' chance by 15%",
        "Unlocks epic career quests"
      ]
    },
    synergies: {
      ru: ["Синергия с 'Карьерная дисциплина' — требуется для активации", "Усиливает эффект всех профессиональных квестов"],
      en: ["Synergy with 'Career discipline' — required for activation", "Enhances effect of all professional quests"]
    },
    requiredNodes: ["career-discipline"],
    unlockCondition: "level:3",
    xpReward: 80,
    category: "career",
    icon: "medal-outline",
    accentColor: "#c084fc",
  },

  // ============ SOCIAL CATEGORY ============
  {
    id: "social-presence",
    title: { ru: "Социальное присутствие", en: "Social presence" },
    description: { ru: "Помогает укреплять связи и проявляться в общении.", en: "Helps strengthen relationships and show up in conversations." },
    extendedDescription: {
      ru: "Социальное присутствие — это способность быть активным и заметным в социальных взаимодействиях. Этот навык помогает строить отношения и открывает доступ к социальным кветам и испытаниям.",
      en: "Social presence is the ability to be active and noticeable in social interactions. This skill helps build relationships and unlocks access to social quests and challenges."
    },
    mechanics: {
      ru: [
        "+20% к эффективности социальных квестов",
        "Увеличивает награды за дружбу на 15%",
        "Открывает PvP испытания"
      ],
      en: [
        "+20% efficiency for social quests",
        "Increases friendship rewards by 15%",
        "Unlocks PvP challenges"
      ]
    },
    synergies: {
      ru: ["Работает с 'Влияние' для усиления социального воздействия"],
      en: ["Works with 'Influence' to enhance social impact"]
    },
    requiredNodes: [],
    unlockCondition: "goal_selected",
    xpReward: 40,
    category: "social",
    icon: "account-group-outline",
    accentColor: "#f59e0b",
  },
  {
    id: "social-influence",
    title: { ru: "Влияние", en: "Influence" },
    description: { ru: "Дает толчок к уверенным действиям в социуме и переговорах.", en: "Pushes toward confident action in social situations and negotiation." },
    extendedDescription: {
      ru: "Влияние — это способность убеждать и воздействовать на других людей. Этот навык критически важен для социальных испытаний, переговоров и лидерских ролей в командных кветах.",
      en: "Influence is the ability to persuade and impact other people. This skill is critical for social challenges, negotiations, and leadership roles in team quests."
    },
    mechanics: {
      ru: [
        "+25% к успеху в переговорах",
        "Увеличивает награды за лидерство на 20%",
        "Открывает эпические социальные события"
      ],
      en: [
        "+25% to negotiation success",
        "Increases leadership rewards by 20%",
        "Unlocks epic social events"
      ]
    },
    synergies: {
      ru: ["Требует 'Социальное присутствие' для активации", "Усиливает эффект командных квестов"],
      en: ["Requires 'Social presence' to activate", "Enhances effect of team quests"]
    },
    requiredNodes: ["social-presence"],
    unlockCondition: "streak:5",
    xpReward: 75,
    category: "social",
    icon: "bullhorn-outline",
    accentColor: "#f59e0b",
  },

  // ============ FINANCE CATEGORY ============
  {
    id: "finance-order",
    title: { ru: "Финансовый порядок", en: "Financial order" },
    description: { ru: "Учит регулярному контролю денег и бюджета.", en: "Builds regular control over money and budget." },
    extendedDescription: {
      ru: "Финансовый порядок — это система управления личными финансами. Этот навык помогает отслеживать доходы и расходы, что напрямую влияет на игровую экономику персонажа.",
      en: "Financial order is a personal finance management system. This skill helps track income and expenses, which directly affects the character's game economy."
    },
    mechanics: {
      ru: [
        "+10% бонуса к золоту за все квесты",
        "Увеличивает эффективность финансовых квестов на 20%",
        "Открывает доступ к инвестиционным активностям"
      ],
      en: [
        "+10% gold bonus for all quests",
        "Increases efficiency of financial quests by 20%",
        "Unlocks access to investment activities"
      ]
    },
    synergies: {
      ru: ["Работает с 'Рост капитала' для комплексного финансового развития"],
      en: ["Works with 'Capital growth' for comprehensive financial development"]
    },
    requiredNodes: [],
    unlockCondition: "goal_selected",
    xpReward: 40,
    category: "finance",
    icon: "cash-check",
    accentColor: "#eab308",
  },
  {
    id: "finance-growth",
    title: { ru: "Рост капитала", en: "Capital growth" },
    description: { ru: "Продвигает к накоплению, резерву и устойчивому доходу.", en: "Pushes toward savings, reserve, and durable income." },
    extendedDescription: {
      ru: "Рост капитала представляет собой продвинутый уровень финансового управления, направленный на создание пассивного дохода и накоплений. Этот навык открывает доступ к сложным финансовым инструментам и значительно увеличивает игровое золото.",
      en: "Capital growth represents an advanced level of financial management aimed at creating passive income and savings. This skill unlocks access to complex financial instruments and significantly increases game gold."
    },
    mechanics: {
      ru: [
        "+25% к финансовым наградам",
        "Увеличивает бонус золота на 15%",
        "Открывает эпические финансовые события"
      ],
      en: [
        "+25% to financial rewards",
        "Increases gold bonus by 15%",
        "Unlocks epic financial events"
      ]
    },
    synergies: {
      ru: ["Требует 'Финансовый порядок' для активации", "Синергия с экономическими событиями"],
      en: ["Requires 'Financial order' to activate", "Synergy with economic events"]
    },
    requiredNodes: ["finance-order"],
    unlockCondition: "goal_points:8",
    xpReward: 90,
    category: "finance",
    icon: "bank-outline",
    accentColor: "#eab308",
  },
];

export function buildSkillTree(language: Language): SkillNode[] {
  return SKILL_NODE_TEMPLATES.map((node) => ({
    ...node,
    title: pickLocalized(language, node.title),
    description: pickLocalized(language, node.description),
    extendedDescription: pickLocalized(language, node.extendedDescription),
    mechanics: pickLocalizedArray(language, node.mechanics),
    synergies: pickLocalizedArray(language, node.synergies),
    progress: 0,
    unlocked: false,
  }));
}

export function getSkillCategories(language: Language): Array<{ id: SkillCategory; title: string; description: string }> {
  return [
    { 
      id: "body", 
      title: language === "en" ? "Body" : "Тело",
      description: language === "en" ? "Physical health, strength and endurance" : "Физическое здоровье, сила и выносливость"
    },
    { 
      id: "mind", 
      title: language === "en" ? "Mind" : "Разум",
      description: language === "en" ? "Learning, focus and mindfulness" : "Обучение, концентрация и осознанность"
    },
    { 
      id: "career", 
      title: language === "en" ? "Career" : "Карьера",
      description: language === "en" ? "Professional development and mastery" : "Профессиональное развитие и мастерство"
    },
    { 
      id: "social", 
      title: language === "en" ? "Social" : "Социум",
      description: language === "en" ? "Relationships and social influence" : "Отношения и социальное влияние"
    },
    { 
      id: "finance", 
      title: language === "en" ? "Finance" : "Финансы",
      description: language === "en" ? "Financial management and growth" : "Управление финансами и рост"
    },
  ];
}

/**
 * Get detailed skill information for display
 */
export function getSkillDetails(skillId: string, language: Language): SkillNode | null {
  const skill = SKILL_NODE_TEMPLATES.find(s => s.id === skillId);
  if (!skill) return null;
  
  return {
    ...skill,
    title: pickLocalized(language, skill.title),
    description: pickLocalized(language, skill.description),
    extendedDescription: pickLocalized(language, skill.extendedDescription),
    mechanics: pickLocalizedArray(language, skill.mechanics),
    synergies: pickLocalizedArray(language, skill.synergies),
    progress: 0,
    unlocked: false,
  };
}
