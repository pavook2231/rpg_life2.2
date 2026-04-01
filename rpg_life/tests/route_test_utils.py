from fastapi import APIRouter, FastAPI
from starlette.requests import Request


def build_request(
    router: APIRouter,
    path: str,
    *,
    method: str = "GET",
    headers: list[tuple[bytes, bytes]] | None = None,
    query_string: bytes = b"",
    client: tuple[str, int] | None = None,
) -> Request:
    app = FastAPI()
    app.include_router(router)
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": headers or [],
            "app": app,
            "router": app.router,
            "scheme": "https",
            "server": ("example.com", 443),
            "client": client,
            "root_path": "",
            "query_string": query_string,
        }
    )


def dependency_calls_for(router: APIRouter, path: str) -> set:
    route = next(route for route in router.routes if getattr(route, "path", None) == path)
    return {dependency.call for dependency in route.dependant.dependencies}
