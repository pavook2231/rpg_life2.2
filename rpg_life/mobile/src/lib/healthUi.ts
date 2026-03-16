const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function getNextHealthDecayLabel(lastHealthDecayAt?: string | null, language: "ru" | "en" = "ru") {
  if (!lastHealthDecayAt) {
    return language === "en"
      ? "Decay timer will update after the next health sync."
      : "Таймер урона обновится после следующей синхронизации здоровья.";
  }

  const lastDecayAt = new Date(lastHealthDecayAt);
  if (Number.isNaN(lastDecayAt.getTime())) {
    return language === "en"
      ? "Decay timer is temporarily unavailable."
      : "Таймер следующего урона временно недоступен.";
  }

  const remainingMs = lastDecayAt.getTime() + DAY_MS - Date.now();
  if (remainingMs <= 0) {
    return language === "en"
      ? "Damage may apply on the next sync if you stay inactive."
      : "При следующей синхронизации может пройти урон, если не будет активности.";
  }

  const hours = Math.floor(remainingMs / HOUR_MS);
  const minutes = Math.max(0, Math.floor((remainingMs % HOUR_MS) / MINUTE_MS));

  if (language === "en") {
    if (hours > 0) {
      return `Next inactivity damage in ${hours}h ${minutes}m.`;
    }
    return `Next inactivity damage in ${minutes}m.`;
  }

  if (hours > 0) {
    return `Следующий урон через ${hours}ч ${minutes}м без активности.`;
  }
  return `Следующий урон через ${minutes}м без активности.`;
}
