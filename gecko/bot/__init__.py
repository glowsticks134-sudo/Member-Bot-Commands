"""Discord bot package — re-exports the bot client and entry point."""
from .client import bot, set_client, get_client, start_bot

__all__ = ["bot", "set_client", "get_client", "start_bot"]
