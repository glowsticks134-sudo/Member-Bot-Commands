"""File-backed storage helpers (mirrors the layout of artifacts/data/)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import (
    AUTHS_FILE,
    CHANNEL_LOCKS_FILE,
    DAILY_RESTOCK_FILE,
    OWNER_ROLES_FILE,
    ROLE_LIMITS_FILE,
    SCHEDULED_RESTOCKS_FILE,
    STORED_TOKENS_FILE,
)

ChannelLockType = str  # "djoin" | "auth"


@dataclass
class TokenRow:
    user_id: str
    access_token: str
    refresh_token: str

    def to_line(self) -> str:
        return f"{self.user_id},{self.access_token},{self.refresh_token}"


# ─── Generic JSON helpers ─────────────────────────────────────────────────────

def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return default


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2), "utf-8")


# ─── Token-line files (auths.txt + stored_tokens.txt) ─────────────────────────

def _read_token_file(path: Path) -> list[TokenRow]:
    if not path.exists():
        return []
    rows: list[TokenRow] = []
    for line in path.read_text("utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(",")
        if len(parts) >= 3 and parts[0] and parts[1] and parts[2]:
            rows.append(TokenRow(parts[0], parts[1], parts[2]))
    return rows


def _write_token_file(path: Path, rows: list[TokenRow]) -> None:
    body = "\n".join(r.to_line() for r in rows)
    path.write_text(body + ("\n" if rows else ""), "utf-8")


def read_auth_users() -> list[TokenRow]:
    """Bulk-imported stock tokens (`auths.txt`)."""
    return _read_token_file(AUTHS_FILE)


def save_user_auth(user_id: str, access: str, refresh: str) -> None:
    rows = read_auth_users()
    found = False
    for r in rows:
        if r.user_id == user_id:
            r.access_token, r.refresh_token = access, refresh
            found = True
            break
    if not found:
        rows.append(TokenRow(user_id, access, refresh))
    _write_token_file(AUTHS_FILE, rows)


def delete_user_auth(user_id: str) -> None:
    rows = [r for r in read_auth_users() if r.user_id != user_id]
    _write_token_file(AUTHS_FILE, rows)


def update_token_in_file(path: Path, user_id: str, access: str, refresh: str) -> None:
    rows = _read_token_file(path)
    for r in rows:
        if r.user_id == user_id:
            r.access_token, r.refresh_token = access, refresh
    _write_token_file(path, rows)


def clear_stock() -> None:
    AUTHS_FILE.write_text("", "utf-8")


def read_stored_tokens() -> list[TokenRow]:
    """Individual OAuth-authorized users (`stored_tokens.txt`)."""
    return _read_token_file(STORED_TOKENS_FILE)


def save_stored_token(user_id: str, access: str, refresh: str) -> None:
    rows = read_stored_tokens()
    found = False
    for r in rows:
        if r.user_id == user_id:
            r.access_token, r.refresh_token = access, refresh
            found = True
            break
    if not found:
        rows.append(TokenRow(user_id, access, refresh))
    _write_token_file(STORED_TOKENS_FILE, rows)


def delete_stored_token(user_id: str) -> None:
    rows = [r for r in read_stored_tokens() if r.user_id != user_id]
    _write_token_file(STORED_TOKENS_FILE, rows)


def read_all_auth_users() -> list[TokenRow]:
    """Stored-token + stock combined, deduped by user_id (stored wins)."""
    merged: dict[str, TokenRow] = {}
    for r in read_auth_users():
        merged[r.user_id] = r
    for r in read_stored_tokens():
        merged[r.user_id] = r
    return list(merged.values())


# ─── Owner roles ──────────────────────────────────────────────────────────────

def read_owner_roles() -> dict[str, list[str]]:
    return _read_json(OWNER_ROLES_FILE, {})


def get_guild_owner_roles(guild_id: str) -> list[str]:
    return read_owner_roles().get(guild_id, [])


def is_owner_role(guild_id: str, role_id: str) -> bool:
    return role_id in get_guild_owner_roles(guild_id)


def add_owner_role(guild_id: str, role_id: str) -> None:
    data = read_owner_roles()
    data.setdefault(guild_id, [])
    if role_id not in data[guild_id]:
        data[guild_id].append(role_id)
    _write_json(OWNER_ROLES_FILE, data)


def remove_owner_role(guild_id: str, role_id: str) -> None:
    data = read_owner_roles()
    if guild_id not in data:
        return
    data[guild_id] = [r for r in data[guild_id] if r != role_id]
    _write_json(OWNER_ROLES_FILE, data)


# ─── Role limits ──────────────────────────────────────────────────────────────

def read_role_limits() -> dict[str, dict[str, int]]:
    return _read_json(ROLE_LIMITS_FILE, {})


def get_guild_role_limits(guild_id: str) -> dict[str, int]:
    return read_role_limits().get(guild_id, {})


def set_guild_role_limit(
    guild_id: str, role_id: str, limit: int, max_per_guild: int
) -> tuple[bool, str | None]:
    data = read_role_limits()
    data.setdefault(guild_id, {})
    guild_roles = data[guild_id]
    if role_id not in guild_roles and len(guild_roles) >= max_per_guild:
        return (
            False,
            f"Maximum of {max_per_guild} roles per server reached. Remove one first.",
        )
    guild_roles[role_id] = limit
    _write_json(ROLE_LIMITS_FILE, data)
    return True, None


def remove_guild_role_limit(guild_id: str, role_id: str) -> bool:
    data = read_role_limits()
    if guild_id not in data or role_id not in data[guild_id]:
        return False
    del data[guild_id][role_id]
    _write_json(ROLE_LIMITS_FILE, data)
    return True


def get_role_limit_for(guild_id: str, role_ids: list[str]) -> int | None:
    """Return the highest configured limit across a member's roles, or None."""
    limits = get_guild_role_limits(guild_id)
    best: int | None = None
    for rid in role_ids:
        if rid in limits and (best is None or limits[rid] > best):
            best = limits[rid]
    return best


# ─── Channel locks ────────────────────────────────────────────────────────────

def read_channel_locks() -> dict[str, dict[str, str]]:
    return _read_json(CHANNEL_LOCKS_FILE, {})


def get_channel_lock(guild_id: str, type_: ChannelLockType) -> str | None:
    return read_channel_locks().get(guild_id, {}).get(type_)


def set_channel_lock(guild_id: str, type_: ChannelLockType, channel_id: str) -> None:
    data = read_channel_locks()
    data.setdefault(guild_id, {})[type_] = channel_id
    _write_json(CHANNEL_LOCKS_FILE, data)


def clear_channel_lock(guild_id: str, type_: ChannelLockType) -> bool:
    data = read_channel_locks()
    if guild_id not in data or type_ not in data[guild_id]:
        return False
    del data[guild_id][type_]
    _write_json(CHANNEL_LOCKS_FILE, data)
    return True


# ─── Scheduled restocks ───────────────────────────────────────────────────────

def read_scheduled_restocks() -> list[dict[str, Any]]:
    return _read_json(SCHEDULED_RESTOCKS_FILE, [])


def write_scheduled_restocks(data: list[dict[str, Any]]) -> None:
    _write_json(SCHEDULED_RESTOCKS_FILE, data)


def add_scheduled_restock(entry: dict[str, Any]) -> None:
    data = read_scheduled_restocks()
    data.append(entry)
    write_scheduled_restocks(data)


def remove_scheduled_restock(id_: str) -> bool:
    data = read_scheduled_restocks()
    new = [e for e in data if e.get("id") != id_]
    if len(new) == len(data):
        return False
    write_scheduled_restocks(new)
    return True


# ─── Daily restock ────────────────────────────────────────────────────────────

def read_daily_restock() -> dict[str, Any] | None:
    return _read_json(DAILY_RESTOCK_FILE, None)


def write_daily_restock(data: dict[str, Any] | None) -> None:
    if data is None:
        if DAILY_RESTOCK_FILE.exists():
            DAILY_RESTOCK_FILE.unlink()
        return
    _write_json(DAILY_RESTOCK_FILE, data)
