"""Owner-only control panel: an embed + 8 buttons for everyday actions."""
from __future__ import annotations

import discord

from .auth import is_authorized_member
from .embeds import deny_embed
from .restock import do_check_tokens, do_cleanup_servers
from . import embeds as _embeds


def control_panel_embed() -> discord.Embed:
    return (
        discord.Embed(
            title="🛠️ Memberty Control Panel",
            description=(
                "Quick access to common owner actions. Buttons are owner-only "
                "and ephemeral — only the user who clicked sees the result."
            ),
            color=0x5865F2,
        )
        .set_footer(text="Memberty • Use the buttons below")
    )


def _btn(label: str, custom_id: str, *, style=discord.ButtonStyle.secondary, emoji=None):
    return discord.ui.Button(label=label, custom_id=custom_id, style=style, emoji=emoji)


def control_panel_view() -> discord.ui.View:
    """A persistent View — buttons keep working across restarts."""
    view = discord.ui.View(timeout=None)
    view.add_item(_btn("Stock", "cp:stock", emoji="📦"))
    view.add_item(_btn("Status", "cp:status", emoji="🟢"))
    view.add_item(_btn("Count", "cp:count", emoji="📊"))
    view.add_item(_btn("List Users", "cp:list_users", emoji="👥"))
    view.add_item(_btn("Check Tokens", "cp:check_tokens", emoji="🔍", style=discord.ButtonStyle.primary))
    view.add_item(_btn("Servers", "cp:servers", emoji="🌐"))
    view.add_item(_btn("Owners", "cp:owners", emoji="👑"))
    view.add_item(_btn("Cleanup Servers", "cp:cleanup", emoji="🧹", style=discord.ButtonStyle.danger))
    return view


async def handle_control_panel_button(
    interaction: discord.Interaction, server_join_times: dict
) -> None:
    """Dispatch cp:* button clicks. Always replies ephemerally."""
    cid = interaction.data.get("custom_id", "") if interaction.data else ""
    action = cid.split(":", 1)[1] if ":" in cid else ""
    guild = interaction.guild
    if guild is None:
        await interaction.response.send_message("❌ Guild only.", ephemeral=True)
        return
    guild_owner_id = str(guild.owner_id)
    user_id = str(interaction.user.id)
    if not is_authorized_member(guild_owner_id, str(guild.id), user_id, interaction.user):
        await interaction.response.send_message(embed=deny_embed(), ephemeral=True)
        return

    if action == "stock":
        await interaction.response.send_message(embed=_embeds.stock_embed(), ephemeral=True)
    elif action == "status":
        await interaction.response.send_message(
            embed=_embeds.status_embed(interaction.client, getattr(interaction.client, "_bot_start_time", None)),
            ephemeral=True,
        )
    elif action == "count":
        await interaction.response.send_message(embed=_embeds.count_embed(), ephemeral=True)
    elif action == "list_users":
        embed, _ = _embeds.list_users_embed()
        await interaction.response.send_message(embed=embed, ephemeral=True)
    elif action == "check_tokens":
        await interaction.response.defer(ephemeral=True)
        embed = await do_check_tokens()
        await interaction.followup.send(embed=embed, ephemeral=True)
    elif action == "servers":
        await interaction.response.send_message(
            embed=_embeds.servers_embed(interaction.client, server_join_times), ephemeral=True
        )
    elif action == "owners":
        await interaction.response.send_message(
            embed=_embeds.owners_embed(guild_owner_id, str(guild.id)), ephemeral=True
        )
    elif action == "cleanup":
        await interaction.response.defer(ephemeral=True)
        embed = await do_cleanup_servers(interaction.client, str(guild.id))
        await interaction.followup.send(embed=embed, ephemeral=True)
    else:
        await interaction.response.send_message("❌ Unknown action.", ephemeral=True)
