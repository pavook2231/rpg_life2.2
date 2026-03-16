from app import auth
from app.api.mobile_routes import router


def test_events_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/events")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls


def test_regenerate_today_quests_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/quests/regenerate-today")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls


def test_claim_weekly_goal_reward_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/rewards/weekly-goal/claim")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls


def test_claim_seasonal_goal_reward_endpoint_requires_authenticated_user() -> None:
    route = next(route for route in router.routes if getattr(route, "path", None) == "/api/v1/rewards/seasonal-goal/claim")
    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert auth.get_current_user in dependency_calls
