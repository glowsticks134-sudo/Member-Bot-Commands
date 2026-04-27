"""Entry point: starts the FastAPI server and the Discord bot together."""
from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys

import uvicorn

from .bot import bot, start_bot
from .config import HAS_BOT_CREDENTIALS, PORT
from .server import app

log = logging.getLogger("gecko")


async def _run() -> None:
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
        access_log=False,
    )
    server = uvicorn.Server(config)

    server_task = asyncio.create_task(server.serve(), name="uvicorn")

    bot_task: asyncio.Task | None = None
    if HAS_BOT_CREDENTIALS:
        bot_task = asyncio.create_task(start_bot(), name="discord-bot")
    else:
        log.warning("Discord credentials not set — bot will not start")

    stop_event = asyncio.Event()

    def _shutdown() -> None:
        if not stop_event.is_set():
            stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _shutdown)
        except NotImplementedError:
            pass

    try:
        # Wait until either the server exits, the bot crashes, or we get a signal.
        tasks: list[asyncio.Task] = [server_task]
        if bot_task is not None:
            tasks.append(bot_task)
        wait_task = asyncio.create_task(stop_event.wait(), name="shutdown-wait")
        done, _pending = await asyncio.wait(
            tasks + [wait_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for d in done:
            if d.exception():
                log.error("Task %s crashed: %s", d.get_name(), d.exception())
    finally:
        # Graceful shutdown
        server.should_exit = True
        if bot_task is not None and not bot_task.done():
            try:
                await bot.close()
            except Exception:
                pass
        await asyncio.gather(server_task, return_exceptions=True)
        if bot_task is not None:
            await asyncio.gather(bot_task, return_exceptions=True)


def main() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )
    asyncio.run(_run())


if __name__ == "__main__":
    main()
