"""Embed builders for all bot commands."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import discord

from ..config import (
    CLIENT_ID,
    HARDCODED_OWNERS,
    MAX_ROLES_PER_GUILD,
    get_public_domain,
    get_redirect_uri,
)
from ..storage import (
    get_guild_owner_roles,
    get_guild_role_limits,
    read_auth_users,
    read_channel_locks,
    read_daily_restock,
    read_scheduled_restocks,
    read_stored_tokens,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── Help / OAuth ─────────────────────────────────────────────────────────────


def help_embed() -> discord.Embed:
    e = discord.Embed(
        title="🤖 Members Bot — All Commands",
        color=0x5865F2,
        timestamp=_now(),
    )
    e.add_field(
        name="🔐 Authentication",
        value=(
            "`/get_token` or `!get_token` — Get auth link\n"
            "`/auth code:CODE` or `!auth CODE` — Authenticate\n"
            "`/check_tokens` or `!check_tokens` — Validate tokens"
        ),
        inline=False,
    )
    e.add_field(
        name="🚀 Mass Joining",
        value=(
            "`/djoin server_id:ID` or `!djoin ID` — Add all users to server\n"
            "`/servers` or `!servers` — List bot servers\n"
            "`/server_age` or `!server_age [ID]` — Check server age"
        ),
        inline=False,
    )
    e.add_field(
        name="👥 User Management",
        value=(
            "`/count` — Stored token count\n"
            "`/list_users` — List authenticated users\n"
            "`/restock` — Add bulk tokens (owners only)\n"
            "`/add_token` — Authorize one token (owners only)\n"
            "`/clear_stock` — Remove all stored tokens (owners only)\n"
            "`/schedule_restock time:1h` — Schedule a restock (owners only)\n"
            "`/list_schedules` — View pending schedules (owners only)\n"
            "`/cancel_schedule id:ID` — Cancel a schedule (owners only)\n"
            "`/set_daily_restock time:14:00` — Daily restock (owners only)\n"
            "`/cancel_daily_restock` — Cancel daily restock (owners only)\n"
            "`/edit_daily_restock` — Edit daily restock (owners only)\n"
            "`/daily_restock_status` — Show daily config (owners only)"
        ),
        inline=False,
    )
    e.add_field(
        name="👑 Owner Management",
        value=(
            "`/owners` — List all owners\n"
            "`/control_panel` — Open the interactive owner control panel\n"
            "`/setowner_role @role` — Grant owner access by role\n"
            "`/removeowner_role @role` — Revoke owner role\n"
            "`/listowner_roles` — List all owner roles\n"
            "`/restart` — Restart bot\n"
            "`/dashboard` — Get private dashboard link (owners only)"
        ),
        inline=False,
    )
    e.add_field(
        name="🎭 Role Limits",
        value=(
            "`/setrole role:@Role limit:N` — Set role djoin limit\n"
            "`/removerole role:@Role` — Remove role limit\n"
            "`/listroles` — List all role limits"
        ),
        inline=False,
    )
    e.add_field(
        name="📌 Channel Locks",
        value=(
            "`/setchannel type:djoin channel:#ch` — Lock djoin to channel\n"
            "`/setchannel type:auth channel:#ch` — Lock auth to channel\n"
            "`/clearchannel type:djoin` — Remove lock\n"
            "`/listchannels` — Show channel locks"
        ),
        inline=False,
    )
    e.add_field(
        name="📣 Announcements (Gecko)",
        value=(
            "`/setup_subscribe` — Post the opt-in subscribe embed\n"
            "`/announce message:...` — DM subscribers an announcement\n"
            "`/subscribers` — Count subscribers in this server"
        ),
        inline=False,
    )
    e.add_field(
        name="🔧 Utility",
        value=(
            "`/invite` — Bot invite link\n"
            "`/add` — Add bot embed\n"
            "`/stock` — Show current token stock\n"
            "`/status` — Show bot online status & stats\n"
            "`/cleanup_servers` — Leave all other servers (owners only)\n"
            "`/help` — Show this message"
        ),
        inline=False,
    )
    e.add_field(
        name="⚠️ Notes",
        value=(
            "• Bot auto-leaves servers after 14 days\n"
            "• Both `/` slash commands and `!` prefix commands work\n"
            "• Role-limit / channel commands: owner only"
        ),
        inline=False,
    )
    return e


def get_token_embed(user_id: str) -> discord.Embed:
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": get_redirect_uri(),
        "scope": "identify guilds.join",
        "prompt": "consent",
        "state": user_id,
    }
    url = f"https://discord.com/oauth2/authorize?{urlencode(params)}"
    e = discord.Embed(
        title="🔐 Authentication Required",
        description="Click the link below to authorize your account.",
        color=0x5865F2,
        timestamp=_now(),
    )
    e.add_field(
        name="🚨 Important",
        value="Codes expire in **10 minutes** — act fast!",
        inline=False,
    )
    e.add_field(
        name="🔗 Auth Link",
        value=f"[👉 Click Here to Authenticate 👈]({url})",
        inline=False,
    )
    e.add_field(
        name="📝 Steps",
        value=(
            "1. Click the link\n2. Authorize the app\n"
            "3. You'll be authorized automatically — no copy/paste needed."
        ),
        inline=False,
    )
    return e


def auth_success_dm_embed() -> discord.Embed:
    return (
        discord.Embed(
            title="✅ You're Authorized!",
            description=(
                "You have been **successfully authorized**.\n\n"
                "🛡️ **Only use `/djoin` in Memberty.** Any other server "
                "claiming to use this bot is a **scam** — do not trust it.\n\n"
                "📦 `/djoin` only works **when there is stock available**. "
                "If stock is empty, wait for a restock before trying."
            ),
            color=0x57F287,
            timestamp=_now(),
        )
        .set_footer(text="Memberty • Authorization confirmed")
    )


# ─── Stock / users / status ───────────────────────────────────────────────────


def count_embed() -> discord.Embed:
    stored = len(read_stored_tokens())
    stock = len(read_auth_users())
    return discord.Embed(
        title="📊 Stored Tokens",
        description=(
            f"There are currently **{stored}** stored tokens (from individual "
            f"OAuth authorizations).\n"
            f"Bulk stock contains **{stock}** tokens. Use `/stock` to see stock."
        ),
        color=0x5865F2,
        timestamp=_now(),
    )


def list_users_embed() -> tuple[discord.Embed, bool]:
    users = read_stored_tokens()
    if not users:
        return (
            discord.Embed(
                description="❌ No authenticated users found.", color=0xED4245
            ),
            True,
        )
    desc = ""
    for u in users:
        line = f"• <@{u.user_id}> (`{u.user_id}`)\n"
        if len(desc) + len(line) > 3900:
            desc += "…and more"
            break
        desc += line
    return (
        discord.Embed(
            title=f"👥 Authenticated Users ({len(users)})",
            description=desc,
            color=0x5865F2,
            timestamp=_now(),
        ),
        False,
    )


def stock_embed() -> discord.Embed:
    count = len(read_auth_users())
    has = count > 0
    e = discord.Embed(
        title="✅ Stock Available" if has else "❌ Out of Stock",
        description=(
            f"There are currently **{count}** tokens in stock and ready to use."
            if has
            else "There are **no tokens** in stock.\n\nUse `/restock` to add tokens."
        ),
        color=0x57F287 if has else 0xED4245,
        timestamp=_now(),
    )
    e.add_field(name="📦 Tokens in Stock", value=str(count), inline=True)
    return e


def status_embed(client: discord.Client, bot_start_time: Optional[datetime]) -> discord.Embed:
    online = client.user is not None
    uptime = "Unknown"
    if bot_start_time is not None:
        delta = _now() - bot_start_time
        d, rem = divmod(int(delta.total_seconds()), 86400)
        h, rem = divmod(rem, 3600)
        m, _ = divmod(rem, 60)
        uptime = f"{d}d {h}h {m}m"
    stock = len(read_auth_users())
    e = discord.Embed(
        title="🟢 Bot Online" if online else "🔴 Bot Offline",
        color=0x57F287 if online else 0xED4245,
        timestamp=_now(),
    )
    e.add_field(name="📡 Status", value="Online" if online else "Offline", inline=True)
    e.add_field(name="⏱️ Uptime", value=uptime, inline=True)
    e.add_field(name="🌐 Servers", value=str(len(client.guilds)), inline=True)
    e.add_field(name="📦 Tokens in Stock", value=str(stock), inline=True)
    e.add_field(name="🏷️ Bot Tag", value=str(client.user) if client.user else "Unknown", inline=True)
    if client.user and client.user.display_avatar:
        e.set_thumbnail(url=client.user.display_avatar.url)
    return e


# ─── Servers ──────────────────────────────────────────────────────────────────


def servers_embed(client: discord.Client, server_join_times: dict) -> discord.Embed:
    guilds = list(client.guilds)
    if not guilds:
        return discord.Embed(
            description="❌ Bot is not in any servers.", color=0xED4245
        )
    lines = []
    now = _now()
    for g in guilds:
        joined = server_join_times.get(g.id)
        if joined:
            days = (now - joined).days
            age = f"{days}d"
        else:
            age = "?"
        lines.append(f"• **{g.name}** (`{g.id}`) — {g.member_count} members — {age} ago")
    body = "\n".join(lines[:20])
    if len(lines) > 20:
        body += f"\n…and {len(lines) - 20} more"
    return discord.Embed(
        title=f"🌐 Servers ({len(guilds)})",
        description=body,
        color=0x5865F2,
        timestamp=_now(),
    )


def server_age_embed(
    server_id: Optional[str], client: discord.Client, server_join_times: dict
) -> discord.Embed:
    if server_id:
        guild = client.get_guild(int(server_id)) if server_id.isdigit() else None
        if guild is None:
            return discord.Embed(
                description=f"❌ Bot is not in server `{server_id}`.", color=0xED4245
            )
        joined = server_join_times.get(guild.id)
        days = (_now() - joined).days if joined else None
        e = discord.Embed(
            title=f"📅 Server Age: {guild.name}",
            description=(
                f"Bot has been in this server for **{days} day(s)**."
                if days is not None
                else "Join time unknown."
            ),
            color=0xED4245 if (days is not None and days >= 14) else 0x57F287,
            timestamp=_now(),
        )
        e.add_field(name="Server ID", value=f"`{guild.id}`", inline=True)
        e.add_field(name="Members", value=str(guild.member_count), inline=True)
        e.add_field(name="Days", value=str(days) if days is not None else "?", inline=True)
        e.add_field(
            name="Status",
            value="⚠️ Will leave soon" if (days is not None and days >= 14) else "✅ OK",
            inline=True,
        )
        return e

    lines = []
    for g in client.guilds:
        joined = server_join_times.get(g.id)
        days = (_now() - joined).days if joined else "?"
        flag = "⚠️" if (isinstance(days, int) and days >= 14) else "✅"
        lines.append(f"{flag} **{g.name}** — {days}d")
    return discord.Embed(
        title="📅 Server Ages",
        description="\n".join(lines) if lines else "No servers found.",
        color=0x5865F2,
        timestamp=_now(),
    )


def invite_embed() -> discord.Embed:
    url = (
        f"https://discord.com/oauth2/authorize?client_id={CLIENT_ID}"
        f"&permissions=8&scope=bot%20applications.commands"
    )
    return discord.Embed(
        title="🔗 Bot Invite Link",
        description=f"[👉 Click here to invite the bot]({url})",
        color=0x5865F2,
        timestamp=_now(),
    )


def add_embed(client: discord.Client) -> tuple[discord.Embed, discord.ui.View]:
    invite = (
        f"https://discord.com/oauth2/authorize?client_id={CLIENT_ID}"
        f"&permissions=8&scope=bot%20applications.commands"
    )
    e = discord.Embed(
        title="➕ Add Members Bot to Your Server",
        description=(
            "Click the button below to invite **Members Bot** to your Discord server.\n\n"
            "**What this bot does:**\n"
            "• Backup & restore server members via OAuth2\n"
            "• Mass-join authenticated users into any server\n"
            "• Auto token refresh & validation\n"
            "• Both `/` slash commands and `!` prefix commands"
        ),
        color=0x5865F2,
        timestamp=_now(),
    )
    if client.user and client.user.display_avatar:
        e.set_thumbnail(url=client.user.display_avatar.url)
    e.add_field(
        name="⚡ Permissions",
        value="Administrator (required for guild member management)",
        inline=False,
    )
    e.add_field(name="📋 Commands", value="22+ commands — slash & prefix", inline=True)
    e.add_field(name="🔒 OAuth2 Scopes", value="`bot` + `applications.commands`", inline=True)
    e.set_footer(text="Members Bot • Invite & start collecting tokens right away")

    view = discord.ui.View()
    view.add_item(
        discord.ui.Button(label="➕ Add to Server", style=discord.ButtonStyle.link, url=invite)
    )
    view.add_item(
        discord.ui.Button(
            label="📖 How to Use",
            style=discord.ButtonStyle.link,
            url="https://discord.com/channels/@me",
        )
    )
    return e, view


# ─── Owners / roles / channels ────────────────────────────────────────────────


def owners_embed(guild_owner_id: str, guild_id: str) -> discord.Embed:
    owner_roles = get_guild_owner_roles(guild_id)
    lines = [f"👑 <@{guild_owner_id}> — **Server Owner** (permanent)"]
    lines.append("\n**Global Owners** (hardcoded — full access in every server):")
    for oid in HARDCODED_OWNERS:
        lines.append(f"⭐ <@{oid}>")
    if owner_roles:
        lines.append("\n**Owner Roles** (anyone with these roles gets owner access):")
        for rid in owner_roles:
            lines.append(f"🛡️ <@&{rid}>")
    else:
        lines.append("\n*No owner roles configured.*")
        lines.append("Use `/setowner_role` or `!setowner_role @role` to add one.")
    return (
        discord.Embed(
            title="👑 Owner Access List",
            description="\n".join(lines),
            color=0x5865F2,
            timestamp=_now(),
        )
        .set_footer(
            text=f"{len(HARDCODED_OWNERS)} global owner(s) • {len(owner_roles)} owner role(s)"
        )
    )


def owner_roles_embed(guild_id: str) -> discord.Embed:
    roles = get_guild_owner_roles(guild_id)
    if not roles:
        return discord.Embed(
            title="🛡️ Owner Roles",
            description=(
                "No owner roles configured.\n\n"
                "Use `/setowner_role` or `!setowner_role @role` to grant owner-level "
                "access to everyone with a specific role.\n\n"
                "*Tip:* role-based ownership survives bot restarts and redeploys."
            ),
            color=0xFAA61A,
            timestamp=_now(),
        )
    lines = [f"🛡️ <@&{rid}>" for rid in roles]
    return (
        discord.Embed(
            title=f"🛡️ Owner Roles ({len(roles)})",
            description="\n".join(lines),
            color=0x5865F2,
            timestamp=_now(),
        )
        .set_footer(text="Anyone with one of these roles can use owner-only commands")
    )


def role_limits_embed(guild_id: str) -> discord.Embed:
    limits = get_guild_role_limits(guild_id)
    if not limits:
        return discord.Embed(
            title="🎭 Role djoin Limits",
            description=(
                "No role limits configured.\n"
                "Use `/setrole` or `!setrole ROLE_ID LIMIT` to add one."
            ),
            color=0xFAA61A,
            timestamp=_now(),
        )
    lines = [f"• <@&{rid}> — **{lim}** members" for rid, lim in limits.items()]
    return (
        discord.Embed(
            title=f"🎭 Role djoin Limits ({len(limits)}/{MAX_ROLES_PER_GUILD})",
            description="\n".join(lines),
            color=0x5865F2,
            timestamp=_now(),
        )
        .set_footer(text=f"Max {MAX_ROLES_PER_GUILD} roles per server")
    )


def channel_locks_embed(guild_id: str) -> discord.Embed:
    locks = read_channel_locks().get(guild_id, {})
    djoin_ch = locks.get("djoin")
    auth_ch = locks.get("auth")
    if not djoin_ch and not auth_ch:
        return discord.Embed(
            title="📌 Channel Locks",
            description=(
                "No channel locks set.\n"
                "Use `/setchannel` to restrict commands to specific channels."
            ),
            color=0xFAA61A,
            timestamp=_now(),
        )
    e = discord.Embed(title="📌 Channel Locks", color=0x5865F2, timestamp=_now())
    e.add_field(name="🚀 djoin", value=f"<#{djoin_ch}>" if djoin_ch else "Not locked", inline=True)
    e.add_field(name="🔐 auth", value=f"<#{auth_ch}>" if auth_ch else "Not locked", inline=True)
    return e


# ─── Reusable deny / error embeds ─────────────────────────────────────────────


def deny_embed() -> discord.Embed:
    return discord.Embed(
        title="❌ Access Denied",
        description="Only the **server owner** or an **extra owner** can use this command.",
        color=0xED4245,
    )


def deny_real_owner_embed() -> discord.Embed:
    return discord.Embed(
        title="❌ Access Denied",
        description="Only the **real server owner** can use this command.",
        color=0xED4245,
    )


def no_tokens_embed() -> discord.Embed:
    return discord.Embed(
        title="⚠️ No Tokens Provided",
        description=(
            "You must provide tokens to restock.\n\n"
            "**Slash command:** Use the `file` or `tokens` option\n"
            "**Prefix command:** Attach a `.txt` file OR paste tokens after `!restock`\n\n"
            "**Token format (one per line):**\n```userId,accessToken,refreshToken```"
        ),
        color=0xFAA61A,
    )


def not_authed_embed() -> discord.Embed:
    return discord.Embed(
        title="🔐 Not Authenticated",
        description=(
            "You must authorize before you can use `/djoin` or `!djoin`.\n\n"
            "**How to authorize:**\n"
            "1. Run `/get_token` to get your auth link\n"
            "2. Click the link and authorize the app\n"
            "3. You'll be authorized automatically and DM'd a confirmation\n\n"
            "(Alternatively, use `/auth code:YOUR_CODE` if you copied a code instead.)"
        ),
        color=0xED4245,
    )


def channel_locked_embed(channel_id: str, cmd: str) -> discord.Embed:
    return discord.Embed(
        title="📌 Wrong Channel",
        description=f"The `{cmd}` command is locked to <#{channel_id}>.\n\nPlease use it there.",
        color=0xFAA61A,
    )


def wrong_guild_embed() -> discord.Embed:
    return discord.Embed(
        title="🚫 Wrong Server",
        description=(
            "Memberty bot commands **only work in the official Memberty server**.\n\n"
            "🛡️ Any other server claiming to use this bot is a **scam** — do not trust it."
        ),
        color=0xED4245,
    )


def dashboard_embed() -> discord.Embed:
    domain = get_public_domain() or "http://localhost:3000"
    url = f"{domain}/dashboard/"
    return (
        discord.Embed(
            title="🖥️ Owner Dashboard",
            description=(
                "Here is your private link to the **Members Bot Dashboard**.\n\n"
                f"[👉 Open Dashboard]({url})\n\n"
                "**What you can do:**\n"
                "• View bot stats and connected servers\n"
                "• Manage stored OAuth2 tokens\n"
                "• Run and monitor mass joins\n"
                "• Configure role limits and channel locks\n"
                "• Manage extra owners\n\n"
                "⚠️ **Keep this link private.** Sign in using your bot token."
            ),
            color=0x5865F2,
            url=url,
            timestamp=_now(),
        )
        .set_footer(text="Only visible to you • Dashboard sessions last 8 hours")
    )


# ─── Daily / scheduled restocks ───────────────────────────────────────────────


def daily_restock_status_embed() -> discord.Embed:
    config = read_daily_restock()
    if not config:
        return discord.Embed(
            title="📅 Daily Restock",
            description="No daily restock configured.\nUse `/set_daily_restock` to set one up.",
            color=0xFAA61A,
            timestamp=_now(),
        )
    raw = config.get("rawTokens", "")
    token_count = sum(1 for line in raw.splitlines() if line.strip())
    last_ran = config.get("lastRanDate") or "Never"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ran_today = config.get("lastRanDate") == today
    e = discord.Embed(title="📅 Daily Restock Active", color=0x5865F2, timestamp=_now())
    e.add_field(name="⏰ Time (MST)", value=str(config.get("time", "?")), inline=True)
    e.add_field(name="📦 Tokens", value=str(token_count), inline=True)
    e.add_field(name="✅ Ran Today", value="Yes" if ran_today else "No", inline=True)
    e.add_field(name="📆 Last Ran", value=last_ran, inline=True)
    e.add_field(name="👤 Set By", value=f"<@{config.get('createdBy', '?')}>", inline=True)
    e.set_footer(text="Use /cancel_daily_restock to remove")
    return e


def list_schedules_embed() -> discord.Embed:
    schedules = read_scheduled_restocks()
    if not schedules:
        return discord.Embed(
            title="📅 Scheduled Restocks",
            description="No pending scheduled restocks.\nUse `/schedule_restock` to add one.",
            color=0xFAA61A,
            timestamp=_now(),
        )
    now_ms = int(_now().timestamp() * 1000)
    lines = []
    for s in schedules:
        remaining = s.get("runAt", 0) - now_ms
        if remaining > 0:
            mins = remaining // 60_000
            time_str = f"in {mins // 60}h {mins % 60}m" if mins >= 60 else f"in {mins}m"
        else:
            time_str = "running soon..."
        token_count = sum(1 for ln in s.get("rawTokens", "").splitlines() if ln.strip())
        lines.append(
            f"• `{s.get('id')}` — **{token_count} tokens** — {time_str} — <@{s.get('createdBy')}>"
        )
    return (
        discord.Embed(
            title=f"📅 Scheduled Restocks ({len(schedules)})",
            description="\n".join(lines),
            color=0x5865F2,
            timestamp=_now(),
        )
        .set_footer(text="Use /cancel_schedule id:ID to cancel one")
    )


# ─── Announcements (Gecko) ────────────────────────────────────────────────────


def subscribe_panel_embed(guild_name: str) -> discord.Embed:
    return (
        discord.Embed(
            title="📣 Announcement Subscriptions",
            description=(
                f"Want to get **{guild_name}** announcements as a DM?\n\n"
                "Click **Subscribe** below to opt in. You can click **Unsubscribe** "
                "anytime to stop. We'll only DM you when an admin posts an announcement."
            ),
            color=discord.Color.green(),
        )
        .set_footer(text="Gecko • Opt-in announcements")
    )


def announcement_dm_embed(guild_name: str, message: str) -> discord.Embed:
    return (
        discord.Embed(
            title=f"📣 Announcement from {guild_name}",
            description=message,
            color=discord.Color.blurple(),
        )
        .set_footer(text="You opted in. Click Unsubscribe on the embed in the server to stop.")
    )
