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

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
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


# ─── OAuth redirect ───────────────────────────────────────────────────────────

_REDIRECT_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Memberty Authorization</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #1a1a2e; color: #eee; display: grid; place-items: center;
    min-height: 100vh; margin: 0; padding: 20px;
  }}
  .card {{
    max-width: 560px; width: 100%; padding: 36px; border-radius: 16px;
    background: #232347; box-shadow: 0 24px 64px rgba(0,0,0,.45);
  }}
  h1 {{ margin: 0 0 12px; font-size: 24px; text-align: center; }}
  p  {{ margin: 8px 0; color: #c9c9d6; line-height: 1.55; }}
  .ok  {{ color: #57f287; }}
  .err {{ color: #ed4245; }}
  .hint {{ color: #888; font-size: 13px; margin-top: 22px; text-align: center; }}
  code {{ background: #14142b; padding: 2px 6px; border-radius: 6px; color: #fff; }}
  .code-box {{
    margin: 22px 0 14px; padding: 16px; background: #14142b; border-radius: 10px;
    border: 1px solid #2a2a55;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 14px; word-break: break-all; color: #57f287;
  }}
  .row {{ display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }}
  button {{
    flex: 1; min-width: 140px; padding: 12px 16px; border: 0; border-radius: 10px;
    background: #5865f2; color: #fff; font-weight: 600; font-size: 14px;
    cursor: pointer; transition: background .15s;
  }}
  button:hover {{ background: #4752c4; }}
  button.secondary {{ background: #383868; }}
  button.secondary:hover {{ background: #45457d; }}
  .copied {{ background: #57f287 !important; color: #14142b !important; }}
  .step {{
    margin-top: 18px; padding: 14px 16px; background: #1a1a3d;
    border-left: 3px solid #5865f2; border-radius: 6px; font-size: 14px;
  }}
  .step b {{ color: #fff; }}
</style>
</head>
<body>
  <div class="card">
    {content}
  </div>
  <script>
    function copyCode(id, btn) {{
      const text = document.getElementById(id).innerText.trim();
      navigator.clipboard.writeText(text).then(() => {{
        const original = btn.innerText;
        btn.innerText = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {{
          btn.innerText = original;
          btn.classList.remove("copied");
        }}, 1500);
      }});
    }}
  </script>
</body>
</html>
"""


def _page(content_html: str) -> HTMLResponse:
    return HTMLResponse(_REDIRECT_PAGE.format(content=content_html))


def _error_page(title: str, body: str, hint: str) -> HTMLResponse:
    return _page(
        f'<h1 class="err">{escape(title)}</h1>'
        f"<p>{escape(body)}</p>"
        f'<p class="hint">{escape(hint)}</p>'
    )


@app.get("/redirect")
async def oauth_redirect(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    if error:
        return _error_page(
            "Authorization Cancelled",
            f"Discord returned: {error}",
            "You can close this tab and try again from inside Discord.",
        )
    if not code:
        return _error_page(
            "Missing Code",
            "We didn't receive a code from Discord.",
            "Please re-run /get_token in Discord and try again.",
        )

    safe_code = escape(code)
    state_block = ""
    if state:
        safe_state = escape(state)
        state_block = (
            '<div class="step" style="margin-top:24px">'
            "<b>State (your Discord user ID):</b><br>"
            f'<span style="font-family:ui-monospace,monospace;color:#c9c9d6">{safe_state}</span>'
            "</div>"
        )

    content = (
        '<h1 class="ok">Got Your Code</h1>'
        "<p>Copy the code below and paste it into Discord with "
        "<code>/auth code:&lt;code&gt;</code> to finish authorizing.</p>"
        f'<div class="code-box" id="oauth-code">{safe_code}</div>'
        '<div class="row">'
        '  <button onclick="copyCode(\'oauth-code\', this)">Copy Code</button>'
        '  <button class="secondary" onclick="copyCode(\'auth-cmd\', this)">Copy /auth Command</button>'
        "</div>"
        f'<div id="auth-cmd" style="display:none">/auth code:{safe_code}</div>'
        '<div class="step">'
        "<b>Next step:</b> open Discord and run "
        f'<code>/auth code:{safe_code[:8]}…</code>'
        "</div>"
        f"{state_block}"
        '<p class="hint">Codes expire in ~10 minutes — use it soon.</p>'
    )
    return _page(content)


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


# ─── Root ─────────────────────────────────────────────────────────────────────


@app.get("/")
async def root() -> JSONResponse:
    return JSONResponse(
        {
            "service": "gecko",
            "status": "ok",
            "endpoints": {
                "health": "/api/healthz",
                "redirect": "/redirect",
                "dashboard_api": "/api/dashboard/*",
                "dashboard_ui": "/dashboard/ (if built)",
            },
        }
    )
