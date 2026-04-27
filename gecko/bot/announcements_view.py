"""Persistent subscribe / unsubscribe buttons for the Gecko announcement panel."""
from __future__ import annotations

import discord

from ..announcements import db_add, db_remove


class SubscribeView(discord.ui.View):
    """Persistent View — buttons survive restarts because custom_id is fixed."""

    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Subscribe",
        style=discord.ButtonStyle.success,
        custom_id="gecko:subscribe",
        emoji="🔔",
    )
    async def subscribe(
        self, interaction: discord.Interaction, _button: discord.ui.Button
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This only works inside a server.", ephemeral=True
            )
            return
        added = db_add(interaction.guild_id, interaction.user.id)
        msg = (
            "✅ You're subscribed! You'll get announcements via DM."
            if added
            else "ℹ️ You were already subscribed."
        )
        await interaction.response.send_message(msg, ephemeral=True)

    @discord.ui.button(
        label="Unsubscribe",
        style=discord.ButtonStyle.danger,
        custom_id="gecko:unsubscribe",
        emoji="🔕",
    )
    async def unsubscribe(
        self, interaction: discord.Interaction, _button: discord.ui.Button
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This only works inside a server.", ephemeral=True
            )
            return
        removed = db_remove(interaction.guild_id, interaction.user.id)
        msg = (
            "✅ You've been unsubscribed. No more DMs."
            if removed
            else "ℹ️ You weren't subscribed."
        )
        await interaction.response.send_message(msg, ephemeral=True)
