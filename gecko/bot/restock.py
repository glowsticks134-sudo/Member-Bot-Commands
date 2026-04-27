"""Token-import (restock), mass-join, cleanup helpers — pure async logic."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional

import discord

from ..config import BOT_TOKEN, CLIENT_ID, CLIENT_SECRET
from ..storage import (
    clear_stock,
    delete_user_auth,
    get_role_limit_for,
    read_all_auth_users,
    read_auth_users,
    save_user_auth,
    update_token_in_file,
)
from ..config import AUTHS_FILE
from ..tokens import add_member_to_guild, get_valid_token, refresh_access_token

log = logging.getLogger("gecko.restock")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def do_restock(raw_tokens: str) -> discord.Embed:
    """Bulk-import tokens. Each line = userId,access,refresh."""
    lines = [ln.strip() for ln in raw_tokens.splitlines() if ln.strip()]
    valid = invalid = duplicates = 0
    seen: set[str] = {r.user_id for r in read_auth_users()}
    for line in lines:
        parts = line.split(",")
        if len(parts) < 3 or not parts[0] or not parts[1] or not parts[2]:
            invalid += 1
            continue
        uid, access, refresh = parts[0], parts[1], parts[2]
        if uid in seen:
            duplicates += 1
            continue
        # Verify by refreshing the refresh_token (cheap, doesn't hit /users/@me).
        new = await refresh_access_token(refresh, CLIENT_ID, CLIENT_SECRET)
        if new is None:
            invalid += 1
            continue
        save_user_auth(uid, new["access_token"], new["refresh_token"])
        seen.add(uid)
        valid += 1
    e = discord.Embed(
        title="📦 Restock Complete",
        color=0x57F287 if valid > 0 else 0xED4245,
        timestamp=_now(),
    )
    e.add_field(name="✅ Added", value=str(valid), inline=True)
    e.add_field(name="❌ Invalid", value=str(invalid), inline=True)
    e.add_field(name="🔁 Duplicates", value=str(duplicates), inline=True)
    e.add_field(name="📊 Total Lines", value=str(len(lines)), inline=True)
    return e


async def do_check_tokens() -> discord.Embed:
    users = read_auth_users()
    if not users:
        return discord.Embed(description="❌ No tokens stored.", color=0xED4245)
    valid = refreshed = invalid = 0
    for u in users:
        result = await get_valid_token(
            u.user_id, u.access_token, u.refresh_token, CLIENT_ID, CLIENT_SECRET
        )
        if result is None:
            invalid += 1
        elif result != u.access_token:
            refreshed += 1
            valid += 1
            update_token_in_file(AUTHS_FILE, u.user_id, result, u.refresh_token)
        else:
            valid += 1
    e = discord.Embed(
        title="🔍 Token Validation Results", color=0x5865F2, timestamp=_now()
    )
    e.add_field(name="✅ Valid", value=str(valid), inline=True)
    e.add_field(name="🔄 Refreshed", value=str(refreshed), inline=True)
    e.add_field(name="❌ Invalid", value=str(invalid), inline=True)
    e.add_field(name="📊 Total", value=str(len(users)), inline=True)
    return e


async def do_mass_join(
    target_server_id: str,
    client: discord.Client,
    on_progress: Callable[[str], Awaitable[None]],
    limit: Optional[int] = None,
) -> Optional[discord.Embed]:
    target_id = int(target_server_id) if target_server_id.isdigit() else 0
    target = client.get_guild(target_id) if target_id else None
    if target is None:
        invite = (
            f"https://discord.com/oauth2/authorize?client_id={CLIENT_ID}"
            f"&permissions=8&scope=bot%20applications.commands"
        )
        return (
            discord.Embed(
                title="❌ Bot Not In Server",
                description=f"Bot is not in server `{target_server_id}`",
                color=0xED4245,
            )
            .add_field(
                name="🚨 Solution",
                value=f"**[Add bot to server first]({invite})**\nThen run djoin again",
                inline=False,
            )
        )

    all_users = read_all_auth_users()
    if not all_users:
        return discord.Embed(
            description="❌ No authenticated users. Share `!get_token` or `/get_token` first.",
            color=0xED4245,
        )

    cap = limit if (limit is not None and limit > 0) else len(all_users)
    queue = all_users[:cap]
    total = len(queue)
    success = already = failed = invalid = 0

    for idx, u in enumerate(queue, start=1):
        access = await get_valid_token(
            u.user_id, u.access_token, u.refresh_token, CLIENT_ID, CLIENT_SECRET
        )
        if access is None:
            invalid += 1
            delete_user_auth(u.user_id)
        else:
            if access != u.access_token:
                update_token_in_file(AUTHS_FILE, u.user_id, access, u.refresh_token)
            status = await add_member_to_guild(BOT_TOKEN, target_server_id, u.user_id, access)
            if status == 201:
                success += 1
            elif status == 204:
                already += 1
            else:
                failed += 1

        if idx % 5 == 0 or idx == total:
            try:
                await on_progress(
                    f"⏳ Progress: {idx}/{total} — ✅ {success} • 🔁 {already} • "
                    f"❌ {failed} • 🚫 {invalid}"
                )
            except Exception:
                pass
        await asyncio.sleep(0.3)

    e = discord.Embed(
        title="🚀 Mass Join Complete",
        color=0x57F287 if success > 0 else 0xED4245,
        timestamp=_now(),
    )
    e.add_field(name="✅ Joined", value=str(success), inline=True)
    e.add_field(name="🔁 Already In", value=str(already), inline=True)
    e.add_field(name="❌ Failed", value=str(failed), inline=True)
    e.add_field(name="🚫 Invalid (removed)", value=str(invalid), inline=True)
    e.add_field(name="📊 Total Tried", value=str(total), inline=True)
    return e


def get_djoin_limit_for_member(
    guild_id: str, member: Optional[discord.Member]
) -> Optional[int]:
    if member is None:
        return None
    role_ids = [str(r.id) for r in getattr(member, "roles", [])]
    return get_role_limit_for(guild_id, role_ids)


async def do_cleanup_servers(
    client: discord.Client, current_guild_id: str
) -> discord.Embed:
    others = [g for g in client.guilds if str(g.id) != current_guild_id]
    if not others:
        return discord.Embed(
            title="⚠️ No Other Servers",
            description="The bot is not in any other servers to leave.",
            color=0xFAA61A,
            timestamp=_now(),
        )
    left = failed = 0
    for g in others:
        try:
            await g.leave()
            left += 1
        except Exception:
            failed += 1
    e = discord.Embed(
        title="🧹 Cleanup Complete",
        description="The bot has left all other servers.",
        color=0x57F287 if failed == 0 else 0xFAA61A,
        timestamp=_now(),
    )
    e.add_field(name="✅ Left", value=str(left), inline=True)
    e.add_field(name="❌ Failed", value=str(failed), inline=True)
    e.add_field(name="📊 Total", value=str(len(others)), inline=True)
    return e


async def send_auth_success_dm(client: discord.Client, user_id: str) -> None:
    """Best-effort — swallow errors so callers don't have to care."""
    from .embeds import auth_success_dm_embed

    try:
        user = await client.fetch_user(int(user_id))
        await user.send(embed=auth_success_dm_embed())
    except Exception as e:
        log.debug("Could not DM auth success to %s: %s", user_id, e)
