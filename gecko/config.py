"""Environment + path configuration shared across the bot and API."""
from __future__ import annotations

import os
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("GECKO_DATA_DIR", ROOT_DIR / "artifacts" / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

AUTHS_FILE = DATA_DIR / "auths.txt"
STORED_TOKENS_FILE = DATA_DIR / "stored_tokens.txt"
OWNER_ROLES_FILE = DATA_DIR / "owner_roles.json"
ROLE_LIMITS_FILE = DATA_DIR / "role_limits.json"
CHANNEL_LOCKS_FILE = DATA_DIR / "channel_locks.json"
SCHEDULED_RESTOCKS_FILE = DATA_DIR / "scheduled_restocks.json"
DAILY_RESTOCK_FILE = DATA_DIR / "daily_restock.json"
SUBSCRIBERS_DB = DATA_DIR / "subscribers.sqlite3"

# ─── Server ───────────────────────────────────────────────────────────────────

_raw_port = os.environ.get("PORT")
if not _raw_port:
    raise RuntimeError("PORT environment variable is required but was not provided.")
try:
    PORT = int(_raw_port)
except ValueError as e:
    raise RuntimeError(f'Invalid PORT value: "{_raw_port}"') from e
if PORT <= 0:
    raise RuntimeError(f'Invalid PORT value: "{_raw_port}"')

# ─── Discord credentials ──────────────────────────────────────────────────────

BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "").strip()

HAS_BOT_CREDENTIALS = bool(BOT_TOKEN and CLIENT_ID and CLIENT_SECRET)

# ─── Hardcoded owners + main guild ────────────────────────────────────────────

# Anyone in this list has owner-level access in every guild the bot is in,
# regardless of who the server owner is. To add or remove an owner, edit this
# list and redeploy.
HARDCODED_OWNERS: tuple[str, ...] = (
    "1411750730380869828",
    "1486174745333465179",
)

# The main Memberty server. ALL bot commands (slash + prefix) are restricted
# to this guild only — anywhere else they reply with a "wrong server" notice.
MAIN_GUILD_ID = os.environ.get("MEMBERTY_GUILD_ID", "1489676641150963936").strip()

PREFIX = "!"
MAX_ROLES_PER_GUILD = 10


def get_redirect_uri() -> str:
    """Resolve the OAuth redirect URI lazily so the auth-link generator and
    the /redirect token-exchange always agree on the exact same value, no
    matter where the env vars get populated (Replit, Railway, local dev)."""
    explicit = os.environ.get("REDIRECT_URI", "").strip()
    if explicit:
        return explicit
    replit = os.environ.get("REPLIT_DOMAINS", "").split(",")[0].strip()
    if replit:
        return f"https://{replit}/redirect"
    railway = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip()
    if railway:
        return f"https://{railway}/redirect"
    return f"http://localhost:{PORT}/redirect"


def get_public_domain() -> str | None:
    explicit = os.environ.get("PUBLIC_DOMAIN", "").strip()
    if explicit:
        return explicit.rstrip("/")
    replit = os.environ.get("REPLIT_DOMAINS", "").split(",")[0].strip()
    if replit:
        return f"https://{replit}"
    railway = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip()
    if railway:
        return f"https://{railway}"
    return None
