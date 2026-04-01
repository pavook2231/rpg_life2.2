from __future__ import annotations

import ipaddress
from typing import Iterable

from starlette.requests import Request

from app.core.config import TRUSTED_PROXY_IPS, TRUST_PROXY_HEADERS


def _extract_forwarded_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if not forwarded_for:
        return None
    real_ip = forwarded_for.split(",", 1)[0].strip()
    return real_ip or None


def _is_private_or_loopback_ip(ip_value: str) -> bool:
    try:
        parsed = ipaddress.ip_address(ip_value)
    except ValueError:
        return False
    return parsed.is_private or parsed.is_loopback


def _is_ip_in_trusted_networks(ip_value: str, trusted_values: Iterable[str]) -> bool:
    try:
        candidate_ip = ipaddress.ip_address(ip_value)
    except ValueError:
        return False

    for raw_value in trusted_values:
        entry = raw_value.strip()
        if not entry:
            continue

        if "/" in entry:
            try:
                if candidate_ip in ipaddress.ip_network(entry, strict=False):
                    return True
            except ValueError:
                continue
        else:
            if entry == ip_value:
                return True
    return False


def should_trust_forwarded_headers(
    request: Request,
    *,
    trust_proxy_headers: bool | None = None,
    trusted_proxy_ips: Iterable[str] | None = None,
) -> bool:
    client_ip = request.client.host if request.client and request.client.host else ""
    if not client_ip:
        return False

    use_proxy_headers = TRUST_PROXY_HEADERS if trust_proxy_headers is None else trust_proxy_headers
    if use_proxy_headers:
        allowed_proxy_ips = set(TRUSTED_PROXY_IPS if trusted_proxy_ips is None else trusted_proxy_ips)
        if allowed_proxy_ips:
            return _is_ip_in_trusted_networks(client_ip, allowed_proxy_ips)
        return True

    return _is_private_or_loopback_ip(client_ip)


def get_client_ip(
    request: Request,
    *,
    trust_proxy_headers: bool | None = None,
    trusted_proxy_ips: Iterable[str] | None = None,
) -> str:
    client_ip = request.client.host if request.client and request.client.host else "unknown"
    forwarded_ip = _extract_forwarded_ip(request)
    use_proxy_headers = TRUST_PROXY_HEADERS if trust_proxy_headers is None else trust_proxy_headers
    if use_proxy_headers:
        allowed_proxy_ips = set(TRUSTED_PROXY_IPS if trusted_proxy_ips is None else trusted_proxy_ips)
        if allowed_proxy_ips and not _is_ip_in_trusted_networks(client_ip, allowed_proxy_ips):
            return client_ip
        return forwarded_ip or client_ip

    # Safe default: honor forwarded IP only when current peer looks like a local proxy.
    if _is_private_or_loopback_ip(client_ip) and forwarded_ip:
        return forwarded_ip

    return client_ip
