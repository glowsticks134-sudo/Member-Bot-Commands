"""Authorization helpers (server owner / global owner / owner role)."""
from __future__ import annotations

from typing import Iterable, Optional

import discord

from ..config import HARDCODED_OWNERS
from ..storage import get_guild_owner_roles


def is_hardcoded_owner(user_id: str) -> bool:
    return user_id in HARDCODED_OWNERS


def is_authorized_user(guild_owner_id: str, user_id: str) -> bool:
    return user_id == guild_owner_id or is_hardcoded_owner(user_id)


def member_role_ids(member: Optional[discord.Member | discord.User]) -> list[str]:
    if member is None:
        return []
    roles = getattr(member, "roles", None)
    if not roles:
        return []
    out: list[str] = []
    for r in roles:
        rid = getattr(r, "id", None)
        if rid is not None:
            out.append(str(rid))
        elif isinstance(r, (str, int)):
            out.append(str(r))
    return out


def member_has_owner_role(
    guild_id: str, member: Optional[discord.Member | discord.User]
) -> bool:
    role_ids = member_role_ids(member)
    if not role_ids:
        return False
    owner_roles = get_guild_owner_roles(guild_id)
    return any(rid in owner_roles for rid in role_ids)


def is_authorized_member(
    guild_owner_id: str,
    guild_id: str,
    user_id: str,
    member: Optional[discord.Member | discord.User],
) -> bool:
    return is_authorized_user(guild_owner_id, user_id) or member_has_owner_role(
        guild_id, member
    )
