import express, { type Request, type Response } from "express";
import { PORT, CLIENT_ID, CLIENT_SECRET, MAIN_GUILD_ID } from "./config.js";
import { exchangeCode, fetchOAuthUserId } from "./oauth.js";
import { saveUserAuth } from "./storage/tokens.js";
import { botStatus } from "./botStatus.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderOAuthPage(opts: {
  success: boolean;
  code?: string;
  state?: string;
  errorTitle?: string;
  errorBody?: string;
}): string {
  const { success, code = "", state = "", errorTitle = "", errorBody = "" } = opts;
  const accent = success ? "#3ba55d" : "#ed4245";
  const icon = success ? "&#10003;" : "&#33;";

  let body = "";
  if (success) {
    const fullCommand = `/auth code:${code}`;
    body = `
      <p class="sub">Authorization received. Copy the command below and paste it into Discord:</p>

      <label class="lbl" for="cmdField">Run this in Discord</label>
      <div class="row">
        <input id="cmdField" class="field" type="text" readonly value="${escapeHtml(fullCommand)}"
               onclick="this.select()" onfocus="this.select()" />
        <button id="cmdBtn" class="copy" type="button" data-target="cmdField">Copy</button>
      </div>

      <label class="lbl" for="rawField">Or copy just the code</label>
      <div class="row">
        <input id="rawField" class="field mono" type="text" readonly value="${escapeHtml(code)}"
               onclick="this.select()" onfocus="this.select()" />
        <button id="rawBtn" class="copy alt" type="button" data-target="rawField">Copy</button>
      </div>

      <p class="hint">Tap a field to select it, then copy. The code is one-time use and expires in ~10 minutes.</p>
      ${state ? `<p class='state'>State: <code>${escapeHtml(state)}</code></p>` : ""}
`;
  } else {
    body = `
      <p class="sub">${escapeHtml(errorBody)}</p>
      <p class="hint">Run <code>/get_token</code> in Discord again and click the new link.</p>
`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Memberty Auth</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0b0d12; color: #f2f3f5;
    display: flex; align-items: center; justify-content: center;
  }
  .card {
    width: 100%; max-width: 460px;
    background: #181a20; border: 1px solid #2a2d34; border-radius: 14px;
    padding: 28px 24px;
  }
  .icon {
    width: 48px; height: 48px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 14px; font-size: 24px; font-weight: 700; color: #0b0d12;
    background: ${accent};
  }
  h1 { margin: 0; text-align: center; font-size: 20px; font-weight: 600; }
  .sub { color: #b9bbbe; text-align: center; margin: 10px 0 22px; line-height: 1.5; font-size: 14px; }
  .lbl { display: block; font-size: 12px; color: #9aa0a6; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .4px; }
  .row { display: flex; gap: 8px; }
  .field {
    flex: 1; min-width: 0;
    background: #0b0d12; border: 1px solid #2a2d34; border-radius: 8px;
    color: #f2f3f5; padding: 10px 12px; font-size: 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .field:focus { outline: none; border-color: #5865f2; }
  .field.mono { color: #fbbf24; }
  .copy {
    flex: 0 0 auto; padding: 0 16px; border: 0; border-radius: 8px;
    background: #5865f2; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer;
  }
  .copy:hover { background: #4752c4; }
  .copy.alt { background: #4f545c; }
  .copy.alt:hover { background: #5d626b; }
  .copy.ok { background: #3ba55d !important; }
  .hint { color: #72767d; font-size: 12px; line-height: 1.5; margin: 18px 0 0; text-align: center; }
  .state { color: #4f545c; font-size: 11px; text-align: center; margin: 8px 0 0; }
  code { background: #0b0d12; padding: 2px 6px; border-radius: 4px; color: #b9bbbe; }
</style>
</head>
<body>
  <main class="card">
    <div class="icon">${icon}</div>
    <h1>${success ? "Authorization Successful" : escapeHtml(errorTitle)}</h1>
    ${body}
  </main>
<script>
  (function () {
    function copyFromField(field, btn) {
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
      var done = function () {
        var orig = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("ok");
        setTimeout(function () {
          btn.textContent = orig;
          btn.classList.remove("ok");
        }, 1400);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(field.value).then(done, function () { legacyCopy(field, done); });
      } else {
        legacyCopy(field, done);
      }
    }
    function legacyCopy(field, done) {
      try {
        var ok = document.execCommand("copy");
        if (ok) { done(); return; }
      } catch (e) {}
      field.focus();
      field.select();
    }
    document.querySelectorAll(".copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var field = document.getElementById(btn.dataset.target);
        if (field) copyFromField(field, btn);
      });
    });
  })();
</script>
</body>
</html>`;
}

function renderRedirectPage(guildId: string): string {
  const deepLink = `discord://discord.com/channels/${guildId}`;
  const webLink = `https://discord.com/channels/${guildId}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${deepLink}">
<title>Returning to Discord…</title>
<style>
  *,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}
  body{min-height:100vh;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#0b0d12;color:#f2f3f5;display:flex;align-items:center;justify-content:center}
  .card{width:100%;max-width:420px;background:#181a20;border:1px solid #2a2d34;border-radius:14px;padding:28px 24px;text-align:center}
  .icon{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:24px;font-weight:700;color:#0b0d12;background:#3ba55d}
  h1{margin:0;font-size:20px;font-weight:600}
  .sub{color:#b9bbbe;margin:10px 0 22px;line-height:1.5;font-size:14px}
  .btn{display:inline-block;background:#5865f2;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;margin:0 4px}
  .btn:hover{background:#4752c4}.btn.alt{background:#4f545c}.btn.alt:hover{background:#5d626b}
  .hint{color:#72767d;font-size:12px;margin:18px 0 0;line-height:1.5}
</style>
</head>
<body>
<main class="card">
  <div class="icon">&#10003;</div>
  <h1>Authorization Successful</h1>
  <p class="sub">Returning you to Discord&hellip;</p>
  <p>
    <a class="btn" href="${deepLink}">Open in App</a>
    <a class="btn alt" href="${webLink}">Open in Browser</a>
  </p>
  <p class="hint">If nothing happens, tap a button above.</p>
</main>
<script>setTimeout(function(){window.location.href=${JSON.stringify(deepLink)};},150);setTimeout(function(){window.location.href=${JSON.stringify(webLink)};},2200);</script>
</body>
</html>`;
}

async function handleOAuthLanding(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : null;
  const errorDesc =
    typeof req.query.error_description === "string"
      ? req.query.error_description
      : null;

  res.set("content-type", "text/html; charset=utf-8");

  if (error) {
    res.send(
      renderOAuthPage({
        success: false,
        errorTitle: "Authorization Cancelled",
        errorBody: errorDesc ?? error ?? "Discord did not return a code.",
      }),
    );
    return;
  }
  if (!code) {
    res.send(
      renderOAuthPage({
        success: false,
        errorTitle: "No Code in URL",
        errorBody: "Discord didn't include a code. Try the link again.",
      }),
    );
    return;
  }

  // If OAuth credentials aren't configured, fall back to the copy-code page so
  // an admin can still manually run /auth code:CODE in Discord.
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.send(renderOAuthPage({ success: true, code, state }));
    return;
  }

  const exchanged = await exchangeCode(code);
  if (!exchanged.ok) {
    console.error("[oauth] exchange failed:", exchanged.error);
    res.send(
      renderOAuthPage({
        success: false,
        errorTitle: "Token Exchange Failed",
        errorBody:
          "Discord rejected the authorization code. Run /get_token in Discord again and click the new link.",
      }),
    );
    return;
  }

  const { access_token, refresh_token } = exchanged.data;
  const userId = (await fetchOAuthUserId(access_token)) ?? state;
  if (!userId) {
    res.send(
      renderOAuthPage({
        success: false,
        errorTitle: "Couldn't Identify User",
        errorBody:
          "We exchanged the code but couldn't read your user ID from Discord.",
      }),
    );
    return;
  }

  try {
    saveUserAuth(userId, access_token, refresh_token);
  } catch (e) {
    console.error("[oauth] saveUserAuth failed:", e);
    res.send(
      renderOAuthPage({
        success: false,
        errorTitle: "Couldn't Save Token",
        errorBody: "An internal error occurred while saving your token.",
      }),
    );
    return;
  }

  console.log(`[oauth] saved token for user ${userId}`);
  res.send(renderRedirectPage(MAIN_GUILD_ID));
}

export function startServer(): void {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      bot: botStatus.connected ? "connected" : "disconnected",
      tag: botStatus.tag,
    });
  });

  app.get("/status", (_req, res) => {
    const upSec = Math.floor((Date.now() - botStatus.startedAt.getTime()) / 1000);
    const upStr = `${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m ${upSec % 60}s`;
    const row = (label: string, ok: boolean, detail = "") =>
      `<tr><td class="lbl">${label}</td><td class="${ok ? "ok" : "err"}">${ok ? "✓" : "✗"} ${ok ? "OK" : "MISSING"}${detail ? ` — ${detail}` : ""}</td></tr>`;
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Memberty Bot — Status</title>
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0b0d12;color:#f2f3f5;display:flex;align-items:flex-start;justify-content:center;min-height:100vh}
.card{width:100%;max-width:520px;background:#181a20;border:1px solid #2a2d34;border-radius:14px;padding:28px 24px;margin-top:40px}
h1{margin:0 0 4px;font-size:22px}
.sub{color:#9aa0a6;font-size:13px;margin:0 0 20px}
table{width:100%;border-collapse:collapse}
td{padding:9px 12px;border-bottom:1px solid #2a2d34;font-size:14px}
.lbl{color:#9aa0a6;width:180px}
.ok{color:#3ba55d;font-weight:600}
.err{color:#ed4245;font-weight:600}
.hint{margin-top:20px;font-size:12px;color:#72767d;line-height:1.6}
code{background:#0b0d12;padding:2px 6px;border-radius:4px;color:#b9bbbe}
</style>
</head><body><div class="card">
<h1>🤖 Memberty Bot</h1>
<p class="sub">Server uptime: ${upStr} &nbsp;|&nbsp; Started: ${botStatus.startedAt.toUTCString()}</p>
<table>
${row("Discord Bot", botStatus.connected, botStatus.tag ?? "")}
${row("BOT_TOKEN", botStatus.tokenConfigured)}
${row("CLIENT_ID", botStatus.clientIdConfigured)}
${row("CLIENT_SECRET", botStatus.clientSecretConfigured)}
</table>
${!botStatus.tokenConfigured ? `<p class="hint">⚠️ <strong>DISCORD_BOT_TOKEN is not set.</strong><br>Add it in your Railway project → <em>Variables</em> tab. The Express server is running (that's why Railway shows "online") but the bot can't connect to Discord without the token.</p>` : ""}
${botStatus.tokenConfigured && !botStatus.connected ? `<p class="hint">⚠️ Token is set but bot is not connected. The token may be wrong or revoked. Go to <strong>Discord Developer Portal → Bot → Reset Token</strong> and update the <code>DISCORD_BOT_TOKEN</code> variable in Railway.</p>` : ""}
${botStatus.connected ? `<p class="hint">✅ Everything looks good. Bot is online as <strong>${botStatus.tag}</strong>.</p>` : ""}
</div></body></html>`;
    res.set("content-type", "text/html; charset=utf-8").send(html);
  });

  app.get("/", (_req, res) => {
    res.set("content-type", "text/html; charset=utf-8").send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Memberty Bot</title>
<style>body{font-family:system-ui;background:#0b0d12;color:#f2f3f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}main{max-width:480px;text-align:center}h1{margin:0 0 8px;font-size:24px}p{color:#b9bbbe;line-height:1.5}code{background:#181a20;padding:2px 6px;border-radius:4px}</style>
</head><body><main>
<h1>🤖 Memberty Bot</h1>
<p>Discord bot is running. Use slash commands like <code>/help</code>, <code>/get_token</code>, <code>/restock</code> in Discord.</p>
<p style="font-size:12px;margin-top:24px">OAuth callback: <code>/auth/callback</code></p>
</main></body></html>`,
    );
  });

  app.get("/auth/callback", handleOAuthLanding);
  app.get("/redirect", handleOAuthLanding);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  });
}
