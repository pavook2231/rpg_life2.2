from app.models import Friendship, User
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
