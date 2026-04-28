"""FastAPI server: OAuth redirect + dashboard API + health."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from html import escape
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import (
    CLIENT_ID,
    CLIENT_SECRET,
    HARDCODED_OWNERS,
    MAX_ROLES_PER_GUILD,
    PORT,
    ROOT_DIR,
    get_redirect_uri,
)
from .storage import (
    add_owner_role,
    clear_channel_lock,
    delete_user_auth,
    get_guild_owner_roles,
    get_guild_role_limits,
    read_auth_users,
    read_channel_locks,
    read_owner_roles,
    read_role_limits,
    read_stored_tokens,
    remove_guild_role_limit,
    remove_owner_role,
    save_stored_token,
    set_channel_lock,
    set_guild_role_limit,
)

log = logging.getLogger("gecko.server")
app = FastAPI(title="Gecko / Memberty API", version="1.0.0")


# ─── Health ───────────────────────────────────────────────────────────────────


@app.get("/api/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/healthz")
async def healthz_root() -> dict[str, str]:
    return {"status": "ok"}


# ─── OAuth callback (fresh rewrite — /auth/callback) ──────────────────────────


def _callback_html(*, ok: bool, title: str, message: str = "", code: str = "", state: str = "") -> HTMLResponse:
    """Render the OAuth callback page. Single source of truth for both success
    and error states. Pure inline HTML so there are no template-format gotchas."""
    accent = "#22c55e" if ok else "#ef4444"
    icon = "&#10003;" if ok else "&#10006;"

    if ok and code:
        full_command = f"/auth code:{code}"
        body_block = f"""
        <p class="lead">Paste this command in Discord to finish authorizing:</p>

        <div class="cmd" id="cmd">{escape(full_command)}</div>

        <button id="copyBtn" class="primary" onclick="copyCmd()">
          Copy /auth Command
        </button>

        <details class="raw">
          <summary>Show raw code only</summary>
          <div class="codeOnly" id="rawCode">{escape(code)}</div>
          <button class="secondary" onclick="copyRaw()">Copy raw code</button>
        </details>

        <p class="meta">
          {("State: <code>" + escape(state) + "</code> &middot; ") if state else ""}
          Code expires in ~10 minutes.
        </p>
        """
    else:
        body_block = f'<p class="lead">{escape(message)}</p>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Memberty &middot; Authorization</title>
<style>
  *,*::before,*::after {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(circle at top, #1e1b4b 0%, #0f0f23 60%);
    color: #e5e7eb; min-height: 100vh; display: grid; place-items: center; padding: 24px;
  }}
  .card {{
    width: 100%; max-width: 520px; background: #1f1f3a; border: 1px solid #2e2e55;
    border-radius: 18px; padding: 32px 28px; box-shadow: 0 30px 80px rgba(0,0,0,.5);
  }}
  .badge {{
    width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center;
    margin: 0 auto 16px; font-size: 28px; font-weight: 700; color: #0f0f23;
    background: {accent};
  }}
  h1 {{ margin: 0 0 6px; text-align: center; font-size: 22px; }}
  .lead {{ color: #c7c7d6; text-align: center; margin: 8px 0 22px; line-height: 1.5; }}
  .cmd {{
    background: #0d0d23; border: 1px solid #34345f; border-radius: 12px;
    padding: 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 15px; color: #86efac; word-break: break-all; margin-bottom: 14px;
  }}
  button {{
    width: 100%; padding: 14px; border: 0; border-radius: 12px; font-size: 15px;
    font-weight: 600; cursor: pointer; transition: transform .05s, background .15s;
  }}
  button:active {{ transform: scale(.98); }}
  .primary {{ background: #5865f2; color: #fff; }}
  .primary:hover {{ background: #4752c4; }}
  .secondary {{
    background: #2e2e55; color: #e5e7eb; margin-top: 10px;
  }}
  .secondary:hover {{ background: #3a3a6b; }}
  .copied {{ background: #22c55e !important; color: #0f0f23 !important; }}
  .raw {{ margin-top: 18px; }}
  .raw summary {{
    cursor: pointer; color: #9ca3af; font-size: 13px; padding: 6px 0;
    list-style: none; user-select: none;
  }}
  .raw summary::before {{ content: "▸ "; }}
  .raw[open] summary::before {{ content: "▾ "; }}
  .codeOnly {{
    margin-top: 10px; background: #0d0d23; border: 1px solid #34345f;
    border-radius: 10px; padding: 12px; font-family: ui-monospace, monospace;
    font-size: 13px; color: #fbbf24; word-break: break-all;
  }}
  .meta {{ color: #6b7280; font-size: 12px; text-align: center; margin: 18px 0 0; }}
  code {{ background: #0d0d23; padding: 2px 6px; border-radius: 5px; color: #c7c7d6; }}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">{icon}</div>
    <h1>{escape(title)}</h1>
    {body_block}
  </div>
  <script>
    function flashCopied(btn) {{
      const old = btn.innerText;
      btn.innerText = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {{ btn.innerText = old; btn.classList.remove("copied"); }}, 1400);
    }}
    function copyCmd() {{
      const text = document.getElementById("cmd").innerText.trim();
      navigator.clipboard.writeText(text).then(() => flashCopied(document.getElementById("copyBtn")));
    }}
    function copyRaw() {{
      const text = document.getElementById("rawCode").innerText.trim();
      const btn = document.querySelector(".raw .secondary");
      navigator.clipboard.writeText(text).then(() => flashCopied(btn));
    }}
  </script>
</body>
</html>"""
    return HTMLResponse(html)


@app.get("/auth/callback")
async def auth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    """Brand-new OAuth landing page. Discord redirects here after the user
    clicks Authorize. We don't exchange the code — we display it so the user
    can paste it into Discord with /auth code:CODE."""
    if error:
        return _callback_html(
            ok=False,
            title="Authorization Cancelled",
            message=(error_description or error or "Discord did not return a code."),
        )
    if not code:
        return _callback_html(
            ok=False,
            title="No Code Received",
            message="Discord didn't include a code in the URL. Run /get_token again and click the new link.",
        )
    return _callback_html(
        ok=True,
        title="You're Almost Done",
        code=code,
        state=state or "",
    )


# Backwards-compat alias: old links still land somewhere useful.
@app.get("/redirect")
async def oauth_redirect_alias(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    return await auth_callback(
        code=code, state=state, error=error, error_description=error_description
    )


# ─── Dashboard JWT-lite (HMAC-signed bearer token) ────────────────────────────

_DASH_SECRET = (CLIENT_SECRET or "fallback-dashboard-secret") + "_dashboard_v1"
_DASH_TTL_SECONDS = 8 * 3600


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64u_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign_token(payload: dict[str, Any]) -> str:
    body = _b64u(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(_DASH_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64u(sig)}"


def _verify_token(token: str) -> Optional[dict[str, Any]]:
    try:
        body, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(_DASH_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(_b64u(expected), sig):
        return None
    try:
        payload = json.loads(_b64u_decode(body))
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def _bearer_token(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    return auth.split(" ", 1)[1].strip()


def _require_owner(request: Request) -> dict[str, Any]:
    payload = _verify_token(_bearer_token(request))
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    return payload


# ─── Dashboard API ────────────────────────────────────────────────────────────


@app.post("/api/dashboard/login")
async def dashboard_login(req: Request) -> JSONResponse:
    """Sign in by sending the bot's own token. We compare against env."""
    body = await req.json()
    bot_token = (body.get("botToken") or "").strip()
    if not bot_token:
        raise HTTPException(400, "botToken required")
    from .config import BOT_TOKEN

    if not BOT_TOKEN or not hmac.compare_digest(bot_token, BOT_TOKEN):
        raise HTTPException(401, "Invalid bot token")
    payload = {
        "sub": "bot-owner",
        "iat": int(time.time()),
        "exp": int(time.time()) + _DASH_TTL_SECONDS,
        "jti": secrets.token_hex(8),
    }
    return JSONResponse({"token": _sign_token(payload), "expiresIn": _DASH_TTL_SECONDS})


@app.get("/api/dashboard/me")
async def dashboard_me(payload: dict = Depends(_require_owner)) -> JSONResponse:
    return JSONResponse({"sub": payload["sub"], "exp": payload["exp"]})


@app.get("/api/dashboard/stats")
async def dashboard_stats(_: dict = Depends(_require_owner)) -> JSONResponse:
    from .bot import bot

    return JSONResponse(
        {
            "stockCount": len(read_auth_users()),
            "storedCount": len(read_stored_tokens()),
            "guildCount": len(bot.guilds) if bot and bot.is_ready() else 0,
            "online": bool(bot and bot.is_ready()),
            "tag": str(bot.user) if (bot and bot.user) else None,
        }
    )


@app.get("/api/dashboard/users")
async def dashboard_users(_: dict = Depends(_require_owner)) -> JSONResponse:
    return JSONResponse(
        {
            "stored": [{"userId": u.user_id} for u in read_stored_tokens()],
            "stock": [{"userId": u.user_id} for u in read_auth_users()],
        }
    )


@app.delete("/api/dashboard/users/{user_id}")
async def dashboard_delete_user(
    user_id: str, _: dict = Depends(_require_owner)
) -> JSONResponse:
    delete_user_auth(user_id)
    return JSONResponse({"ok": True})


@app.get("/api/dashboard/guilds")
async def dashboard_guilds(_: dict = Depends(_require_owner)) -> JSONResponse:
    from .bot import bot

    if not bot or not bot.is_ready():
        return JSONResponse({"guilds": []})
    return JSONResponse(
        {
            "guilds": [
                {
                    "id": str(g.id),
                    "name": g.name,
                    "memberCount": g.member_count,
                    "ownerId": str(g.owner_id),
                    "iconUrl": g.icon.url if g.icon else None,
                }
                for g in bot.guilds
            ]
        }
    )


@app.get("/api/dashboard/role-limits")
async def dashboard_role_limits(_: dict = Depends(_require_owner)) -> JSONResponse:
    return JSONResponse({"limits": read_role_limits(), "max": MAX_ROLES_PER_GUILD})


@app.put("/api/dashboard/role-limits/{guild_id}/{role_id}")
async def dashboard_set_role_limit(
    guild_id: str, role_id: str, req: Request, _: dict = Depends(_require_owner)
) -> JSONResponse:
    body = await req.json()
    limit = int(body.get("limit", 0))
    if limit <= 0:
        raise HTTPException(400, "limit must be > 0")
    ok, err = set_guild_role_limit(guild_id, role_id, limit, MAX_ROLES_PER_GUILD)
    if not ok:
        raise HTTPException(400, err or "could not set")
    return JSONResponse({"ok": True})


@app.delete("/api/dashboard/role-limits/{guild_id}/{role_id}")
async def dashboard_delete_role_limit(
    guild_id: str, role_id: str, _: dict = Depends(_require_owner)
) -> JSONResponse:
    remove_guild_role_limit(guild_id, role_id)
    return JSONResponse({"ok": True})


@app.get("/api/dashboard/owner-roles")
async def dashboard_owner_roles(_: dict = Depends(_require_owner)) -> JSONResponse:
    return JSONResponse({"roles": read_owner_roles(), "hardcoded": list(HARDCODED_OWNERS)})


@app.put("/api/dashboard/owner-roles/{guild_id}/{role_id}")
async def dashboard_add_owner_role(
    guild_id: str, role_id: str, _: dict = Depends(_require_owner)
) -> JSONResponse:
    add_owner_role(guild_id, role_id)
    return JSONResponse({"ok": True})


@app.delete("/api/dashboard/owner-roles/{guild_id}/{role_id}")
async def dashboard_remove_owner_role(
    guild_id: str, role_id: str, _: dict = Depends(_require_owner)
) -> JSONResponse:
    remove_owner_role(guild_id, role_id)
    return JSONResponse({"ok": True})


@app.get("/api/dashboard/channel-locks")
async def dashboard_channel_locks(_: dict = Depends(_require_owner)) -> JSONResponse:
    return JSONResponse({"locks": read_channel_locks()})


@app.put("/api/dashboard/channel-locks/{guild_id}/{type}")
async def dashboard_set_channel_lock(
    guild_id: str, type: str, req: Request, _: dict = Depends(_require_owner)
) -> JSONResponse:
    if type not in {"djoin", "auth"}:
        raise HTTPException(400, "type must be djoin or auth")
    body = await req.json()
    channel_id = (body.get("channelId") or "").strip()
    if not channel_id:
        raise HTTPException(400, "channelId required")
    set_channel_lock(guild_id, type, channel_id)
    return JSONResponse({"ok": True})


@app.delete("/api/dashboard/channel-locks/{guild_id}/{type}")
async def dashboard_delete_channel_lock(
    guild_id: str, type: str, _: dict = Depends(_require_owner)
) -> JSONResponse:
    clear_channel_lock(guild_id, type)
    return JSONResponse({"ok": True})


@app.post("/api/dashboard/restock")
async def dashboard_restock(
    req: Request, _: dict = Depends(_require_owner)
) -> JSONResponse:
    body = await req.json()
    raw = (body.get("rawTokens") or "").strip()
    if not raw:
        raise HTTPException(400, "rawTokens required")
    from .bot.restock import do_restock

    embed = await do_restock(raw)
    fields = {f.name: f.value for f in embed.fields}
    return JSONResponse({"ok": True, "summary": fields})


# ─── Static dashboard (optional) ──────────────────────────────────────────────


_DASHBOARD_DIST = ROOT_DIR / "artifacts" / "dashboard" / "dist" / "public"
if _DASHBOARD_DIST.exists():
    # Mount the React build at /dashboard if it's been built.
    app.mount(
        "/dashboard",
        StaticFiles(directory=str(_DASHBOARD_DIST), html=True),
        name="dashboard",
    )
else:
    @app.get("/dashboard/")
    async def dashboard_unbuilt() -> HTMLResponse:
        return HTMLResponse(
            "<h1>Dashboard not built</h1>"
            "<p>Run <code>pnpm --filter @workspace/dashboard build</code> "
            "to enable the dashboard at this URL. The JSON API is already live "
            "under <code>/api/dashboard/*</code>.</p>",
            status_code=200,
        )


# ─── OAuth start (build & redirect to Discord) ────────────────────────────────


@app.get("/start")
async def oauth_start(
    user_id: Optional[str] = None,
    client_id: Optional[str] = None,
    scope: str = "identify guilds.join",
):
    """Build a Discord OAuth URL with THIS server's /redirect baked in and
    send the user to Discord. Use this instead of bot-generated links so the
    redirect_uri is guaranteed to match what's registered in the Dev Portal."""
    cid = (client_id or CLIENT_ID or "").strip()
    if not cid:
        return _error_page(
            "Missing client_id",
            "No DISCORD_CLIENT_ID is configured on this Replit, and no "
            "client_id was supplied in the URL.",
            "Either set DISCORD_CLIENT_ID, or visit /start?client_id=YOUR_APP_ID",
        )
    state = (user_id or secrets.token_urlsafe(16)).strip()
    params = {
        "client_id": cid,
        "response_type": "code",
        "redirect_uri": get_redirect_uri(),
        "scope": scope,
        "prompt": "consent",
        "state": state,
    }
    return RedirectResponse(
        f"https://discord.com/oauth2/authorize?{urlencode(params)}",
        status_code=302,
    )


# ─── Root ─────────────────────────────────────────────────────────────────────


_HOME_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Memberty OAuth Relay</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #1a1a2e; color: #eee; min-height: 100vh; margin: 0;
    display: grid; place-items: center; padding: 20px;
  }}
  .card {{
    max-width: 640px; width: 100%; padding: 36px;
    background: #232347; border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0,0,0,.45);
  }}
  h1 {{ margin: 0 0 8px; font-size: 24px; }}
  h2 {{ font-size: 16px; margin: 24px 0 8px; color: #c9c9d6; }}
  p  {{ color: #c9c9d6; line-height: 1.55; margin: 8px 0; }}
  .url {{
    background: #14142b; padding: 14px; border-radius: 10px;
    border: 1px solid #2a2a55; font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 13px; word-break: break-all; color: #57f287; margin: 8px 0;
  }}
  label {{ display: block; font-size: 13px; color: #c9c9d6; margin: 12px 0 6px; }}
  input {{
    width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #2a2a55;
    background: #14142b; color: #fff; font-size: 14px; font-family: inherit;
  }}
  button {{
    margin-top: 16px; padding: 12px 18px; border: 0; border-radius: 10px;
    background: #5865f2; color: #fff; font-weight: 600; font-size: 14px;
    cursor: pointer; width: 100%;
  }}
  button:hover {{ background: #4752c4; }}
  .hint {{ color: #888; font-size: 13px; margin-top: 14px; }}
  code {{ background: #14142b; padding: 2px 6px; border-radius: 6px; }}
</style>
</head>
<body>
  <div class="card">
    <h1>Memberty OAuth Relay</h1>
    <p>This Replit catches Discord's OAuth redirect and shows you the code to paste into <code>/auth code:&lt;code&gt;</code>.</p>

    <h2>1. Register this URL in the Discord Developer Portal</h2>
    <p>Go to your app → <b>OAuth2 → Redirects</b> and save exactly:</p>
    <div class="url">{redirect_uri}</div>

    <h2>2. Start the OAuth flow</h2>
    <p>Enter the IDs and click Authorize — this builds an OAuth link with the correct redirect baked in.</p>
    <form method="get" action="/start">
      <label>Discord Client ID (your app's Application ID)</label>
      <input name="client_id" value="{client_id}" placeholder="e.g. 1490360526101024778" required>
      <label>Your Discord User ID (used as state)</label>
      <input name="user_id" placeholder="e.g. 1411750730380869828" required>
      <button type="submit">Authorize with Discord</button>
    </form>

    <p class="hint">After authorizing, you'll see a code on this page — copy it and run <code>/auth code:CODE</code> in Discord.</p>
  </div>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def root() -> HTMLResponse:
    return HTMLResponse(
        _HOME_PAGE.format(
            redirect_uri=escape(get_redirect_uri()),
            client_id=escape(CLIENT_ID or ""),
        )
    )


@app.get("/api")
async def api_root() -> JSONResponse:
    return JSONResponse(
        {
            "service": "gecko",
            "status": "ok",
            "redirect_uri": get_redirect_uri(),
            "endpoints": {
                "home": "/",
                "start": "/start?client_id=...&user_id=...",
                "redirect": "/redirect",
                "health": "/api/healthz",
                "dashboard_api": "/api/dashboard/*",
                "dashboard_ui": "/dashboard/ (if built)",
            },
        }
    )
