from ipaddress import ip_address, ip_network

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import settings


def _client_ip(request: Request) -> str:
    remote = get_remote_address(request)
    if not remote:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for") or ""
    if not forwarded.strip():
        return remote
    trusted_ranges = []
    for value in settings.trusted_proxy_ips:
        try:
            trusted_ranges.append(ip_network(value, strict=False))
        except ValueError:
            continue
    if not trusted_ranges:
        return remote
    try:
        remote_ip = ip_address(remote)
    except ValueError:
        return remote
    if not any(remote_ip in network for network in trusted_ranges):
        return remote
    forwarded_ip = forwarded.split(",")[0].strip()
    try:
        ip_address(forwarded_ip)
        return forwarded_ip
    except ValueError:
        return remote
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip)
