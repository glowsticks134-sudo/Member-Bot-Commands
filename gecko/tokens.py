"""Discord OAuth2 token helpers (refresh + validate)."""
from __future__ import annotations

import logging
from typing import Optional

import aiohttp

DISCORD_API = "https://discord.com/api/v10"

log = logging.getLogger("gecko.tokens")


async def refresh_access_token(
    refresh_token: str, client_id: str, client_secret: str
) -> Optional[dict[str, str]]:
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(
                f"{DISCORD_API}/oauth2/token",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            ) as r:
                if r.status == 200:
                    body = await r.json()
                    return {
                        "access_token": body["access_token"],
                        "refresh_token": body["refresh_token"],
                    }
                return None
    except Exception as e:
        log.debug("refresh_access_token error: %s", e)
        return None


async def get_valid_token(
    user_id: str,
    access_token: str,
    refresh_token: str,
    client_id: str,
    client_secret: str,
) -> Optional[str]:
    """Return a usable access token (refreshes if needed). None if invalid."""
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(
                f"{DISCORD_API}/users/@me",
                headers={"Authorization": f"Bearer {access_token}"},
            ) as r:
                if r.status == 200:
                    return access_token
    except Exception:
        pass

    new = await refresh_access_token(refresh_token, client_id, client_secret)
    if new:
        return new["access_token"]
    return None


async def exchange_code(
    code: str, client_id: str, client_secret: str, redirect_uri: str
) -> tuple[bool, dict | str]:
    """Exchange an OAuth code for tokens. Returns (ok, data_or_error)."""
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(
                f"{DISCORD_API}/oauth2/token",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            ) as r:
                body = await r.json()
                if r.status == 200:
                    return True, body
                return False, body.get("error_description", "Unknown error")
    except Exception:
        return False, "Network error during authentication"


async def add_member_to_guild(
    bot_token: str, guild_id: str, user_id: str, access_token: str
) -> int:
    """PUT /guilds/{guild_id}/members/{user_id} — returns the HTTP status."""
    try:
        async with aiohttp.ClientSession() as s:
            async with s.put(
                f"{DISCORD_API}/guilds/{guild_id}/members/{user_id}",
                headers={
                    "Authorization": f"Bot {bot_token}",
                    "Content-Type": "application/json",
                },
                json={"access_token": access_token},
            ) as r:
                return r.status
    except Exception:
        return 0
