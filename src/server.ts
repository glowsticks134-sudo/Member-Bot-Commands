import express, { type Request, type Response } from "express";
import { PORT, CLIENT_ID, getRedirectUri } from "./config.js";
import { botStatus } from "./botStatus.js";
import { getLandingHtml } from "./landing.js";
import { exchangeCode } from "./oauth.js";
import { saveUserAuth, appendAuthUser, readAuthUsers } from "./storage/tokens.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderVerifySuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verified — Memberk</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0b0d12; color: #f2f3f5;
    display: flex; align-items: center; justify-content: center;
  }
  .card {
    width: 100%; max-width: 420px; margin: 24px;
    background: #181a20; border: 1px solid #2a2d34; border-radius: 18px;
    padding: 40px 32px; text-align: center;
  }
  .ring {
    width: 80px; height: 80px; border-radius: 50%;
    background: rgba(245,158,11,0.12); border: 2px solid #f59e0b;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
    animation: pop .4s cubic-bezier(.34,1.56,.64,1) both;
  }
  @keyframes pop {
    from { transform: scale(.5); opacity: 0; }
    to   { transform: scale(1);  opacity: 1; }
  }
  .check {
    width: 36px; height: 36px; stroke: #f59e0b;
    stroke-width: 3; fill: none; stroke-linecap: round; stroke-linejoin: round;
    animation: draw .5s ease .3s both;
    stroke-dasharray: 60;
    stroke-dashoffset: 60;
  }
  @keyframes draw {
    to { stroke-dashoffset: 0; }
  }
  .brand {
    font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    color: #f59e0b; margin-bottom: 12px;
  }
  h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 10px; }
  .sub {
    font-size: 14px; color: #9aa0a6; line-height: 1.6; margin-bottom: 28px;
  }
  .divider { border: none; border-top: 1px solid #2a2d34; margin-bottom: 24px; }
  .step {
    display: flex; align-items: flex-start; gap: 12px;
    text-align: left; margin-bottom: 14px;
  }
  .step-dot {
    flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
    background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4);
    color: #f59e0b; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; margin-top: 1px;
  }
  .step-text { font-size: 13px; color: #b9bbbe; line-height: 1.5; }
  .step-text strong { color: #e3e5e8; font-weight: 600; }
  .close-hint {
    margin-top: 24px; font-size: 12px; color: #4f545c;
  }
  .close-hint span { color: #f59e0b; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <div class="ring">
      <svg class="check" viewBox="0 0 24 24">
        <polyline points="4 12 9 17 20 6"/>
      </svg>
    </div>
    <div class="brand">Memberk</div>
    <h1>You're Verified!</h1>
    <p class="sub">Your Discord account has been linked successfully.<br>You'll receive a DM from the bot confirming it.</p>
    <hr class="divider">
    <div class="step">
      <div class="step-dot">1</div>
      <div class="step-text"><strong>Token saved</strong> — your auth token is stored and ready to use.</div>
    </div>
    <div class="step">
      <div class="step-dot">2</div>
      <div class="step-text"><strong>Check Discord</strong> — a confirmation DM has been sent to you.</div>
    </div>
    <div class="step">
      <div class="step-dot">3</div>
      <div class="step-text"><strong>You're done</strong> — you can now be joined to servers via <code style="background:#0b0d12;padding:2px 5px;border-radius:4px;color:#f59e0b;font-size:12px">/djoin</code>.</div>
    </div>
    <p class="close-hint">This tab will close in <span id="t">5</span>s — or close it now.</p>
  </div>
<script>
  var s = 5;
  var el = document.getElementById("t");
  var iv = setInterval(function() {
    s--;
    if (el) el.textContent = String(s);
    if (s <= 0) { clearInterval(iv); window.close(); }
  }, 1000);
</script>
</body>
</html>`;
}

function renderVerifyErrorPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Memberk</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0b0d12; color: #f2f3f5;
    display: flex; align-items: center; justify-content: center;
  }
  .card {
    width: 100%; max-width: 420px; margin: 24px;
    background: #181a20; border: 1px solid #2a2d34; border-radius: 18px;
    padding: 40px 32px; text-align: center;
  }
  .ring {
    width: 80px; height: 80px; border-radius: 50%;
    background: rgba(237,66,69,0.1); border: 2px solid #ed4245;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
    animation: pop .4s cubic-bezier(.34,1.56,.64,1) both;
  }
  @keyframes pop { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .x { font-size: 32px; line-height: 1; color: #ed4245; font-weight: 700; }
  .brand { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #f59e0b; margin-bottom: 12px; }
  h1 { font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 10px; }
  .sub { font-size: 14px; color: #9aa0a6; line-height: 1.6; }
  .hint { margin-top: 24px; font-size: 13px; color: #72767d; }
  code { background: #0b0d12; padding: 2px 6px; border-radius: 4px; color: #f59e0b; font-size: 12px; }
</style>
</head>
<body>
  <div class="card">
    <div class="ring"><div class="x">✕</div></div>
    <div class="brand">Memberk</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${body}</p>
    <p class="hint">Use the <strong>Verify</strong> button in your server's verification channel to get a fresh link.</p>
  </div>
</body>
</html>`;
}


async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  res.set("content-type", "text/html; charset=utf-8");

  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : null;
  const errorDesc =
    typeof req.query.error_description === "string"
      ? req.query.error_description
      : null;

  if (error) {
    res.send(renderVerifyErrorPage(
      "Authorization Cancelled",
      escapeHtml(errorDesc ?? error),
    ));
    return;
  }

  if (!code) {
    res.send(renderVerifyErrorPage(
      "No Code in URL",
      "Discord didn't send a code. Try the link again.",
    ));
    return;
  }

  console.log(`[oauth] callback received code for state=${state}`);

  // Exchange the code for tokens RIGHT HERE on the server — no /auth step needed
  const tokenRes = await exchangeCode(code);
  if (!tokenRes.ok) {
    console.error(`[oauth] token exchange failed: ${tokenRes.error}`);
    res.send(renderVerifyErrorPage(
      "Authorization Failed",
      `Could not link your account. <code style="background:#0b0d12;padding:2px 5px;border-radius:4px;color:#f59e0b;font-size:12px">${escapeHtml(tokenRes.error.slice(0, 120))}</code>`,
    ));
    return;
  }

  const { access_token, refresh_token } = tokenRes.data;

  // Determine the userId — use state (Discord userId) if provided, else fetch from API
  let userId = state || "";
  if (!userId) {
    try {
      const meRes = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json() as { id: string };
        userId = me.id;
      }
    } catch {
      // best-effort
    }
  }

  // Save to personal stored tokens AND add to bulk stock so the member
  // can immediately use /djoin without an owner needing to /restock first.
  if (userId) {
    saveUserAuth(userId, access_token, refresh_token);
    const existingStock = readAuthUsers();
    if (!existingStock.some((u) => u.userId === userId)) {
      appendAuthUser({ userId, accessToken: access_token, refreshToken: refresh_token });
    }
    console.log(`[oauth] tokens saved to stored + stock for userId=${userId}`);

    // Fire-and-forget log to the main guild's bot log channel
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (botToken) {
      (async () => {
        try {
          const { getBotLogChannel } = await import("./storage/botLog.js");
          const { MAIN_GUILD_ID } = await import("./config.js");
          const logChannelId = getBotLogChannel(MAIN_GUILD_ID);
          if (logChannelId) {
            const embed = {
              title: "🔑 New Member Authenticated",
              color: 0x57f287,
              fields: [
                { name: "👤 User", value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: "📦 Stock", value: "Token added to stock automatically", inline: true },
              ],
              timestamp: new Date().toISOString(),
            };
            await fetch(`https://discord.com/api/v10/channels/${logChannelId}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ embeds: [embed] }),
            });
          }
        } catch {
          // silently ignore — log channel may be missing
        }
      })();
    }
  } else {
    console.warn("[oauth] no userId in state — tokens saved without userId key");
  }

  // DM the user to confirm via Discord REST API
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (botToken && userId) {
    (async () => {
      try {
        const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ recipient_id: userId }),
        });
        if (dmRes.ok) {
          const dm = await dmRes.json() as { id: string };
          await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
            method: "POST",
            headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `✅ **You've been successfully authenticated!**\n\nYour token has been saved automatically — no extra steps needed.\nYou can now be joined to servers using \`/djoin\`.`,
            }),
          });
          console.log(`[oauth] DM sent to userId=${userId}`);
        }
      } catch (e) {
        console.error("[oauth] DM failed:", e);
      }
    })();
  }

  res.send(renderVerifySuccessPage());
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
<title>Memberk Bot — Status</title>
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
<h1>🤖 Memberk Bot</h1>
<p class="sub">Server uptime: ${upStr} &nbsp;|&nbsp; Started: ${botStatus.startedAt.toUTCString()}</p>
<table>
${row("Discord Bot", botStatus.connected, botStatus.tag ?? "")}
${row("BOT_TOKEN", botStatus.tokenConfigured)}
${row("CLIENT_ID", botStatus.clientIdConfigured)}
${row("CLIENT_SECRET", botStatus.clientSecretConfigured)}
</table>
${!botStatus.tokenConfigured ? `<p class="hint">⚠️ <strong>DISCORD_BOT_TOKEN is not set.</strong><br>Add it in your Railway project → <em>Variables</em> tab.</p>` : ""}
${botStatus.tokenConfigured && !botStatus.connected ? `<p class="hint">⚠️ Token is set but bot is not connected. It may be wrong or revoked.</p>` : ""}
${botStatus.connected ? `<p class="hint">✅ Everything looks good. Bot is online as <strong>${botStatus.tag}</strong>.</p>` : ""}
</div></body></html>`;
    res.set("content-type", "text/html; charset=utf-8").send(html);
  });

  app.get("/", (_req, res) => {
    res.set("content-type", "text/html; charset=utf-8").send(getLandingHtml());
  });

  app.get("/verify", (_req, res) => {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: getRedirectUri(),
      scope: "identify guilds.join",
      prompt: "consent",
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get("/auth/callback", handleOAuthCallback);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[server] port ${PORT} in use — retrying in 2s…`);
      setTimeout(() => server.listen(PORT, "0.0.0.0"), 2000);
    } else {
      console.error("[server] failed to start:", err);
      process.exit(1);
    }
  });
}
