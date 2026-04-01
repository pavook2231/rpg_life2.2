from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app import crud
from app.core.dates import utc_now
from app.models import (
    DailySteps,
    MotivationState,
    Quest,
    StepDay,
    User,
    UserHealthProfile,
    UserClassProgress,
    WalkingPlanState,
    WeeklyReview,
    WeightBaseline,
    WeightEntry,
)

QUEST_DOMAIN = "weight_management"
DEFAULT_GOAL_TYPE = "lose"
SUPPORTED_GOAL_TYPES = {"lose", "maintain", "gain"}
SUPPORTED_ACTIVITY_LEVELS = {"sedentary", "light", "moderate", "high", "very_high"}
SUPPORTED_SEX_VALUES = {"male", "female", "other"}

STEP_BASE = 5000
STEP_WEEKLY_INCREMENT = 1000
STEP_TARGET_MAX = 15000
STEP_ADHERENCE_MIN_DAYS = 4
STEP_ADHERENCE_MIN_AVG_RATIO = 0.85
STEP_ADAPTIVE_FLOOR = 10000
PLATEAU_MIN_WEEKS = 3
PLATEAU_MIN_LOSS_KG_14D = 0.3
LAPSE_NO_STEP_DATA_DAYS = 3
LAPSE_MAX_DAYS_MET_LAST_7 = 2
LAPSE_NO_QUEST_COMPLETION_DAYS = 7
RECOVERY_MIN_TARGET_RATIO = 0.5
RECOVERY_MIN_ABSOLUTE_STEPS = 3000
DEPRECATED_QUEST_CODES = {"baseline_photo_front", "baseline_photo_side"}

PHASE_ORDER = {
    "anamnesis_required": 1,
    "baseline_required": 2,
    "walking_active": 3,
    "unsupported_goal": 4,
}

PROGRAM_GOAL_CARDS = {
    "lose": {
        "id": "lose",
        "title": "Снижение веса",
        "description": "Детерминированная программа снижения веса с обязательным стартом, планом шагов и недельным обзором.",
        "result_example": "Чёткий маршрут: анамнез, базовая точка, адаптивная ходьба и регулярный обзор прогресса.",
        "icon": "run-fast",
        "accent_color": "#2ecc71",
        "recommended_term_months": 6,
        "is_primary": True,
    },
    "maintain": {
        "id": "maintain",
        "title": "Удержание веса",
        "description": "Профиль сохраняется, но полноценная программа удержания пока не активирована.",
        "result_example": "Здесь будет отдельный поддерживающий маршрут без ложной имитации логики.",
        "icon": "scale-balance",
        "accent_color": "#3498db",
        "recommended_term_months": 6,
        "is_primary": False,
    },
    "gain": {
        "id": "gain",
        "title": "Набор веса",
        "description": "Профиль сохраняется, но отдельная программа набора веса пока не поддерживается.",
        "result_example": "Когда режим будет готов, он получит собственную механику, а не заглушку под снижение веса.",
        "icon": "arm-flex",
        "accent_color": "#e67e22",
        "recommended_term_months": 6,
        "is_primary": False,
    },
}

GOAL_TERM_OPTIONS = (
    {"months": 3, "title": "3 months", "title_ru": "3 месяца", "tempo": "fast"},
    {"months": 6, "title": "6 months", "title_ru": "6 месяцев", "tempo": "balanced"},
    {"months": 9, "title": "9 months", "title_ru": "9 месяцев", "tempo": "steady"},
)

QUEST_COPY = {
    "onboarding_anamnesis": {
        "title": "Заполни анамнез",
        "description": "Укажи базовые данные, чтобы программа начала вести тебя по понятному маршруту снижения веса.",
        "reason_text": "Сначала программе нужны исходные данные, иначе она не сможет безопасно и детерминированно выстроить маршрут.",
        "phase_code": "anamnesis_required",
        "xp_reward": 80,
        "crystal_reward": 12,
        "rarity": "rare",
        "icon": "clipboard-text-outline",
        "bucket": "daily",
        "is_required": True,
        "is_repeatable": False,
    },
    "baseline_measurements": {
        "title": "Сделай замеры тела",
        "description": "Сохрани стартовые объёмы, чтобы видеть прогресс не только по цифре на весах.",
        "reason_text": "Сделай замеры тела, чтобы зафиксировать стартовую точку.",
        "phase_code": "baseline_required",
        "xp_reward": 60,
        "crystal_reward": 10,
        "rarity": "uncommon",
        "icon": "ruler-square",
        "bucket": "daily",
        "is_required": True,
        "is_repeatable": False,
    },
    "baseline_set_weight_goal": {
        "title": "Укажи цель по весу",
        "description": "Задай понятную цель, чтобы программа вела тебя не просто к активности, а к нужному результату.",
        "reason_text": "Укажи цель по весу, чтобы программа могла вести тебя к понятному результату.",
        "phase_code": "baseline_required",
        "xp_reward": 60,
        "crystal_reward": 10,
        "rarity": "uncommon",
        "icon": "target",
        "bucket": "daily",
        "is_required": True,
        "is_repeatable": False,
    },
    "walking_daily_target": {
        "title": "Норма шагов на сегодня",
        "description": "Сделай норму шагов на сегодня. Это основной ежедневный шаг к цели.",
        "reason_text": "Сделай норму шагов на сегодня. Это основной ежедневный шаг к цели.",
        "phase_code": "walking_active",
        "xp_reward": 45,
        "crystal_reward": 9,
        "rarity": "common",
        "icon": "walk",
        "bucket": "daily",
        "is_required": True,
        "is_repeatable": True,
    },
    "weekly_review": {
        "title": "Подведи итоги недели",
        "description": "Подведи итоги недели, чтобы программа скорректировала следующий шаг.",
        "reason_text": "Подведи итоги недели, чтобы программа скорректировала следующий шаг.",
        "phase_code": "walking_active",
        "xp_reward": 90,
        "crystal_reward": 15,
        "rarity": "rare",
        "icon": "calendar-check",
        "bucket": "weekly",
        "is_required": True,
        "is_repeatable": True,
    },
    "plateau_review": {
        "title": "Проверка плато",
        "description": "Вес замедлился. Сначала проверим прогресс и удержим план, а не будем увеличивать нагрузку вслепую.",
        "reason_text": "Вес замедлился. Сначала проверим прогресс и удержим план, а не будем увеличивать нагрузку вслепую.",
        "phase_code": "walking_active",
        "xp_reward": 30,
        "crystal_reward": 6,
        "rarity": "rare",
        "icon": "chart-line-variant",
        "bucket": "weekly",
        "is_required": False,
        "is_repeatable": False,
    },
    "plateau_measurements_refresh": {
        "title": "Повтори замеры",
        "description": "Обнови замеры, чтобы проверить прогресс даже если вес на время замедлился.",
        "reason_text": "Повтори замеры, чтобы проверить прогресс даже если вес на время замедлился.",
        "phase_code": "walking_active",
        "xp_reward": 40,
        "crystal_reward": 7,
        "rarity": "uncommon",
        "icon": "ruler",
        "bucket": "weekly",
        "is_required": False,
        "is_repeatable": False,
    },
    "recovery_restart": {
        "title": "Вернись в ритм с одного простого шага",
        "description": "Вернись в ритм с одного простого шага. Сейчас важнее восстановить регулярность, чем пытаться сделать идеально.",
        "reason_text": "Вернись в ритм с одного простого шага. Сейчас важнее восстановить регулярность, чем пытаться сделать идеально.",
        "phase_code": "walking_active",
        "xp_reward": 35,
        "crystal_reward": 7,
        "rarity": "common",
        "icon": "refresh",
        "bucket": "daily",
        "is_required": False,
        "is_repeatable": True,
    },
}


@dataclass(slots=True)
class ProgramContext:
    user: User
    health_profile: UserHealthProfile
    baseline: WeightBaseline
    motivation: MotivationState
    walking_state: WalkingPlanState | None
    phase_code: str
    goal_type: str
    timezone_name: str


def normalize_goal_type(goal_type: str | None) -> str:
    raw = str(goal_type or "").strip().lower()
    alias_map = {
        "weight_health": "lose",
        "weight_loss": "lose",
        "weightloss": "lose",
        "lose_weight": "lose",
        "loss": "lose",
        "maintain_weight": "maintain",
        "maintenance": "maintain",
        "gain_weight": "gain",
        "mass_gain": "gain",
        "personal_development": "lose",
        "financial_growth": "lose",
        "new_profession": "lose",
        "discipline_productivity": "lose",
        "business_building": "lose",
        "relationships": "lose",
        "creativity": "lose",
        "language_learning": "lose",
    }
    normalized = alias_map.get(raw, raw)
    return normalized if normalized in SUPPORTED_GOAL_TYPES else DEFAULT_GOAL_TYPE


def get_goal_templates_payload() -> dict[str, Any]:
    return {
        "goals": [PROGRAM_GOAL_CARDS[key] for key in ("lose", "maintain", "gain")],
        "terms": list(GOAL_TERM_OPTIONS),
    }


def _serialize_json(data: dict[str, Any] | None) -> str | None:
    if not data:
        return None
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def _parse_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _get_or_create_health_profile(db: Session, user: User) -> UserHealthProfile:
    profile = db.query(UserHealthProfile).filter(UserHealthProfile.user_id == user.id).first()
    if profile:
        return profile
    profile = UserHealthProfile(
        user_id=user.id,
        sex=(user.gender if user.gender in SUPPORTED_SEX_VALUES else None),
        goal_type=normalize_goal_type(getattr(user, "selected_goal_type", None)),
        timezone_name="UTC",
    )
    db.add(profile)
    db.flush()
    return profile


def _get_or_create_baseline(db: Session, user: User) -> WeightBaseline:
    baseline = db.query(WeightBaseline).filter(WeightBaseline.user_id == user.id).first()
    if baseline:
        return baseline
    baseline = WeightBaseline(user_id=user.id)
    db.add(baseline)
    db.flush()
    return baseline


def _get_or_create_motivation_state(db: Session, user: User) -> MotivationState:
    motivation = db.query(MotivationState).filter(MotivationState.user_id == user.id).first()
    if motivation:
        return motivation
    motivation = MotivationState(user_id=user.id, motivation_score=50, motivation_band="medium")
    db.add(motivation)
    db.flush()
    return motivation


def _get_main_progress(db: Session, user_id: int) -> UserClassProgress | None:
    return (
        db.query(UserClassProgress)
        .filter(UserClassProgress.user_id == user_id, UserClassProgress.is_unlocked == True)
        .order_by(UserClassProgress.id.asc())
        .first()
    )


def _is_anamnesis_complete(profile: UserHealthProfile) -> bool:
    return (
        profile.anamnesis_completed_at is not None
        and profile.sex in SUPPORTED_SEX_VALUES
        and profile.height_cm is not None
        and profile.weight_kg is not None
        and profile.goal_type in SUPPORTED_GOAL_TYPES
        and profile.daily_activity_level in SUPPORTED_ACTIVITY_LEVELS
    )


def _measurements(baseline: WeightBaseline) -> dict[str, float]:
    payload = _parse_json(baseline.measurements_json)
    result: dict[str, float] = {}
    for key, value in payload.items():
        try:
            result[str(key)] = float(value)
        except (TypeError, ValueError):
            continue
    return result


def _is_baseline_complete(profile: UserHealthProfile, baseline: WeightBaseline) -> bool:
    return (
        bool(_measurements(baseline))
        and (profile.target_weight_kg is not None or profile.kilos_to_lose is not None)
    )


def _program_phase(profile: UserHealthProfile, baseline: WeightBaseline) -> str:
    if not _is_anamnesis_complete(profile):
        return "anamnesis_required"
    goal_type = normalize_goal_type(profile.goal_type)
    if goal_type in {"maintain", "gain"}:
        return "unsupported_goal"
    if not _is_baseline_complete(profile, baseline):
        return "baseline_required"
    return "walking_active"


def _safe_timezone_name(profile: UserHealthProfile | None) -> str:
    candidate = str(getattr(profile, "timezone_name", "") or "UTC").strip()
    try:
        ZoneInfo(candidate)
        return candidate
    except ZoneInfoNotFoundError:
        return "UTC"


def _zone(profile: UserHealthProfile | None) -> ZoneInfo:
    return ZoneInfo(_safe_timezone_name(profile))


def _to_local_datetime(dt: datetime, profile: UserHealthProfile | None) -> datetime:
    return dt.replace(tzinfo=UTC).astimezone(_zone(profile))


def _to_utc_naive(dt_local: datetime) -> datetime:
    return dt_local.astimezone(UTC).replace(tzinfo=None)


def _local_today(profile: UserHealthProfile | None, reference: datetime | None = None) -> date:
    return _to_local_datetime(reference or utc_now(), profile).date()


def _current_program_week(profile: UserHealthProfile, reference: datetime | None = None) -> int:
    if profile.program_started_at is None:
        return 0
    start_local = _to_local_datetime(profile.program_started_at, profile).date()
    today_local = _local_today(profile, reference)
    return max(0, (today_local - start_local).days // 7) + 1


def _program_day_count(profile: UserHealthProfile, reference: datetime | None = None) -> int:
    if profile.program_started_at is None:
        return 0
    start_local = _to_local_datetime(profile.program_started_at, profile).date()
    today_local = _local_today(profile, reference)
    return max(1, (today_local - start_local).days + 1)


def _week_date_range(profile: UserHealthProfile, week_number: int) -> tuple[date, date]:
    start_local = _to_local_datetime(profile.program_started_at or utc_now(), profile).date()
    week_start = start_local + timedelta(days=max(0, week_number - 1) * 7)
    return week_start, week_start + timedelta(days=6)


def _week_due_at(profile: UserHealthProfile, week_number: int) -> datetime:
    week_start, _ = _week_date_range(profile, week_number)
    return datetime.combine(week_start, time.min, tzinfo=_zone(profile)) + timedelta(days=7)


def _base_weekly_target(week_number: int) -> int:
    return min(STEP_BASE + STEP_WEEKLY_INCREMENT * max(week_number, 1), STEP_TARGET_MAX)


def _goal_card(goal_type: str) -> dict[str, Any]:
    return PROGRAM_GOAL_CARDS.get(normalize_goal_type(goal_type), PROGRAM_GOAL_CARDS[DEFAULT_GOAL_TYPE])


def _goal_timeline(ctx: ProgramContext) -> dict[str, Any]:
    started_at = (
        ctx.health_profile.program_started_at
        or getattr(ctx.user, "goal_cycle_started_at", None)
        or ctx.health_profile.created_at
        or getattr(ctx.user, "created_at", None)
        or utc_now()
    )
    fallback_deadline = started_at + timedelta(days=30 * int(getattr(ctx.user, "goal_term_months", 6) or 6))
    deadline_at = getattr(ctx.user, "goal_cycle_deadline_at", None) or fallback_deadline
    if deadline_at < started_at:
        deadline_at = fallback_deadline

    start_local = _to_local_datetime(started_at, ctx.health_profile).date()
    deadline_local = _to_local_datetime(deadline_at, ctx.health_profile).date()
    if deadline_local < start_local:
        deadline_local = start_local

    today_local = _local_today(ctx.health_profile)
    days_total = max(1, (deadline_local - start_local).days)
    days_passed = max(0, (today_local - start_local).days)
    days_remaining = max(0, (deadline_local - today_local).days)

    return {
        "started_at": started_at,
        "deadline_at": deadline_at,
        "days_total": days_total,
        "days_passed": min(days_total, days_passed),
        "days_remaining": days_remaining,
    }


def _quest_template_key(code: str, identity: str) -> str:
    return f"{QUEST_DOMAIN}:{code}:{identity}"


def _find_program_quest(db: Session, user_id: int, template_key: str) -> Quest | None:
    return (
        db.query(Quest)
        .filter(Quest.user_id == user_id, Quest.template_key == template_key)
        .order_by(Quest.id.desc())
        .first()
    )


def _build_program_quest(
    db: Session,
    user: User,
    profile: UserHealthProfile,
    code: str,
    identity: str,
    *,
    payload: dict[str, Any] | None = None,
    objective_type: str | None = None,
    target_value: int | None = None,
    expires_at: datetime | None = None,
    quest_state: str = "available",
) -> Quest:
    copy = QUEST_COPY[code]
    template_key = _quest_template_key(code, identity)
    existing = _find_program_quest(db, user.id, template_key)
    if existing is not None:
        existing.title = copy["title"]
        existing.description = copy["description"]
        existing.rarity = copy["rarity"]
        existing.phase_code = copy["phase_code"]
        existing.is_required = bool(copy["is_required"])
        existing.is_repeatable = bool(copy["is_repeatable"])
        existing.quest_state = "completed" if existing.is_completed else quest_state
        existing.reason_text = copy["reason_text"]
        existing.payload_json = _serialize_json(payload)
        existing.objective_type = objective_type
        existing.target_value = target_value
        existing.expires_at = expires_at
        existing.domain = QUEST_DOMAIN
        existing.quest_code = code
        existing.quest_bucket = copy["bucket"]
        existing.goal_type = normalize_goal_type(profile.goal_type)
        return existing

    progress = _get_main_progress(db, user.id)
    quest = Quest(
        user_id=user.id,
        class_progress_id=progress.id if progress else None,
        title=copy["title"],
        description=copy["description"],
        xp_reward=int(copy["xp_reward"]),
        crystal_reward=int(copy["crystal_reward"]),
        rarity=copy["rarity"],
        goal_type=normalize_goal_type(profile.goal_type),
        template_key=template_key,
        difficulty_level="easy",
        goal_progress_percent=0,
        quest_bucket=copy["bucket"],
        is_universal=False,
        is_accepted=True,
        is_custom=False,
        is_archived=False,
        is_completed=False,
        quest_type="daily" if copy["bucket"] == "daily" else "weekly",
        objective_type=objective_type,
        target_value=target_value,
        domain=QUEST_DOMAIN,
        quest_code=code,
        phase_code=copy["phase_code"],
        is_required=bool(copy["is_required"]),
        is_repeatable=bool(copy["is_repeatable"]),
        quest_state=quest_state,
        reason_text=copy["reason_text"],
        payload_json=_serialize_json(payload),
        expires_at=expires_at,
        icon=copy["icon"],
    )
    db.add(quest)
    db.flush()
    return quest


def _step_day(db: Session, user_id: int, date_local: str) -> StepDay | None:
    return db.query(StepDay).filter(StepDay.user_id == user_id, StepDay.date_local == date_local).first()


def _latest_completed_review(db: Session, user_id: int) -> WeeklyReview | None:
    return (
        db.query(WeeklyReview)
        .filter(WeeklyReview.user_id == user_id, WeeklyReview.completed_at != None)
        .order_by(WeeklyReview.week_number.desc())
        .first()
    )


def _recent_completed_reviews(db: Session, user_id: int, limit: int = 3) -> list[WeeklyReview]:
    return (
        db.query(WeeklyReview)
        .filter(WeeklyReview.user_id == user_id, WeeklyReview.completed_at != None)
        .order_by(WeeklyReview.week_number.desc())
        .limit(limit)
        .all()
    )


def _ensure_walking_state(db: Session, user: User, profile: UserHealthProfile, baseline: WeightBaseline) -> WalkingPlanState | None:
    if _program_phase(profile, baseline) != "walking_active":
        return None
    state = db.query(WalkingPlanState).filter(WalkingPlanState.user_id == user.id).first()
    if state is not None:
        return state
    profile.program_started_at = profile.program_started_at or utc_now()
    state = WalkingPlanState(
        user_id=user.id,
        current_program_week=1,
        current_daily_target_steps=_base_weekly_target(1),
        current_mode="normal",
        last_week_achieved_days=0,
        last_week_average_steps=0,
        last_adjustment_type="initial",
        last_adjustment_reason="Старт программы",
        last_computed_at=utc_now(),
    )
    db.add(state)
    db.flush()
    return state


def _ensure_context(db: Session, user: User) -> ProgramContext:
    user.selected_goal_type = normalize_goal_type(getattr(user, "selected_goal_type", None))
    health_profile = _get_or_create_health_profile(db, user)
    health_profile.goal_type = normalize_goal_type(health_profile.goal_type or user.selected_goal_type)
    baseline = _get_or_create_baseline(db, user)
    motivation = _get_or_create_motivation_state(db, user)
    phase_code = _program_phase(health_profile, baseline)
    walking_state = _ensure_walking_state(db, user, health_profile, baseline)
    return ProgramContext(
        user=user,
        health_profile=health_profile,
        baseline=baseline,
        motivation=motivation,
        walking_state=walking_state,
        phase_code=phase_code,
        goal_type=normalize_goal_type(health_profile.goal_type),
        timezone_name=_safe_timezone_name(health_profile),
    )


def _sync_step_day_record(
    db: Session,
    user: User,
    profile: UserHealthProfile,
    *,
    steps: int,
    source: str,
    day_started_at: str | None,
) -> StepDay:
    if day_started_at:
        raw_dt = datetime.fromisoformat(day_started_at.replace("Z", "+00:00"))
        if raw_dt.tzinfo is None:
            raw_dt = raw_dt.replace(tzinfo=UTC)
        date_local = raw_dt.astimezone(_zone(profile)).date().isoformat()
    else:
        date_local = _local_today(profile).isoformat()

    record = _step_day(db, user.id, date_local)
    if record is None:
        record = StepDay(user_id=user.id, date_local=date_local, steps=max(0, int(steps or 0)), source=source)
        db.add(record)
        db.flush()
        return record

    record.steps = max(int(record.steps or 0), max(0, int(steps or 0)))
    record.source = source
    record.updated_at = utc_now()
    return record


def _week_steps(db: Session, user_id: int, week_start: date, week_end: date) -> dict[str, int]:
    rows = (
        db.query(StepDay)
        .filter(
            StepDay.user_id == user_id,
            StepDay.date_local >= week_start.isoformat(),
            StepDay.date_local <= week_end.isoformat(),
        )
        .all()
    )
    return {row.date_local: int(row.steps or 0) for row in rows}


def _week_stats(db: Session, user_id: int, week_start: date, week_end: date, target_steps: int) -> tuple[int, int]:
    by_day = _week_steps(db, user_id, week_start, week_end)
    achieved_days = 0
    total_steps = 0
    for index in range(7):
        key = (week_start + timedelta(days=index)).isoformat()
        steps = int(by_day.get(key, 0))
        total_steps += steps
        if steps >= target_steps:
            achieved_days += 1
    return achieved_days, int(round(total_steps / 7))


def _review_due(profile: UserHealthProfile, state: WalkingPlanState | None, db: Session | None = None, user_id: int | None = None) -> bool:
    if state is None or profile.program_started_at is None:
        return False
    if _to_local_datetime(utc_now(), profile) < _week_due_at(profile, state.current_program_week):
        return False
    if db is None or user_id is None:
        return True
    review = (
        db.query(WeeklyReview)
        .filter(
            WeeklyReview.user_id == user_id,
            WeeklyReview.week_number == state.current_program_week,
            WeeklyReview.completed_at != None,
        )
        .first()
    )
    return review is None


def _weekly_review_preview(db: Session, user_id: int, profile: UserHealthProfile, state: WalkingPlanState | None) -> dict[str, Any] | None:
    if state is None or profile.program_started_at is None:
        return None
    week_number = int(state.current_program_week or 0)
    if week_number <= 0:
        return None
    week_start, week_end = _week_date_range(profile, week_number)
    target_steps = int(state.current_daily_target_steps or 0)
    achieved_days, average_steps = _week_stats(db, user_id, week_start, week_end, target_steps)
    previous_review = None
    if week_number > 1:
        previous_review = (
            db.query(WeeklyReview)
            .filter(
                WeeklyReview.user_id == user_id,
                WeeklyReview.week_number == week_number - 1,
                WeeklyReview.completed_at != None,
            )
            .first()
        )
    return {
        "week_number": week_number,
        "week_start_date_local": week_start.isoformat(),
        "week_end_date_local": week_end.isoformat(),
        "target_daily_steps": target_steps,
        "achieved_days": achieved_days,
        "average_steps": average_steps,
        "previous_weight_kg": float(previous_review.current_weight_kg) if previous_review and previous_review.current_weight_kg is not None else None,
        "review_due": _review_due(profile, state, db, user_id),
    }


def _compute_motivation(db: Session, user: User, profile: UserHealthProfile, state: WalkingPlanState | None) -> MotivationState:
    motivation = _get_or_create_motivation_state(db, user)
    cutoff = utc_now() - timedelta(days=14)

    recent_daily_quests = (
        db.query(Quest)
        .filter(
            Quest.user_id == user.id,
            Quest.domain == QUEST_DOMAIN,
            Quest.created_at >= cutoff,
            Quest.quest_code == "walking_daily_target",
        )
        .all()
    )
    due_days = 0
    met_days = 0
    for quest in recent_daily_quests:
        payload = _parse_json(quest.payload_json)
        date_local = str(payload.get("dateLocal") or "")
        target = int(payload.get("targetSteps") or quest.target_value or 0)
        if not date_local or target <= 0:
            continue
        due_days += 1
        step_day = _step_day(db, user.id, date_local)
        if step_day and int(step_day.steps or 0) >= target:
            met_days += 1
    adherence_pct = int(round((met_days / due_days) * 100)) if due_days else 0

    total_due_quests = (
        db.query(Quest)
        .filter(Quest.user_id == user.id, Quest.domain == QUEST_DOMAIN, Quest.created_at >= cutoff)
        .count()
    )
    completed_due_quests = (
        db.query(Quest)
        .filter(
            Quest.user_id == user.id,
            Quest.domain == QUEST_DOMAIN,
            Quest.created_at >= cutoff,
            Quest.is_completed == True,
        )
        .count()
    )
    quest_completion_pct = int(round((completed_due_quests / total_due_quests) * 100)) if total_due_quests else 0

    recent_step_days = db.query(StepDay).filter(StepDay.user_id == user.id, StepDay.updated_at >= cutoff).count()
    recent_reviews = (
        db.query(WeeklyReview)
        .filter(WeeklyReview.user_id == user.id, WeeklyReview.completed_at != None, WeeklyReview.completed_at >= cutoff)
        .count()
    )
    checkin_consistency_pct = int(round((min(14, recent_step_days + recent_reviews) / 14) * 100))

    latest_review = _latest_completed_review(db, user.id)
    self_report_component_pct = None
    if latest_review and latest_review.motivation_self_rating is not None:
        self_report_component_pct = int(round((float(latest_review.motivation_self_rating) / 5) * 100))

    weighted_components: list[tuple[float, int]] = [
        (0.40, adherence_pct),
        (0.25, quest_completion_pct),
        (0.20, checkin_consistency_pct),
    ]
    if self_report_component_pct is not None:
        weighted_components.append((0.15, self_report_component_pct))
    total_weight = sum(weight for weight, _ in weighted_components) or 1.0
    score = int(round(sum((weight / total_weight) * value for weight, value in weighted_components)))
    if score <= 39:
        band = "low"
    elif score <= 69:
        band = "medium"
    else:
        band = "high"

    motivation.motivation_score = max(0, min(100, score))
    motivation.motivation_band = band
    motivation.adherence_14d_pct = adherence_pct
    motivation.quest_completion_14d_pct = quest_completion_pct
    motivation.checkin_consistency_14d_pct = checkin_consistency_pct
    motivation.self_report_component_pct = self_report_component_pct
    motivation.updated_at = utc_now()
    return motivation


def _detect_lapse_now(db: Session, user: User, profile: UserHealthProfile, state: WalkingPlanState | None) -> bool:
    if state is None or profile.program_started_at is None:
        return False

    program_days = _program_day_count(profile)
    today_local = _local_today(profile)
    if program_days >= LAPSE_NO_STEP_DATA_DAYS:
        no_step_data = True
        for offset in range(LAPSE_NO_STEP_DATA_DAYS):
            if _step_day(db, user.id, (today_local - timedelta(days=offset)).isoformat()) is not None:
                no_step_data = False
                break
        if no_step_data:
            return True

    if program_days >= 7:
        met_days = 0
        for offset in range(7):
            key = (today_local - timedelta(days=offset)).isoformat()
            step_day = _step_day(db, user.id, key)
            if step_day and int(step_day.steps or 0) >= int(state.current_daily_target_steps or 0):
                met_days += 1
        if met_days <= LAPSE_MAX_DAYS_MET_LAST_7:
            return True

        cutoff = utc_now() - timedelta(days=LAPSE_NO_QUEST_COMPLETION_DAYS)
        recent_completion = (
            db.query(Quest.id)
            .filter(
                Quest.user_id == user.id,
                Quest.domain == QUEST_DOMAIN,
                Quest.completed_at != None,
                Quest.completed_at >= cutoff,
            )
            .first()
        )
        if recent_completion is None:
            review_completion = (
                db.query(WeeklyReview.id)
                .filter(WeeklyReview.user_id == user.id, WeeklyReview.completed_at != None, WeeklyReview.completed_at >= cutoff)
                .first()
            )
            if review_completion is None:
                return True
    return False


def _detect_plateau_after_review(db: Session, user: User) -> bool:
    reviews = _recent_completed_reviews(db, user.id, limit=3)
    if len(reviews) < PLATEAU_MIN_WEEKS:
        return False
    latest, previous, oldest = reviews[0], reviews[1], reviews[2]
    if latest.current_weight_kg is None or oldest.current_weight_kg is None:
        return False
    for review in (latest, previous):
        target = int(review.target_daily_steps or 0)
        if review.achieved_days < STEP_ADHERENCE_MIN_DAYS:
            return False
        if target <= 0 or int(review.average_steps or 0) < int(round(target * STEP_ADHERENCE_MIN_AVG_RATIO)):
            return False
    total_loss = float(oldest.current_weight_kg) - float(latest.current_weight_kg)
    return total_loss < PLATEAU_MIN_LOSS_KG_14D


def _compute_next_target(
    previous_target: int,
    next_week_number: int,
    *,
    achieved_days: int,
    average_steps: int,
    plateau_detected: bool,
    lapse_detected: bool,
) -> tuple[int, str, str]:
    if next_week_number <= 1:
        return _base_weekly_target(1), "initial", "Старт первой недели"
    if plateau_detected:
        return previous_target, "plateau_hold", "Плато: удерживаем цель без повышения"
    if lapse_detected:
        if previous_target >= STEP_ADAPTIVE_FLOOR:
            return max(STEP_ADAPTIVE_FLOOR, previous_target - STEP_WEEKLY_INCREMENT), "recovery_hold", "Режим восстановления"
        return previous_target, "recovery_hold", "Режим восстановления: ранняя стадия удерживается"

    under_target = achieved_days < STEP_ADHERENCE_MIN_DAYS or average_steps < int(round(previous_target * STEP_ADHERENCE_MIN_AVG_RATIO))
    if not under_target:
        next_target = min(previous_target + STEP_WEEKLY_INCREMENT, _base_weekly_target(next_week_number), STEP_TARGET_MAX)
        return next_target, "increase", "Хорошая неделя: повышаем план на 1000 шагов"
    if previous_target >= STEP_ADAPTIVE_FLOOR:
        next_target = max(STEP_ADAPTIVE_FLOOR, previous_target - STEP_WEEKLY_INCREMENT)
        return next_target, "decrease", "Нагрузка снижена на 1000 шагов после сложной недели"
    return previous_target, "hold", "Ранняя стадия: держим текущую цель без снижения"


def _priority_for_quest(quest: Quest) -> int:
    if quest.quest_code == "onboarding_anamnesis":
        return 10
    if quest.quest_code == "weekly_review":
        return 20
    if quest.quest_code in {"baseline_measurements", "baseline_set_weight_goal"}:
        return 30
    if quest.quest_code == "recovery_restart":
        return 40
    if quest.quest_code == "plateau_review":
        return 50
    if quest.quest_code == "plateau_measurements_refresh":
        return 60
    if quest.quest_code == "walking_daily_target":
        return 70
    return 90


def _complete_program_quest_row(db: Session, user: User, quest: Quest) -> None:
    if quest.is_completed:
        return
    result = crud.complete_quest(db, user.id, quest.id)
    if result is None:
        return
    db.refresh(quest)
    quest.quest_state = "completed"
    if quest.quest_code == "recovery_restart":
        state = db.query(WalkingPlanState).filter(WalkingPlanState.user_id == user.id).first()
        if state and state.current_mode == "recovery":
            state.current_mode = "normal"
            state.last_adjustment_reason = "Ритм восстановлен через recovery_restart"
    db.commit()


def _archive_outdated_daily_quests(db: Session, user: User, current_date_local: str) -> None:
    rows = (
        db.query(Quest)
        .filter(
            Quest.user_id == user.id,
            Quest.domain == QUEST_DOMAIN,
            Quest.quest_code.in_(["walking_daily_target", "recovery_restart"]),
            Quest.is_completed == False,
            Quest.is_archived == False,
        )
        .all()
    )
    for quest in rows:
        payload = _parse_json(quest.payload_json)
        if str(payload.get("dateLocal") or "") and str(payload.get("dateLocal")) != current_date_local:
            quest.quest_state = "expired"
            quest.is_archived = True


def _archive_overlay_quests_if_not_needed(db: Session, user: User, state: WalkingPlanState | None) -> None:
    rows = (
        db.query(Quest)
        .filter(
            Quest.user_id == user.id,
            Quest.domain == QUEST_DOMAIN,
            Quest.quest_code.in_(["plateau_review", "plateau_measurements_refresh", "recovery_restart"]),
            Quest.is_completed == False,
            Quest.is_archived == False,
        )
        .all()
    )
    expected_codes = set()
    if state and state.current_mode == "plateau_hold":
        expected_codes.update({"plateau_review", "plateau_measurements_refresh"})
    if state and state.current_mode == "recovery":
        expected_codes.add("recovery_restart")
    for quest in rows:
        if quest.quest_code not in expected_codes:
            quest.quest_state = "archived"
            quest.is_archived = True


def _archive_deprecated_program_quests(db: Session, user: User) -> None:
    rows = (
        db.query(Quest)
        .filter(
            Quest.user_id == user.id,
            Quest.domain == QUEST_DOMAIN,
            Quest.quest_code.in_(list(DEPRECATED_QUEST_CODES)),
            Quest.is_completed == False,
            Quest.is_archived == False,
        )
        .all()
    )
    for quest in rows:
        quest.quest_state = "archived"
        quest.is_archived = True


def _ensure_anamnesis_quest(db: Session, ctx: ProgramContext) -> Quest:
    return _build_program_quest(db, ctx.user, ctx.health_profile, "onboarding_anamnesis", "current")


def _ensure_baseline_quests(db: Session, ctx: ProgramContext) -> list[Quest]:
    _archive_deprecated_program_quests(db, ctx.user)
    quests: list[Quest] = []
    checks = {
        "baseline_measurements": bool(_measurements(ctx.baseline)),
        "baseline_set_weight_goal": ctx.health_profile.target_weight_kg is not None or ctx.health_profile.kilos_to_lose is not None,
    }
    for code, is_done in checks.items():
        quest = _build_program_quest(db, ctx.user, ctx.health_profile, code, "current")
        if is_done and not quest.is_completed:
            _complete_program_quest_row(db, ctx.user, quest)
        quests.append(quest)
    if _is_baseline_complete(ctx.health_profile, ctx.baseline) and ctx.baseline.baseline_completed_at is None:
        ctx.baseline.baseline_completed_at = utc_now()
    return quests


def _ensure_walking_daily_quest(db: Session, ctx: ProgramContext) -> Quest | None:
    if ctx.walking_state is None:
        return None
    target_date_local = _local_today(ctx.health_profile).isoformat()
    _archive_outdated_daily_quests(db, ctx.user, target_date_local)
    expires_local = datetime.combine(_local_today(ctx.health_profile) + timedelta(days=1), time.min, tzinfo=_zone(ctx.health_profile))
    return _build_program_quest(
        db,
        ctx.user,
        ctx.health_profile,
        "walking_daily_target",
        target_date_local,
        payload={
            "weekNumber": int(ctx.walking_state.current_program_week),
            "targetSteps": int(ctx.walking_state.current_daily_target_steps),
            "dateLocal": target_date_local,
        },
        objective_type="steps",
        target_value=int(ctx.walking_state.current_daily_target_steps),
        expires_at=_to_utc_naive(expires_local),
        quest_state="active",
    )


def _ensure_weekly_review_quest(db: Session, ctx: ProgramContext) -> Quest | None:
    if ctx.walking_state is None or not _review_due(ctx.health_profile, ctx.walking_state, db, ctx.user.id):
        return None
    week_number = int(ctx.walking_state.current_program_week)
    week_start, week_end = _week_date_range(ctx.health_profile, week_number)
    return _build_program_quest(
        db,
        ctx.user,
        ctx.health_profile,
        "weekly_review",
        str(week_number),
        payload={
            "weekNumber": week_number,
            "weekStartDateLocal": week_start.isoformat(),
            "weekEndDateLocal": week_end.isoformat(),
            "targetDailySteps": int(ctx.walking_state.current_daily_target_steps),
        },
        quest_state="active",
    )


def _ensure_plateau_overlay_quests(db: Session, ctx: ProgramContext) -> list[Quest]:
    if ctx.walking_state is None or ctx.walking_state.current_mode != "plateau_hold":
        return []
    identity = f"week-{ctx.walking_state.current_program_week}"
    return [
        _build_program_quest(db, ctx.user, ctx.health_profile, "plateau_review", identity, quest_state="available"),
        _build_program_quest(db, ctx.user, ctx.health_profile, "plateau_measurements_refresh", identity, quest_state="available"),
    ]


def _ensure_recovery_quest(db: Session, ctx: ProgramContext) -> Quest | None:
    if ctx.walking_state is None or ctx.walking_state.current_mode != "recovery":
        return None
    target_date_local = _local_today(ctx.health_profile).isoformat()
    threshold = max(RECOVERY_MIN_ABSOLUTE_STEPS, int(round(ctx.walking_state.current_daily_target_steps * RECOVERY_MIN_TARGET_RATIO)))
    expires_local = datetime.combine(_local_today(ctx.health_profile) + timedelta(days=1), time.min, tzinfo=_zone(ctx.health_profile))
    return _build_program_quest(
        db,
        ctx.user,
        ctx.health_profile,
        "recovery_restart",
        target_date_local,
        payload={
            "dateLocal": target_date_local,
            "targetSteps": threshold,
            "currentDailyTarget": int(ctx.walking_state.current_daily_target_steps),
        },
        objective_type="steps",
        target_value=threshold,
        expires_at=_to_utc_naive(expires_local),
        quest_state="active",
    )


def _current_active_quests(db: Session, ctx: ProgramContext) -> list[Quest]:
    _archive_overlay_quests_if_not_needed(db, ctx.user, ctx.walking_state)
    if ctx.phase_code == "anamnesis_required":
        return [_ensure_anamnesis_quest(db, ctx)]
    if ctx.phase_code == "baseline_required":
        return _ensure_baseline_quests(db, ctx)
    if ctx.phase_code == "unsupported_goal":
        return []

    active: list[Quest] = []
    review_quest = _ensure_weekly_review_quest(db, ctx)
    if review_quest is not None:
        active.append(review_quest)
    recovery_quest = _ensure_recovery_quest(db, ctx)
    if recovery_quest is not None:
        active.append(recovery_quest)
    active.extend(_ensure_plateau_overlay_quests(db, ctx))
    walking_quest = _ensure_walking_daily_quest(db, ctx)
    if walking_quest is not None:
        active.append(walking_quest)
    return active


def _serialize_goal_state(db: Session, ctx: ProgramContext) -> dict[str, Any]:
    card = _goal_card(ctx.goal_type)
    review_preview = _weekly_review_preview(db, ctx.user.id, ctx.health_profile, ctx.walking_state)
    timeline = _goal_timeline(ctx)
    return {
        "goal_id": QUEST_DOMAIN,
        "goal_type": ctx.goal_type,
        "goal_title": card["title"],
        "goal_description": card["description"],
        "goal_icon": card["icon"],
        "goal_accent_color": card["accent_color"],
        "goal_term_months": int(getattr(ctx.user, "goal_term_months", 6) or 6),
        "goal_cycle_index": int(getattr(ctx.user, "goal_cycle_index", 1) or 1),
        "goal_cycle_xp": int(getattr(ctx.user, "goal_cycle_xp", 0) or 0),
        "goal_target_xp": int(getattr(ctx.user, "goal_target_xp", 0) or 0),
        "goal_progress_percent": int(getattr(ctx.user, "goal_progress_percent", 0) or 0),
        "goal_started_at": timeline["started_at"].isoformat(),
        "goal_deadline_at": timeline["deadline_at"].isoformat(),
        "goal_days_passed": int(timeline["days_passed"]),
        "goal_days_total": int(timeline["days_total"]),
        "goal_days_remaining": int(timeline["days_remaining"]),
        "phase": PHASE_ORDER[ctx.phase_code],
        "program_phase": ctx.phase_code,
        "program_mode": ctx.walking_state.current_mode if ctx.walking_state else "inactive",
        "anamnesis_completed": _is_anamnesis_complete(ctx.health_profile),
        "baseline_completed": _is_baseline_complete(ctx.health_profile, ctx.baseline),
        "unsupported_goal": ctx.phase_code == "unsupported_goal",
        "review_due": _review_due(ctx.health_profile, ctx.walking_state, db, ctx.user.id),
        "timezone_name": ctx.timezone_name,
        "weekly_review_preview": review_preview,
        "walking_plan": {
            "current_program_week": int(ctx.walking_state.current_program_week) if ctx.walking_state else 0,
            "current_daily_target_steps": int(ctx.walking_state.current_daily_target_steps or 0) if ctx.walking_state else 0,
            "current_mode": ctx.walking_state.current_mode if ctx.walking_state else "inactive",
            "last_week_achieved_days": int(ctx.walking_state.last_week_achieved_days or 0) if ctx.walking_state else 0,
            "last_week_average_steps": int(ctx.walking_state.last_week_average_steps or 0) if ctx.walking_state else 0,
            "last_adjustment_type": ctx.walking_state.last_adjustment_type if ctx.walking_state else None,
            "last_adjustment_reason": ctx.walking_state.last_adjustment_reason if ctx.walking_state else None,
        },
        "motivation": {
            "score": int(ctx.motivation.motivation_score or 0),
            "band": ctx.motivation.motivation_band,
            "adherence_14d_pct": int(ctx.motivation.adherence_14d_pct or 0),
            "quest_completion_14d_pct": int(ctx.motivation.quest_completion_14d_pct or 0),
            "checkin_consistency_14d_pct": int(ctx.motivation.checkin_consistency_14d_pct or 0),
            "self_report_component_pct": ctx.motivation.self_report_component_pct,
        },
        "health_profile": {
            "sex": ctx.health_profile.sex,
            "height_cm": ctx.health_profile.height_cm,
            "weight_kg": ctx.health_profile.weight_kg,
            "goal_type": ctx.health_profile.goal_type,
            "daily_activity_level": ctx.health_profile.daily_activity_level,
            "target_weight_kg": ctx.health_profile.target_weight_kg,
            "kilos_to_lose": ctx.health_profile.kilos_to_lose,
            "anamnesis_completed_at": ctx.health_profile.anamnesis_completed_at.isoformat() if ctx.health_profile.anamnesis_completed_at else None,
            "program_started_at": ctx.health_profile.program_started_at.isoformat() if ctx.health_profile.program_started_at else None,
        },
    }


def _serialize_program_quest(db: Session, ctx: ProgramContext, quest: Quest) -> dict[str, Any]:
    payload = _parse_json(quest.payload_json)
    progress_value = None
    supports_live_progress = False
    can_complete = False
    tracking_mode = "manual"
    if quest.objective_type == "steps":
        date_local = str(payload.get("dateLocal") or _local_today(ctx.health_profile).isoformat())
        step_day = _step_day(db, ctx.user.id, date_local)
        progress_value = int(step_day.steps or 0) if step_day else 0
        supports_live_progress = True
        tracking_mode = "verified"
        can_complete = progress_value >= int(quest.target_value or 0)
    elif quest.quest_code == "plateau_review" and not quest.is_completed:
        can_complete = True

    return {
        "id": quest.id,
        "title": quest.title,
        "description": quest.description,
        "xp_reward": int(quest.xp_reward or 0),
        "crystal_reward": int(quest.crystal_reward or 0),
        "rarity": quest.rarity or "common",
        "quest_type": quest.quest_type or "daily",
        "quest_bucket": quest.quest_bucket or "daily",
        "goal_type": ctx.goal_type,
        "goal_id": QUEST_DOMAIN,
        "difficulty_level": quest.difficulty_level or "easy",
        "goal_progress_percent": int(getattr(ctx.user, "goal_progress_percent", 0) or 0),
        "is_universal": False,
        "is_accepted": True,
        "objective_type": quest.objective_type,
        "objective_label": crud.describe_objective(quest.objective_type) if quest.objective_type else None,
        "target_value": int(quest.target_value) if quest.target_value is not None else None,
        "progress_value": progress_value,
        "supports_live_progress": supports_live_progress,
        "tracking_mode": tracking_mode,
        "can_complete": can_complete,
        "is_completed": bool(quest.is_completed),
        "expires_at": quest.expires_at.isoformat() if quest.expires_at else None,
        "domain": quest.domain,
        "quest_code": quest.quest_code,
        "phase_code": quest.phase_code,
        "is_required": bool(quest.is_required),
        "is_repeatable": bool(quest.is_repeatable),
        "quest_state": quest.quest_state or ("completed" if quest.is_completed else "available"),
        "reason_text": quest.reason_text,
        "payload": payload,
        "program_priority": _priority_for_quest(quest),
    }


def ensure_program_quests(db: Session, user: User) -> dict[str, Any]:
    ctx = _ensure_context(db, user)
    if ctx.walking_state and _detect_lapse_now(db, user, ctx.health_profile, ctx.walking_state):
        ctx.walking_state.current_mode = "recovery"
    ctx.motivation = _compute_motivation(db, user, ctx.health_profile, ctx.walking_state)
    active_quests = _current_active_quests(db, ctx)
    completed_rows = (
        db.query(Quest)
        .filter(Quest.user_id == user.id, Quest.domain == QUEST_DOMAIN, Quest.is_completed == True)
        .order_by(Quest.completed_at.desc())
        .limit(30)
        .all()
    )
    unique_rows: dict[int, Quest] = {quest.id: quest for quest in active_quests}
    for quest in completed_rows:
        unique_rows.setdefault(quest.id, quest)
    ordered = [
        quest
        for quest in sorted(unique_rows.values(), key=lambda quest: (bool(quest.is_completed), _priority_for_quest(quest), quest.created_at))
        if quest.quest_code not in DEPRECATED_QUEST_CODES
    ]
    if ctx.phase_code == "walking_active" and ctx.motivation.motivation_band == "low":
        incomplete = [quest for quest in ordered if not quest.is_completed]
        completed = [quest for quest in ordered if quest.is_completed]
        ordered = incomplete[:2] + completed[:8]
    items = [_serialize_program_quest(db, ctx, quest) for quest in ordered]
    db.commit()
    return {
        "items": items,
        "goal": _serialize_goal_state(db, ctx),
        "pagination": {
            "page": 1,
            "limit": max(1, len(items)),
            "total_items": len(items),
            "total_pages": 1,
        },
    }


def autocomplete_step_quests(db: Session, user: User) -> None:
    ctx = _ensure_context(db, user)
    rows = (
        db.query(Quest)
        .filter(
            Quest.user_id == user.id,
            Quest.domain == QUEST_DOMAIN,
            Quest.objective_type == "steps",
            Quest.is_completed == False,
            Quest.is_archived == False,
        )
        .all()
    )
    for quest in rows:
        payload = _parse_json(quest.payload_json)
        date_local = str(payload.get("dateLocal") or _local_today(ctx.health_profile).isoformat())
        step_day = _step_day(db, user.id, date_local)
        progress = int(step_day.steps or 0) if step_day else 0
        if progress >= int(quest.target_value or 0):
            _complete_program_quest_row(db, user, quest)


def get_goal_state(db: Session, user: User) -> dict[str, Any]:
    ctx = _ensure_context(db, user)
    ctx.motivation = _compute_motivation(db, user, ctx.health_profile, ctx.walking_state)
    db.commit()
    return _serialize_goal_state(db, ctx)


def set_goal(db: Session, user: User, goal_type: str, goal_term_months: int, start_new_cycle: bool) -> dict[str, Any]:
    normalized_goal = normalize_goal_type(goal_type)
    user.selected_goal_type = normalized_goal
    user.goal_term_months = int(goal_term_months or 6)
    if start_new_cycle:
        user.goal_cycle_index = int(getattr(user, "goal_cycle_index", 1) or 1) + 1
    profile = _get_or_create_health_profile(db, user)
    profile.goal_type = normalized_goal
    ctx = _ensure_context(db, user)
    db.commit()
    return _serialize_goal_state(db, ctx)


def submit_anamnesis(
    db: Session,
    user: User,
    *,
    sex: str,
    height_cm: int,
    weight_kg: float,
    goal_type: str,
    daily_activity_level: str,
    timezone_name: str | None,
) -> dict[str, Any]:
    profile = _get_or_create_health_profile(db, user)
    profile.sex = sex
    profile.height_cm = int(height_cm)
    profile.weight_kg = float(weight_kg)
    profile.goal_type = normalize_goal_type(goal_type)
    profile.daily_activity_level = daily_activity_level
    profile.timezone_name = timezone_name or profile.timezone_name or "UTC"
    profile.anamnesis_completed_at = utc_now()
    user.selected_goal_type = profile.goal_type
    ctx = _ensure_context(db, user)
    _ensure_baseline_quests(db, ctx)
    db.commit()
    return _serialize_goal_state(db, ctx)


def submit_baseline(
    db: Session,
    user: User,
    *,
    measurements: dict[str, float] | None = None,
    target_weight_kg: float | None = None,
    kilos_to_lose: float | None = None,
) -> dict[str, Any]:
    ctx = _ensure_context(db, user)
    if ctx.phase_code == "anamnesis_required":
        raise ValueError("Анамнез нужно заполнить до базовых шагов")

    if measurements:
        current = _measurements(ctx.baseline)
        current.update({key: float(value) for key, value in measurements.items()})
        ctx.baseline.measurements_json = _serialize_json(current)
    if target_weight_kg is not None:
        ctx.health_profile.target_weight_kg = float(target_weight_kg)
    if kilos_to_lose is not None:
        ctx.health_profile.kilos_to_lose = float(kilos_to_lose)

    for quest in _ensure_baseline_quests(db, ctx):
        if quest.quest_code == "baseline_measurements" and bool(_measurements(ctx.baseline)):
            _complete_program_quest_row(db, user, quest)
        if quest.quest_code == "baseline_set_weight_goal" and (
            ctx.health_profile.target_weight_kg is not None or ctx.health_profile.kilos_to_lose is not None
        ):
            _complete_program_quest_row(db, user, quest)

    if _is_baseline_complete(ctx.health_profile, ctx.baseline):
        ctx.baseline.baseline_completed_at = ctx.baseline.baseline_completed_at or utc_now()
        ctx.health_profile.program_started_at = ctx.health_profile.program_started_at or utc_now()
        _ensure_walking_state(db, user, ctx.health_profile, ctx.baseline)

        plateau_refresh_quest = _find_program_quest(
            db,
            user.id,
            _quest_template_key("plateau_measurements_refresh", f"week-{ctx.walking_state.current_program_week}") if ctx.walking_state else "",
        )
        if plateau_refresh_quest is not None and not plateau_refresh_quest.is_completed:
            _complete_program_quest_row(db, user, plateau_refresh_quest)

    db.commit()
    return _serialize_goal_state(db, _ensure_context(db, user))


def submit_weekly_review(
    db: Session,
    user: User,
    *,
    current_weight_kg: float | None = None,
    motivation_self_rating: int | None = None,
    difficulty_self_rating: int | None = None,
) -> dict[str, Any]:
    ctx = _ensure_context(db, user)
    if ctx.walking_state is None or not _review_due(ctx.health_profile, ctx.walking_state, db, user.id):
        raise ValueError("Недельный обзор пока не требуется")

    week_number = int(ctx.walking_state.current_program_week)
    week_start, week_end = _week_date_range(ctx.health_profile, week_number)
    achieved_days, average_steps = _week_stats(db, user.id, week_start, week_end, int(ctx.walking_state.current_daily_target_steps or 0))
    previous_review = _latest_completed_review(db, user.id)
    previous_weight = (
        float(previous_review.current_weight_kg)
        if previous_review and previous_review.current_weight_kg is not None
        else float(ctx.health_profile.weight_kg)
        if ctx.health_profile.weight_kg is not None
        else None
    )
    current_weight = float(current_weight_kg) if current_weight_kg is not None else None
    weight_delta = (current_weight - previous_weight) if current_weight is not None and previous_weight is not None else None

    review = db.query(WeeklyReview).filter(WeeklyReview.user_id == user.id, WeeklyReview.week_number == week_number).first()
    if review is None:
        review = WeeklyReview(
            user_id=user.id,
            week_number=week_number,
            week_start_date_local=week_start.isoformat(),
            week_end_date_local=week_end.isoformat(),
        )
        db.add(review)
        db.flush()

    review.target_daily_steps = int(ctx.walking_state.current_daily_target_steps or 0)
    review.achieved_days = achieved_days
    review.average_steps = average_steps
    review.current_weight_kg = current_weight
    review.previous_weight_kg = previous_weight
    review.weight_delta_kg = weight_delta
    review.motivation_self_rating = motivation_self_rating
    review.difficulty_self_rating = difficulty_self_rating
    review.completed_at = utc_now()

    if current_weight is not None:
        ctx.health_profile.weight_kg = current_weight
        db.add(WeightEntry(user_id=user.id, date_local=week_end.isoformat(), weight_kg=current_weight, source="review"))

    db.flush()
    plateau_detected = _detect_plateau_after_review(db, user)
    lapse_detected = _detect_lapse_now(db, user, ctx.health_profile, ctx.walking_state)
    next_week_number = week_number + 1
    next_target, adjustment_type, adjustment_reason = _compute_next_target(
        int(ctx.walking_state.current_daily_target_steps or 0),
        next_week_number,
        achieved_days=achieved_days,
        average_steps=average_steps,
        plateau_detected=plateau_detected,
        lapse_detected=lapse_detected,
    )
    review.plateau_detected = plateau_detected
    review.lapse_detected = lapse_detected
    review.next_week_target_steps = next_target

    ctx.walking_state.last_week_achieved_days = achieved_days
    ctx.walking_state.last_week_average_steps = average_steps
    ctx.walking_state.current_program_week = next_week_number
    ctx.walking_state.current_daily_target_steps = next_target
    ctx.walking_state.last_adjustment_type = adjustment_type
    ctx.walking_state.last_adjustment_reason = adjustment_reason
    ctx.walking_state.last_computed_at = utc_now()
    if plateau_detected:
        ctx.walking_state.current_mode = "plateau_hold"
    elif lapse_detected:
        ctx.walking_state.current_mode = "recovery"
    else:
        ctx.walking_state.current_mode = "normal"

    review_quest = _find_program_quest(db, user.id, _quest_template_key("weekly_review", str(week_number)))
    if review_quest is not None and not review_quest.is_completed:
        _complete_program_quest_row(db, user, review_quest)

    ctx.motivation = _compute_motivation(db, user, ctx.health_profile, ctx.walking_state)
    db.commit()
    return {
        "review": {
            "week_number": week_number,
            "achieved_days": achieved_days,
            "average_steps": average_steps,
            "current_weight_kg": current_weight,
            "previous_weight_kg": previous_weight,
            "weight_delta_kg": weight_delta,
            "plateau_detected": plateau_detected,
            "lapse_detected": lapse_detected,
            "next_week_target_steps": next_target,
            "completed_at": review.completed_at.isoformat() if review.completed_at else None,
        },
        "goal": _serialize_goal_state(db, _ensure_context(db, user)),
    }


def sync_steps(db: Session, user: User, *, steps: int, source: str, day_started_at: str | None = None) -> None:
    ctx = _ensure_context(db, user)
    _sync_step_day_record(db, user, ctx.health_profile, steps=steps, source=source, day_started_at=day_started_at)
    main_progress = _get_main_progress(db, user.id)
    day_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    if day_started_at:
        try:
            parsed = datetime.fromisoformat(day_started_at.replace("Z", "+00:00"))
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(UTC).replace(tzinfo=None)
            day_start = parsed
        except ValueError:
            pass
    daily_steps = (
        db.query(DailySteps)
        .filter(
            DailySteps.user_id == user.id,
            DailySteps.date == day_start,
        )
        .first()
    )
    if daily_steps is None:
        daily_steps = DailySteps(
            user_id=user.id,
            class_progress_id=main_progress.id if main_progress else None,
            steps=max(0, int(steps or 0)),
            date=day_start,
            synced_at=utc_now(),
            source=source,
        )
        db.add(daily_steps)
    else:
        daily_steps.steps = max(int(daily_steps.steps or 0), max(0, int(steps or 0)))
        daily_steps.synced_at = utc_now()
        daily_steps.source = source
        if main_progress and not daily_steps.class_progress_id:
            daily_steps.class_progress_id = main_progress.id
    db.flush()
    autocomplete_step_quests(db, user)


def post_complete_program_quest(db: Session, user: User, quest: Quest) -> None:
    if quest.domain != QUEST_DOMAIN:
        return
    quest.quest_state = "completed"
    if quest.quest_code == "recovery_restart":
        state = db.query(WalkingPlanState).filter(WalkingPlanState.user_id == user.id).first()
        if state and state.current_mode == "recovery":
            state.current_mode = "normal"
            state.last_adjustment_reason = "Ритм восстановлен через recovery_restart"
    db.commit()
