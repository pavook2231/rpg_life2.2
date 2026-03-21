from app.schemas.auth_schema import UserCreate


def test_user_create_allows_minimal_mobile_signup_payload() -> None:
    payload = UserCreate(
        email="newbie@example.com",
        password="Password123",
        name="New Hero",
    )

    assert payload.birth_year is None
    assert payload.gender == "unspecified"
    assert payload.character_class == "mage"
    assert payload.goal_type == "personal_development"
    assert payload.goal_term_months == 6
