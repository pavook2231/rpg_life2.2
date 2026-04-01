import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { fetchGoalTemplates, updateProfile, type GoalTemplatePayload } from "../api/game";
import { Screen } from "../components/Screen";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../context/FeedbackContext";
import { useGameAchievements, useGameProgress } from "../context/GameContext";
import { useLocalization, useTranslation } from "../context/LocalizationContext";
import { getClassLabel, getRarityColor, normalizeDisplayText } from "../lib/gameUi";
import { clearGoalSetupPending } from "../storage/beginnerOnboardingStorage";
import { Button, Card, GameIcon, Modal, ProfileHeroCard, radii, useThemeColors, useThemeMode } from "../ui";

function getFallbackGoals(t: (key: string, params?: Record<string, string | number>) => string): GoalTemplatePayload["goals"] {
  return [
    {
      id: "lose",
      title: "Снижение веса",
      description: "Детерминированная программа снижения веса с обязательным стартовым блоком и адаптивной ходьбой.",
      result_example: "Понятный маршрут и регулярный weekly review вместо случайных задач.",
      icon: "run-fast",
      accent_color: "#2ecc71",
      recommended_term_months: 6,
      is_primary: true,
    },
    {
      id: "maintain",
      title: "Удержание веса",
      description: "Профиль можно сохранить, но полноценная программа удержания пока ещё не включена.",
      result_example: "Этот режим будет добавлен отдельным этапом.",
      icon: "scale-balance",
      accent_color: "#3498db",
      recommended_term_months: 6,
      is_primary: false,
    },
    {
      id: "gain",
      title: "Набор веса",
      description: "Профиль можно сохранить, но программа набора пока находится в подготовке.",
      result_example: "Когда режим будет готов, он получит отдельную механику.",
      icon: "arm-flex",
      accent_color: "#e67e22",
      recommended_term_months: 6,
      is_primary: false,
    },
  ];
}

function isValidProfileName(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && !/^\d/.test(trimmed);
}

function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

function isValidUsername(value: string) {
  return /^[a-z][a-z0-9_]{2,23}$/.test(normalizeUsernameInput(value));
}

function getAchievementStatusLabel(t: (key: string, params?: Record<string, string | number>) => string, status?: string | null) {
  if (status === "earned") return t("screens.profile.achievementStatus.earned");
  if (status === "available") return t("screens.profile.achievementStatus.available");
  if (status === "locked") return t("screens.profile.achievementStatus.locked");
  return t("screens.profile.achievementStatus.unknown");
}

function translateOrFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

function QuickActionRow({
  icon,
  label,
  subtitle,
  onPress,
  readOnly = false,
  styles,
  colors,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  readOnly?: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable style={styles.quickRow} onPress={onPress} disabled={readOnly}>
      <View style={styles.quickRowLeft}>
        <View style={styles.quickIconWrap}>
          <GameIcon name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.quickCopy}>
          <Text style={styles.quickLabel}>{label}</Text>
          {subtitle ? (
            <Text style={styles.quickSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {!readOnly ? <GameIcon name="chevron-right" size={18} color={colors.textDim} /> : null}
    </Pressable>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { language } = useLocalization();
  const t = useTranslation();
  const fallbackGoals = useMemo(() => getFallbackGoals(t), [t]);
  const { profile, hero, refreshGame } = useGameProgress();
  const { achievements } = useGameAchievements();
  const { signOut } = useAuth();
  const { pushToast } = useFeedback();
  const colors = useThemeColors();
  const themeMode = useThemeMode();
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [birthYear, setBirthYear] = useState("2000");
  const [selectedAchievement, setSelectedAchievement] = useState<any>(null);
  const [goalType, setGoalType] = useState("lose");
  const [goalTermMonths, setGoalTermMonths] = useState(6);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplatePayload["goals"]>(fallbackGoals);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isApplyingGoalCycle, setIsApplyingGoalCycle] = useState(false);

  useEffect(() => {
    setName(profile?.user?.name ?? "");
    setUsername(profile?.user?.username ?? "");
    setCharacterName(hero?.name ?? profile?.user?.name ?? "");
    setBirthYear(String(profile?.user?.birth_year ?? 2000));
    setGoalType(profile?.user?.goal_type ?? "lose");
    setGoalTermMonths(profile?.user?.goal_term_months ?? 6);
  }, [hero?.name, profile?.user?.birth_year, profile?.user?.goal_term_months, profile?.user?.goal_type, profile?.user?.name, profile?.user?.username]);

  useEffect(() => {
    let active = true;
    fetchGoalTemplates()
      .then((payload) => {
        if (!active) return;
        setGoalTemplates(payload.goals?.length ? payload.goals : fallbackGoals);
      })
      .catch(() => {
        if (active) {
          setGoalTemplates(fallbackGoals);
        }
      });
    return () => {
      active = false;
    };
  }, [fallbackGoals]);

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedUsername = normalizeUsernameInput(username);
    const trimmedCharacterName = characterName.trim();
    const numericBirthYear = Number(birthYear);
    const currentYear = new Date().getFullYear();

    if (!isValidProfileName(trimmedName)) {
      await pushToast({
        title: t("screens.profile.errors.failedToSave"),
        description: t("screens.profile.quick.invalidAccountName"),
        icon: "account-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (!isValidUsername(trimmedUsername)) {
      await pushToast({
        title: t("screens.profile.errors.failedToSave"),
        description: t("screens.profile.quick.invalidUsername"),
        icon: "at",
        tone: "warning",
      });
      return;
    }

    if (!isValidProfileName(trimmedCharacterName)) {
      await pushToast({
        title: t("screens.profile.errors.failedToSave"),
        description: t("screens.profile.quick.invalidCharacterName"),
        icon: "account-alert-outline",
        tone: "warning",
      });
      return;
    }

    if (!Number.isInteger(numericBirthYear) || numericBirthYear < 1950 || numericBirthYear > currentYear - 10) {
      await pushToast({
        title: t("screens.profile.errors.failedToSave"),
        description: t("screens.profile.quick.invalidBirthYear", { year: currentYear - 10 }),
        icon: "calendar-alert",
        tone: "warning",
      });
      return;
    }

    try {
      setIsSavingProfile(true);
      await updateProfile({
        name: trimmedName,
        username: trimmedUsername,
        character_name: trimmedCharacterName,
        birth_year: numericBirthYear,
        gender: profile?.user?.gender ?? "male",
        goal_type: goalType,
        goal_term_months: goalTermMonths,
        start_new_goal_cycle: false,
      });
      if (profile?.user?.id) {
        await clearGoalSetupPending(profile.user.id);
      }
      await refreshGame();
      await pushToast(
        {
          title: t("screens.profile.errors.profileUpdated"),
          description: t("screens.profile.errors.changesSaved"),
          icon: "content-save-check-outline",
          tone: "success",
        },
        { haptic: "success" },
      );
    } catch (error) {
      await pushToast({
        title: t("screens.profile.errors.failedToSave"),
        description: error instanceof Error ? error.message : t("common.error"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleApplyGoalCycle() {
    try {
      setIsApplyingGoalCycle(true);
      await updateProfile({
        goal_type: goalType,
        goal_term_months: goalTermMonths,
        start_new_goal_cycle: true,
      });
      if (profile?.user?.id) {
        await clearGoalSetupPending(profile.user.id);
      }
      await refreshGame();
      await pushToast(
        {
          title: t("screens.profile.quick.goalUpdatedTitle"),
          description: t("screens.profile.quick.goalUpdatedDescription"),
          icon: "flag-checkered",
          tone: "success",
        },
        { haptic: "success" },
      );
    } catch (error) {
      await pushToast({
        title: t("screens.profile.quick.goalUpdateFailed"),
        description: error instanceof Error ? error.message : t("common.error"),
        icon: "alert-circle",
        tone: "warning",
      });
    } finally {
      setIsApplyingGoalCycle(false);
    }
  }

  const currentLanguageLabel = t(`settings.languageSwitcher.${language}`);
  const displayHeroName = normalizeDisplayText(hero?.name ?? profile?.user?.name ?? t("screens.profile.unknownHero"));
  const displayUsername = normalizeDisplayText(profile?.user?.username ? `@${profile.user.username}` : "-");
  const displayFriendId = normalizeDisplayText(profile?.user?.friend_id ?? "-");
  const displayClass = getClassLabel(hero?.class ?? undefined, t);
  const earnedAchievements = useMemo(
    () => (achievements ?? []).filter((achievement) => achievement.status === "earned").length,
    [achievements],
  );
  const previewAchievements = useMemo(() => (achievements ?? []).slice(0, 8), [achievements]);
  const isBeginnerProfile = (hero?.level ?? 1) <= 1 && (hero?.current_xp ?? 0) <= 0;
  const showAchievementPreview = !isBeginnerProfile || earnedAchievements > 0;

  return (
    <Screen title={t("screens.profile.title")} subtitle={t("screens.profile.subtitle")}>
      <ProfileHeroCard
        name={displayHeroName}
        heroClass={hero?.class}
        level={hero?.level ?? 1}
        currentXp={hero?.current_xp ?? 0}
        nextLevelXp={hero?.next_level_xp ?? 120}
        gold={hero?.crystals ?? 0}
        streak={hero?.streak ?? 0}
        healthCurrent={hero?.health?.current_health ?? profile?.health?.current_health ?? null}
        healthMax={hero?.health?.max_health ?? profile?.health?.max_health ?? null}
        isWounded={hero?.health?.is_wounded ?? profile?.health?.is_wounded ?? false}
        penaltyQuestsRemaining={hero?.health?.penalty_quests_remaining ?? profile?.health?.penalty_quests_remaining ?? 0}
        rewardPenaltyPercent={hero?.health?.reward_penalty_percent ?? profile?.health?.reward_penalty_percent ?? 0}
        subtitle={`${displayClass} | ${displayUsername}`}
      />

      {isBeginnerProfile ? (
        <Card tone="subtle">
          <Text style={styles.sectionTitle}>
            {translateOrFallback(t, "screens.profile.beginnerTitle", "С чего начать в профиле")}
          </Text>
          <Text style={styles.quickSubtitle}>
            {translateOrFallback(
              t,
              "screens.profile.beginnerDescription",
              "Сейчас здесь достаточно трёх вещей: проверить имя, выбрать цель и сохранить удобные для себя настройки.",
            )}
          </Text>
          <View style={styles.beginnerChecklist}>
            <QuickActionRow
              icon="account-edit-outline"
              label={translateOrFallback(t, "screens.profile.beginnerIdentityTitle", "Проверь имя и ник")}
              subtitle={translateOrFallback(
                t,
                "screens.profile.beginnerIdentityDescription",
                "Так тебя будет проще узнать в приложении, когда откроются остальные системы.",
              )}
              onPress={() => undefined}
              readOnly
              styles={styles}
              colors={colors}
            />
            <QuickActionRow
              icon="flag-checkered"
              label={translateOrFallback(t, "screens.profile.beginnerGoalTitle", "Выбери направление")}
              subtitle={translateOrFallback(
                t,
                "screens.profile.beginnerGoalDescription",
                "От выбранной цели зависит, какие задания и подсказки приложение будет показывать дальше.",
              )}
              onPress={() => undefined}
              readOnly
              styles={styles}
              colors={colors}
            />
            <QuickActionRow
              icon="content-save-outline"
              label={translateOrFallback(t, "screens.profile.beginnerSaveTitle", "Сохрани изменения")}
              subtitle={translateOrFallback(
                t,
                "screens.profile.beginnerSaveDescription",
                "После этого можно возвращаться на главную и проходить первые шаги без лишней путаницы.",
              )}
              onPress={() => undefined}
              readOnly
              styles={styles}
              colors={colors}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {translateOrFallback(t, "screens.profile.identityTitle", "Личные данные")}
          </Text>
          <Text style={styles.sectionMeta}>{currentLanguageLabel}</Text>
        </View>

        <Text style={styles.quickSubtitle}>
          {displayUsername} {displayFriendId !== "-" ? `| ${displayFriendId}` : ""}
        </Text>

        <TextInput
          placeholder={t("screens.profile.accountName")}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          placeholder={t("screens.profile.username")}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          placeholder={t("screens.profile.characterName")}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          value={characterName}
          onChangeText={setCharacterName}
        />
        <TextInput
          placeholder={t("screens.profile.birthYear")}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          value={birthYear}
          onChangeText={setBirthYear}
          keyboardType="numeric"
        />

        <Button
          label={isSavingProfile ? t("common.loading") : t("screens.profile.save")}
          icon="content-save-outline"
          onPress={handleSave}
          loading={isSavingProfile}
        />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {translateOrFallback(t, "screens.profile.goalCardTitle", "Цель и направление")}
          </Text>
          <Text style={styles.sectionMeta}>{profile?.user?.goal_progress_percent ?? 0}%</Text>
        </View>
        <Text style={styles.quickSubtitle}>{t("screens.profile.quick.goalsSubtitle")}</Text>

        <View style={styles.goalGrid}>
          {(goalTemplates.length ? goalTemplates : []).slice(0, 5).map((goal) => {
            const active = goalType === goal.id;
            return (
              <Pressable
                key={goal.id}
                style={[styles.goalChip, active ? styles.goalChipActive : null]}
                onPress={() => setGoalType(goal.id)}
              >
                <Text style={[styles.goalChipText, active ? styles.goalChipTextActive : null]} numberOfLines={2}>
                  {goal.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.goalTermRow}>
          {[3, 6, 9].map((months) => (
            <Pressable
              key={months}
              style={[styles.goalTermChip, goalTermMonths === months ? styles.goalTermChipActive : null]}
              onPress={() => setGoalTermMonths(months)}
            >
              <Text style={[styles.goalTermText, goalTermMonths === months ? styles.goalTermTextActive : null]}>
                {t("screens.profile.quick.goalTermMonths", { months })}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button
          label={isApplyingGoalCycle ? t("common.loading") : t("screens.profile.quick.applyGoalCycle")}
          icon="flag-checkered"
          onPress={handleApplyGoalCycle}
          loading={isApplyingGoalCycle}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {translateOrFallback(t, "screens.profile.usefulSectionsTitle", "Полезные разделы")}
        </Text>
        <LanguageSwitcher />

        <View style={styles.quickList}>
          <QuickActionRow
            icon="account-multiple-outline"
            label={t("screens.friends.title")}
            subtitle={t("screens.friends.subtitle")}
            onPress={() => navigation.navigate("Friends", { initialTab: "friends", focusSearch: true, requestedAt: Date.now() })}
            styles={styles}
            colors={colors}
          />
          <QuickActionRow
            icon="podium-gold"
            label={t("screens.leaderboard.title")}
            subtitle={t("screens.leaderboard.subtitle")}
            onPress={() => navigation.navigate("Leaderboard", { requestedAt: Date.now() })}
            styles={styles}
            colors={colors}
          />
          <QuickActionRow
            icon="cog-outline"
            label={t("screens.settings.title")}
            subtitle={t("screens.settings.subtitle")}
            onPress={() => navigation.navigate("Settings")}
            styles={styles}
            colors={colors}
          />
          <QuickActionRow
            icon="trophy-variant-outline"
            label={t("screens.profile.achievements")}
            subtitle={t("screens.profile.quick.achievementsSubtitle")}
            onPress={() => navigation.navigate("Achievements")}
            styles={styles}
            colors={colors}
          />
          <QuickActionRow
            icon="lifebuoy"
            label={t("screens.help.title")}
            subtitle={t("screens.help.subtitle")}
            onPress={() => navigation.navigate("Help")}
            styles={styles}
            colors={colors}
          />
        </View>

        <Button label={t("screens.profile.logout")} icon="logout-variant" onPress={signOut} variant="danger" />
      </Card>

      {showAchievementPreview ? (
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("screens.profile.achievements")}</Text>
            <Text style={styles.sectionMeta}>
              {earnedAchievements}/{achievements?.length ?? 0}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRow}>
            {previewAchievements.map((achievement) => {
              const accent = getRarityColor(achievement.status);
              return (
                <Pressable
                  key={achievement.id}
                  style={[styles.achievementTile, { borderColor: accent, opacity: achievement.status === "locked" ? 0.58 : 1 }]}
                  onPress={() => setSelectedAchievement(achievement)}
                >
                  <View style={[styles.achievementArt, { backgroundColor: `${accent}22` }]}>
                    <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                  </View>
                  <Text style={styles.achievementName} numberOfLines={2}>
                    {normalizeDisplayText(achievement.title)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Button
            label={t("screens.profile.quick.openAllAchievements")}
            icon="trophy-variant-outline"
            variant="secondary"
            onPress={() => navigation.navigate("Achievements")}
          />
        </Card>
      ) : (
        <Card tone="subtle">
          <Text style={styles.sectionTitle}>
            {translateOrFallback(t, "screens.profile.achievementsLockedTitle", "Достижения откроются чуть позже")}
          </Text>
          <Text style={styles.quickSubtitle}>
            {translateOrFallback(
              t,
              "screens.profile.achievementsLockedDescription",
              "Сначала пройди первые шаги: выбери цель, закрой первое задание и забери первую награду. После этого достижения начнут заполняться сами.",
            )}
          </Text>
        </Card>
      )}

      <Modal
        visible={Boolean(selectedAchievement)}
        title={normalizeDisplayText(selectedAchievement?.title ?? "")}
        subtitle={
          selectedAchievement
            ? `${getAchievementStatusLabel(t, selectedAchievement.status)} | +${selectedAchievement.xp_reward ?? 0} XP | +${selectedAchievement.crystal_reward ?? 0} ${t("common.gold")}`
            : undefined
        }
        description={normalizeDisplayText(selectedAchievement?.description ?? "")}
        onClose={() => setSelectedAchievement(null)}
      >
        {selectedAchievement ? (
          <View style={styles.modalAchievement}>
            <Text style={styles.modalAchievementIcon}>{selectedAchievement.icon}</Text>
            <Text style={styles.modalAchievementMeta}>
              {t("screens.profile.achievementStatus.earned")}: {getAchievementStatusLabel(t, selectedAchievement.status)}
            </Text>
            {selectedAchievement.earned_at ? (
              <Text style={styles.modalAchievementMeta}>
                {t("screens.profile.earnedAt")}: {selectedAchievement.earned_at}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, themeMode: ReturnType<typeof useThemeMode>) {
  return StyleSheet.create({
    heroCard: {
      gap: 12,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    heroTopRowCompact: {
      flexDirection: "column",
      alignItems: "stretch",
    },
    heroIdentity: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    heroCopy: {
      flex: 1,
      gap: 2,
    },
    heroName: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },
    heroClass: {
      color: colors.primary,
      fontWeight: "800",
      fontSize: 13,
    },
    heroEmail: {
      color: colors.textMuted,
      fontWeight: "700",
      fontSize: 13,
    },
    levelBadge: {
      minWidth: 96,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "#f2dfbf" : "#3f2a08",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    levelBadgeCompact: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    levelBadgeLabel: {
      color: themeMode === "light" ? "#7a4b12" : "#fde68a",
      fontSize: 11,
      fontWeight: "700",
    },
    levelBadgeValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
    },
    infoChipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    infoChip: {
      flexGrow: 1,
      minWidth: 106,
      flexBasis: "31%",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: themeMode === "light" ? "rgba(255,250,240,0.9)" : "rgba(7, 12, 24, 0.45)",
    },
    infoChipIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    infoChipCopy: {
      flex: 1,
      gap: 2,
    },
    infoChipLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
    },
    infoChipValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    sectionMeta: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "800",
    },
    input: {
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 11,
      color: colors.text,
    },
    quickList: {
      gap: 8,
    },
    beginnerChecklist: {
      gap: 8,
    },
    quickRow: {
      minHeight: 60,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    quickRowLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    quickIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: themeMode === "light" ? "rgba(183,121,31,0.16)" : "rgba(245, 158, 11, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.24)",
      alignItems: "center",
      justifyContent: "center",
    },
    quickCopy: {
      flex: 1,
      gap: 2,
    },
    quickLabel: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 14,
    },
    quickSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    goalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    goalChip: {
      flexGrow: 1,
      minWidth: 120,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    goalChipActive: {
      borderColor: colors.gold,
      backgroundColor: themeMode === "light" ? "#f2dfbf" : "#3f2a08",
    },
    goalChipText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    goalChipTextActive: {
      color: themeMode === "light" ? "#7a4b12" : "#fde68a",
    },
    goalTermRow: {
      flexDirection: "row",
      gap: 8,
    },
    goalTermChip: {
      flex: 1,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundInset,
      alignItems: "center",
      paddingVertical: 9,
    },
    goalTermChipActive: {
      borderColor: colors.primary,
      backgroundColor: themeMode === "light" ? "#f2dfbf" : "#112036",
    },
    goalTermText: {
      color: colors.textMuted,
      fontWeight: "700",
    },
    goalTermTextActive: {
      color: themeMode === "light" ? "#7a4b12" : "#bfdbfe",
    },
    achievementRow: {
      gap: 10,
      paddingRight: 4,
    },
    achievementTile: {
      width: 88,
      backgroundColor: colors.backgroundInset,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: "center",
      gap: 6,
    },
    achievementArt: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    achievementIcon: {
      fontSize: 22,
    },
    achievementName: {
      color: colors.text,
      fontSize: 10,
      lineHeight: 12,
      textAlign: "center",
      fontWeight: "700",
    },
    modalAchievement: {
      gap: 8,
    },
    modalAchievementIcon: {
      fontSize: 42,
      textAlign: "center",
    },
    modalAchievementMeta: {
      color: colors.textMuted,
      textAlign: "center",
    },
  });
}
