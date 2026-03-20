from datetime import timedelta

import pytest

from app.core.dates import utc_now
from app.models import DailySteps, Friendship, GameEvent, User, UserClassProgress
from app.schemas.social_schema import CoopQuestCreateSchema
from app.services import social_service


def _create_user(session, email: str) -> User:
    user = User(email=email, hashed_password="hashed", is_active=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _make_friends(session, left_id: int, right_id: int) -> None:
    session.add(Friendship(user_id=left_id, friend_id=right_id))
    session.add(Friendship(user_id=right_id, friend_id=left_id))
    session.commit()


def _create_progress(session, user_id: int, class_name: str = "warrior") -> UserClassProgress:
    progress = UserClassProgress(
        user_id=user_id,
        class_name=class_name,
        display_name=class_name.title(),
        is_unlocked=True,
        streak=2,
        last_activity=utc_now(),
    )
    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


def test_create_coop_quest_scales_rewards_with_party_size(db_session) -> None:
    creator = _create_user(db_session, "coop-creator@example.com")
    friend_one = _create_user(db_session, "coop-friend-one@example.com")
    friend_two = _create_user(db_session, "coop-friend-two@example.com")

    _make_friends(db_session, creator.id, friend_one.id)
    _make_friends(db_session, creator.id, friend_two.id)

    payload = CoopQuestCreateSchema(
        title="Weekend Raid",
        description="Close verified quests together.",
        objective_type="quests_completed",
        goal=6,
        duration_hours=24,
        reward_xp=180,
        reward_crystals=60,
        participant_ids=[friend_one.id, friend_two.id],
    )

    result = social_service.create_coop_quest(db_session, creator, payload)

    assert result["ok"] is True
    assert result["coop_quest"]["reward"]["xp"] == 234
    assert result["coop_quest"]["reward"]["crystals"] == 78
    assert len(result["coop_quest"]["participants"]) == 3


def test_search_users_paginates_beyond_first_page(db_session) -> None:
    seeker = _create_user(db_session, "search-owner@example.com")
    matches = [_create_user(db_session, f"hero-search-{index}@example.com") for index in range(5)]

    page_one = social_service.search_users(db_session, seeker, "hero-search", page=1, page_size=2)
    page_two = social_service.search_users(db_session, seeker, "hero-search", page=2, page_size=2)
    page_three = social_service.search_users(db_session, seeker, "hero-search", page=3, page_size=2)

    found_ids = {item["id"] for item in page_one["items"] + page_two["items"] + page_three["items"]}

    assert page_one["pagination"]["total_items"] == 5
    assert page_one["pagination"]["total_pages"] == 3
    assert len(page_one["items"]) == 2
    assert len(page_two["items"]) == 2
    assert len(page_three["items"]) == 1
    assert found_ids == {user.id for user in matches}


def test_search_users_hides_email_but_can_match_by_username(db_session) -> None:
    seeker = _create_user(db_session, "privacy-owner@example.com")
    target = _create_user(db_session, "hidden-handle@example.com")

    payload = social_service.search_users(db_session, seeker, "hidden-handle", page=1, page_size=20)

    assert payload["items"][0]["id"] == target.id
    assert payload["items"][0]["name"] == f"Игрок #{target.id}"
    assert payload["items"][0]["username"] == "hidden_handle"
    assert payload["items"][0]["friend_id"] == "RPG-000002"
    assert "email" not in payload["items"][0]


def test_search_users_matches_public_friend_id(db_session) -> None:
    seeker = _create_user(db_session, "friend-id-owner@example.com")
    target = _create_user(db_session, "friend-id-target@example.com")

    payload = social_service.search_users(db_session, seeker, "RPG-000002", page=1, page_size=20)

    assert [item["id"] for item in payload["items"]] == [target.id]
    assert payload["items"][0]["username"] == "friend_id_target"
    assert payload["items"][0]["friend_id"] == "RPG-000002"


def test_send_friend_request_reopens_declined_pair_without_integrity_error(db_session) -> None:
    sender = _create_user(db_session, "sender@example.com")
    receiver = _create_user(db_session, "receiver@example.com")

    first_request = social_service.send_friend_request(db_session, sender, receiver.id)
    social_service.respond_friend_request(db_session, receiver, first_request["request"]["id"], "decline")

    reopened_request = social_service.send_friend_request(db_session, sender, receiver.id)
    search_payload = social_service.search_users(db_session, sender, "receiver", page=1, page_size=20)

    assert reopened_request["ok"] is True
    assert reopened_request["request"]["id"] == first_request["request"]["id"]
    assert reopened_request["request"]["status"] == "pending"
    assert search_payload["items"][0]["status"] == "outgoing_pending"
    assert search_payload["items"][0]["request_id"] == first_request["request"]["id"]


def test_respond_friend_request_invalidates_leaderboard_cache_on_accept(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    sender = _create_user(db_session, "cache-sender@example.com")
    receiver = _create_user(db_session, "cache-receiver@example.com")
    invalidations: list[str] = []

    request_payload = social_service.send_friend_request(db_session, sender, receiver.id)
    monkeypatch.setattr(social_service, "invalidate_leaderboard_cache", lambda: invalidations.append("leaderboard"))

    response = social_service.respond_friend_request(db_session, receiver, request_payload["request"]["id"], "accept")

    assert response["status"] == "accepted"
    assert invalidations == ["leaderboard"]


def test_send_challenge_invitation_reopens_declined_pair_without_integrity_error(db_session) -> None:
    sender = _create_user(db_session, "challenge-sender@example.com")
    receiver = _create_user(db_session, "challenge-receiver@example.com")
    _make_friends(db_session, sender.id, receiver.id)

    first_invitation = social_service.send_challenge_invitation(
        db_session,
        sender,
        receiver.id,
        "pvp",
        "First duel",
        "Initial invite",
        "steps",
        5000,
        150,
        25,
    )
    social_service.respond_challenge_invitation(db_session, receiver, first_invitation.id, "decline")

    reopened_invitation = social_service.send_challenge_invitation(
        db_session,
        sender,
        receiver.id,
        "pvp",
        "Second duel",
        "Reopened invite",
        "steps",
        7500,
        180,
        30,
    )

    assert reopened_invitation.id == first_invitation.id
    assert reopened_invitation.status == "pending"
    assert reopened_invitation.title == "Second duel"
    assert reopened_invitation.goal == 7500
    assert reopened_invitation.reward_xp == 180


def test_friends_leaderboard_includes_current_user_without_friends(db_session) -> None:
    solo = _create_user(db_session, "solo@example.com")

    leaderboard = social_service.get_friends_leaderboard(db_session, solo, "level", page=1, page_size=20)

    assert leaderboard["pagination"]["total_items"] == 1
    assert leaderboard["items"][0]["user_id"] == solo.id
    assert leaderboard["items"][0]["rank"] == 1
    assert leaderboard["items"][0]["username"] == "solo"
    assert leaderboard["items"][0]["friend_id"] == "RPG-000001"


def test_weekly_leaderboard_ignores_stale_steps(db_session) -> None:
    current = _create_user(db_session, "weekly-current@example.com")
    stale = _create_user(db_session, "weekly-stale@example.com")
    fresh = _create_user(db_session, "weekly-fresh@example.com")
    current_progress = _create_progress(db_session, current.id)
    stale_progress = _create_progress(db_session, stale.id)
    fresh_progress = _create_progress(db_session, fresh.id)

    db_session.add_all([
        DailySteps(user_id=current.id, class_progress_id=current_progress.id, steps=5_000, date=utc_now() - timedelta(days=1)),
        DailySteps(user_id=stale.id, class_progress_id=stale_progress.id, steps=20_000, date=utc_now() - timedelta(days=14)),
        DailySteps(user_id=fresh.id, class_progress_id=fresh_progress.id, steps=3_000, date=utc_now()),
    ])
    db_session.commit()

    leaderboard = social_service.get_global_leaderboard(db_session, "steps", page=1, page_size=20, period="weekly")

    assert leaderboard["period"] == "weekly"
    assert leaderboard["items"][0]["user_id"] == current.id
    assert [item["user_id"] for item in leaderboard["items"][:3]] == [current.id, fresh.id, stale.id]
    assert leaderboard["items"][2]["score"] == 0


def test_season_leaderboard_uses_active_event_window(db_session) -> None:
    seasonal_leader = _create_user(db_session, "season-leader@example.com")
    seasonal_runner = _create_user(db_session, "season-runner@example.com")
    leader_progress = _create_progress(db_session, seasonal_leader.id)
    runner_progress = _create_progress(db_session, seasonal_runner.id)
    season_start = utc_now() - timedelta(days=2)

    db_session.add(
        GameEvent(
            event_type="season",
            slug="glass-valley",
            title="Glass Valley",
            description="Seasonal ladder",
            status="active",
            season_key="glass-valley",
            start_at=season_start,
            end_at=utc_now() + timedelta(days=5),
        )
    )
    db_session.add_all([
        DailySteps(user_id=seasonal_leader.id, class_progress_id=leader_progress.id, steps=900, date=utc_now() - timedelta(days=6)),
        DailySteps(user_id=seasonal_leader.id, class_progress_id=leader_progress.id, steps=1_500, date=utc_now() - timedelta(hours=6)),
        DailySteps(user_id=seasonal_runner.id, class_progress_id=runner_progress.id, steps=1_400, date=utc_now() - timedelta(hours=4)),
    ])
    db_session.commit()

    leaderboard = social_service.get_global_leaderboard(db_session, "steps", page=1, page_size=20, period="season")

    assert leaderboard["period"] == "season"
    assert leaderboard["season_key"] == "glass-valley"
    assert leaderboard["event_id"] is not None
    assert leaderboard["items"][0]["user_id"] == seasonal_leader.id
    assert leaderboard["items"][0]["score"] == 1_500


def test_list_coop_quests_refreshes_progress_and_orders_participants(db_session) -> None:
    creator = _create_user(db_session, "coop-live@example.com")
    friend = _create_user(db_session, "coop-live-friend@example.com")
    creator_progress = _create_progress(db_session, creator.id)
    friend_progress = _create_progress(db_session, friend.id)
    _make_friends(db_session, creator.id, friend.id)

    payload = CoopQuestCreateSchema(
        title="Live Run",
        description="Shared steps objective",
        objective_type="steps",
        goal=10_000,
        duration_hours=24,
        reward_xp=100,
        reward_crystals=20,
        participant_ids=[friend.id],
    )
    social_service.create_coop_quest(db_session, creator, payload)

    db_session.add_all([
        DailySteps(user_id=creator.id, class_progress_id=creator_progress.id, steps=3_500, date=utc_now()),
        DailySteps(user_id=friend.id, class_progress_id=friend_progress.id, steps=2_000, date=utc_now()),
    ])
    db_session.commit()

    result = social_service.list_coop_quests(db_session, creator, page=1, page_size=20)
    quest = result["items"][0]

    assert quest["progress"] == 5_500
    assert quest["participants"][0]["user_id"] == creator.id
    assert quest["participants"][0]["contribution"] == 3_500
    assert quest["participants"][1]["user_id"] == friend.id
    assert quest["participants"][1]["contribution"] == 2_000
