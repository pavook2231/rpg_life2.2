from app.core.dates import utc_now
from app.models import User, UserClassProgress
from app.services import progression_service


def _create_user(session, email: str) -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_progress(session, user_id: int, strength: float) -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name="warrior",
        display_name="Warrior",
        is_unlocked=True,
        strength=strength,
        agility=1.0,
        intellect=1.0,
        stamina=1.0,
        last_activity=utc_now(),
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def test_calculate_system_daily_cap_scales_with_strength() -> None:
    assert progression_service.calculate_system_daily_cap(0) == 10
    assert progression_service.calculate_system_daily_cap(9.9) == 10
    assert progression_service.calculate_system_daily_cap(10) == 11
    assert progression_service.calculate_system_daily_cap(20) == 12
    assert progression_service.calculate_system_daily_cap(49) == 14
    assert progression_service.calculate_system_daily_cap(50) == 15
    assert progression_service.calculate_system_daily_cap(120) == 15


def test_daily_limits_include_strength_bonus_system_cap(db_session) -> None:
    user = _create_user(db_session, "strength-cap@example.com")
    progress = _create_progress(db_session, user.id, strength=20)

    limits = progression_service.get_daily_completion_limits(db_session, user.id, progress)

    assert limits["system_cap"] == 12
    assert limits["remaining_system"] == 12
    assert limits["total_cap"] == 20
