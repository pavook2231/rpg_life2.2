from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.core.config import get_total_xp_for_level
from app.core.dates import utc_now
from app.models import DailySteps, Friendship, GameEvent, User, UserClassProgress
from app.schemas.social_schema import CoopQuestCreateSchema, PvpChallengeCreateSchema
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


def test_search_users_marks_existing_friend_as_friend_status(db_session) -> None:
    seeker = _create_user(db_session, "friend-search-owner@example.com")
    target = _create_user(db_session, "friend-search-target@example.com")
    _make_friends(db_session, seeker.id, target.id)

    payload = social_service.search_users(db_session, seeker, "friend-search-target", page=1, page_size=20)

    assert payload["items"][0]["id"] == target.id
    assert payload["items"][0]["status"] == "friend"


def test_list_friends_invalid_search_does_not_return_full_roster(db_session) -> None:
    owner = _create_user(db_session, "friends-owner@example.com")
    friend = _create_user(db_session, "friends-target@example.com")
    _make_friends(db_session, owner.id, friend.id)

    payload = social_service.list_friends(db_session, owner, page=1, page_size=20, search="!!!")

    assert payload["items"] == []
    assert payload["pagination"]["total_items"] == 0


def test_list_friends_includes_presence_status_and_rating_rank(db_session) -> None:
    owner = _create_user(db_session, "friends-presence-owner@example.com")
    leader = _create_user(db_session, "friends-presence-leader@example.com")
    sleeper = _create_user(db_session, "friends-presence-sleeper@example.com")
    leader_progress = _create_progress(db_session, leader.id)
    sleeper_progress = _create_progress(db_session, sleeper.id)

    leader_progress.level = 9
    leader_progress.last_activity = utc_now()
    sleeper_progress.level = 4
    sleeper_progress.last_activity = utc_now() - timedelta(hours=3)
    db_session.commit()

    _make_friends(db_session, owner.id, leader.id)
    _make_friends(db_session, owner.id, sleeper.id)

    payload = social_service.list_friends(db_session, owner, page=1, page_size=20)
    items_by_id = {item["id"]: item for item in payload["items"]}

    assert items_by_id[leader.id]["presence_status"] == "online"
    assert items_by_id[sleeper.id]["presence_status"] == "offline"
    assert items_by_id[leader.id]["rating_rank"] == 1
    assert items_by_id[sleeper.id]["rating_rank"] == 2
    assert items_by_id[leader.id]["class_name"] == "warrior"
    assert items_by_id[leader.id]["goal_type"] == "lose"
    assert items_by_id[leader.id]["goal_title"]


def test_list_friends_omits_inactive_friend_and_cleans_stale_link(db_session) -> None:
    owner = _create_user(db_session, "friends-stale-owner@example.com")
    removed = _create_user(db_session, "friends-stale-removed@example.com")
    _make_friends(db_session, owner.id, removed.id)

    removed.is_active = False
    db_session.commit()

    payload = social_service.list_friends(db_session, owner, page=1, page_size=20)
    remaining_links = db_session.query(Friendship).filter(Friendship.user_id == owner.id).count()

    assert payload["items"] == []
    assert remaining_links == 0


def test_social_payloads_do_not_expose_email(db_session) -> None:
    sender = _create_user(db_session, "privacy-sender@example.com")
    receiver = _create_user(db_session, "privacy-receiver@example.com")

    social_service.send_friend_request(db_session, sender, receiver.id)
    request_payload = social_service.list_friend_requests(db_session, receiver)
    accepted_request_id = request_payload["items"][0]["id"]
    social_service.respond_friend_request(db_session, receiver, accepted_request_id, "accept")
    friends_payload = social_service.list_friends(db_session, sender, page=1, page_size=20)

    assert "email" not in request_payload["items"][0]["user"]
    assert "email" not in friends_payload["items"][0]


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


def test_friend_request_accept_updates_friends_list_and_friends_leaderboard(db_session) -> None:
    sender = _create_user(db_session, "rank-sender@example.com")
    receiver = _create_user(db_session, "rank-receiver@example.com")
    sender_progress = _create_progress(db_session, sender.id)
    receiver_progress = _create_progress(db_session, receiver.id)

    request_payload = social_service.send_friend_request(db_session, sender, receiver.id)
    social_service.respond_friend_request(db_session, receiver, request_payload["request"]["id"], "accept")

    db_session.add_all([
        DailySteps(user_id=sender.id, class_progress_id=sender_progress.id, steps=2_000, date=utc_now()),
        DailySteps(user_id=receiver.id, class_progress_id=receiver_progress.id, steps=5_000, date=utc_now()),
    ])
    db_session.commit()

    friends_payload = social_service.list_friends(db_session, sender, page=1, page_size=20)
    leaderboard = social_service.get_friends_leaderboard(db_session, sender, "steps", page=1, page_size=20, period="weekly")

    assert [item["id"] for item in friends_payload["items"]] == [receiver.id]
    assert friends_payload["items"][0]["friend_id"] == "RPG-000002"
    assert leaderboard["pagination"]["total_items"] == 2
    assert [item["user_id"] for item in leaderboard["items"]] == [receiver.id, sender.id]
    assert leaderboard["items"][0]["score"] == 5_000
    assert leaderboard["items"][1]["score"] == 2_000


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
    assert leaderboard["items"][0]["goal_title"]


def test_power_leaderboard_uses_progress_power_and_shares_rank_for_ties(db_session) -> None:
    leader = _create_user(db_session, "power-leader@example.com")
    rival = _create_user(db_session, "power-rival@example.com")
    runner = _create_user(db_session, "power-runner@example.com")
    leader_progress = _create_progress(db_session, leader.id)
    rival_progress = _create_progress(db_session, rival.id)
    runner_progress = _create_progress(db_session, runner.id)

    leader_progress.level = 5
    leader_progress.current_xp = 220
    rival_progress.level = 5
    rival_progress.current_xp = 220
    runner_progress.level = 4
    runner_progress.current_xp = 75
    db_session.commit()

    leaderboard = social_service.get_global_leaderboard(db_session, "power", page=1, page_size=20)
    items = leaderboard["items"]
    expected_power = get_total_xp_for_level(5) + 220

    assert {items[0]["user_id"], items[1]["user_id"]} == {leader.id, rival.id}
    assert items[0]["score"] == expected_power
    assert items[1]["score"] == expected_power
    assert items[0]["rank"] == 1
    assert items[1]["rank"] == 1
    assert items[2]["user_id"] == runner.id
    assert items[2]["rank"] == 3


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


def test_create_pvp_challenge_sanitizes_excessive_rewards(db_session) -> None:
    creator = _create_user(db_session, "pvp-cap-creator@example.com")
    opponent = _create_user(db_session, "pvp-cap-opponent@example.com")
    _make_friends(db_session, creator.id, opponent.id)

    payload = PvpChallengeCreateSchema(
        opponent_id=opponent.id,
        objective_type="steps",
        goal=99_999_999,
        duration_hours=24,
        reward_xp=999_999,
        reward_crystals=999_999,
        title="Cap Test",
        description="Sanitize rewards",
    )
    result = social_service.create_pvp_challenge(db_session, creator, payload)
    challenge = result["challenge"]

    assert challenge["goal"] == social_service.MAX_CHALLENGE_GOAL
    assert challenge["reward"]["xp"] == social_service.MAX_CHALLENGE_REWARD_XP
    assert challenge["reward"]["crystals"] == social_service.MAX_CHALLENGE_REWARD_CRYSTALS


def test_accept_challenge_invitation_uses_sanitized_rewards(db_session) -> None:
    sender = _create_user(db_session, "invite-cap-sender@example.com")
    receiver = _create_user(db_session, "invite-cap-receiver@example.com")
    _make_friends(db_session, sender.id, receiver.id)

    invitation = social_service.send_challenge_invitation(
        db_session,
        sender,
        receiver.id,
        "pvp",
        "Huge reward",
        "Should be capped",
        "steps",
        50_000_000,
        5_000_000,
        5_000_000,
    )
    response = social_service.respond_challenge_invitation(db_session, receiver, invitation.id, "accept")
    challenge = db_session.query(social_service.Challenge).filter(social_service.Challenge.id == response["challenge_id"]).first()

    assert challenge is not None
    assert challenge.target_value == social_service.MAX_CHALLENGE_GOAL
    assert challenge.reward_xp == social_service.MAX_CHALLENGE_REWARD_XP
    assert challenge.reward_crystals == social_service.MAX_CHALLENGE_REWARD_CRYSTALS


def test_respond_pvp_challenge_rejects_unknown_action(db_session) -> None:
    creator = _create_user(db_session, "pvp-action-creator@example.com")
    opponent = _create_user(db_session, "pvp-action-opponent@example.com")
    _make_friends(db_session, creator.id, opponent.id)

    payload = PvpChallengeCreateSchema(
        opponent_id=opponent.id,
        objective_type="steps",
        goal=2000,
        duration_hours=24,
        reward_xp=100,
        reward_crystals=20,
        title="Action Test",
        description="Invalid action",
    )
    challenge_id = social_service.create_pvp_challenge(db_session, creator, payload)["challenge"]["id"]

    with pytest.raises(HTTPException) as exc:
        social_service.respond_pvp_challenge(db_session, opponent, challenge_id, "maybe")

    assert exc.value.status_code == 400
