import express, { type Request, type Response } from "express";
import { PORT, getRedirectUri } from "./config.js";
import { botStatus } from "./botStatus.js";
import { getLandingHtml } from "./landing.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPage(opts: {
  success: boolean;
  title: string;
  body: string;
}): string {
  const { success, title, body } = opts;
  const accent = success ? "#3ba55d" : "#ed4245";
  const icon = success ? "&#10003;" : "&#33;";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
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
    padding: 28px 24px; text-align: center;
  }
  .icon {
    width: 48px; height: 48px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 14px; font-size: 24px; font-weight: 700; color: #0b0d12;
    background: ${accent};
  }
  h1 { margin: 0 0 12px; font-size: 20px; font-weight: 600; }
  p { color: #b9bbbe; font-size: 14px; line-height: 1.6; margin: 0 0 10px; }
  code { background: #0b0d12; padding: 2px 6px; border-radius: 4px; color: #b9bbbe; }
  .hint { color: #72767d; font-size: 12px; line-height: 1.5; margin-top: 18px; }
  .field-wrap { text-align: left; margin-top: 16px; }
  .lbl { display: block; font-size: 12px; color: #9aa0a6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .4px; }
  .row { display: flex; gap: 8px; }
  .field {
    flex: 1; min-width: 0;
    background: #0b0d12; border: 1px solid #2a2d34; border-radius: 8px;
    color: #fbbf24; padding: 10px 12px; font-size: 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .field:focus { outline: none; border-color: #5865f2; }
  .copy {
    flex: 0 0 auto; padding: 0 16px; border: 0; border-radius: 8px;
    background: #5865f2; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer;
  }
  .copy:hover { background: #4752c4; }
  .copy.ok { background: #3ba55d !important; }
</style>
</head>
<body>
  <main class="card">
    <div class="icon">${icon}</div>
    <h1>${escapeHtml(title)}</h1>
    ${body}
  </main>
<script>
  (function () {
    document.querySelectorAll(".copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var field = document.getElementById(btn.dataset.target);
        if (!field) return;
        field.select();
        field.setSelectionRange(0, 99999);
        var done = function () {
          var orig = btn.textContent;
          btn.textContent = "Copied!";
          btn.classList.add("ok");
          setTimeout(function () { btn.textContent = orig; btn.classList.remove("ok"); }, 1400);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(field.value).then(done, function () { try { document.execCommand("copy"); done(); } catch(e){} });
        } else {
          try { document.execCommand("copy"); done(); } catch(e) {}
        }
      });
    });
  })();
</script>
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
    res.send(
      renderPage({
        success: false,
        title: "Authorization Cancelled",
        body: `<p>${escapeHtml(errorDesc ?? error)}</p><p class="hint">Run <code>/get_token</code> in Discord again and click the new link.</p>`,
      }),
    );
    return;
  }

  if (!code) {
    res.send(
      renderPage({
        success: false,
        title: "No Code in URL",
        body: `<p>Discord didn't include a code. Try the link again.</p><p class="hint">Run <code>/get_token</code> in Discord to get a new link.</p>`,
      }),
    );
    return;
  }

  // Show the code to the user — they complete auth by running /auth code:CODE in Discord
  console.log(`[oauth] callback received code for state=${state}`);

  // Also DM the user their code via Discord REST API (state = userId)
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (botToken && state) {
    (async () => {
      try {
        const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
          method: "POST",
          headers: { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ recipient_id: state }),
        });
        if (dmRes.ok) {
          const dm = await dmRes.json() as { id: string };
          await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
            method: "POST",
            headers: { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `🔐 **Your authorization code is ready!**\n\n` +
                `\`\`\`\n${code}\n\`\`\`\n` +
                `Run this command in the auth channel:\n` +
                `\`/auth code:${code}\`\n\n` +
                `⏱️ Code expires in **10 minutes** — run the command now!`,
            }),
          });
          console.log(`[oauth] DM sent to userId=${state}`);
        }
      } catch (e) {
        console.error("[oauth] DM failed:", e);
      }
    })();
  }

  res.send(
    renderPage({
      success: true,
      title: "Step 2 of 2 — Copy Your Code",
      body: `
        <p style="font-size:15px;font-weight:600;color:#fff;margin-bottom:18px;">
          ✅ Discord authorized. Now copy the code below and paste it in Discord.
        </p>
        <div style="background:#0b0d12;border:2px solid #5865f2;border-radius:10px;padding:16px;margin-bottom:16px;text-align:left;">
          <div style="font-size:11px;color:#8ea1e1;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-weight:700;">📋 Your Code (tap to copy)</div>
          <div class="row">
            <input class="field" id="code-field" value="${escapeHtml(code)}" readonly style="font-size:13px;color:#fbbf24;background:#000;border-color:#5865f2;">
            <button class="copy" data-target="code-field" style="background:#5865f2;min-width:72px;">Copy</button>
          </div>
        </div>
        <p style="background:#1a1c26;border-radius:8px;padding:12px;font-size:13px;color:#d4d7dc;text-align:left;margin-bottom:10px;">
          👉 Go back to Discord and run:<br>
          <code style="color:#fbbf24;font-size:14px;font-weight:700;">/auth code:PASTE-YOUR-CODE-HERE</code><br>
          in the authentication channel.
        </p>
        <p class="hint" style="color:#ed4245;font-weight:600;">⏱️ Code expires in 10 minutes — don't close this tab until you've run the command!</p>`,
    }),
  );
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
${!botStatus.tokenConfigured ? `<p class="hint">⚠️ <strong>DISCORD_BOT_TOKEN is not set.</strong><br>Add it in your Railway project → <em>Variables</em> tab.</p>` : ""}
${botStatus.tokenConfigured && !botStatus.connected ? `<p class="hint">⚠️ Token is set but bot is not connected. It may be wrong or revoked.</p>` : ""}
${botStatus.connected ? `<p class="hint">✅ Everything looks good. Bot is online as <strong>${botStatus.tag}</strong>.</p>` : ""}
</div></body></html>`;
    res.set("content-type", "text/html; charset=utf-8").send(html);
  });

  app.get("/", (_req, res) => {
    res.set("content-type", "text/html; charset=utf-8").send(getLandingHtml());
  });

  app.get("/auth/callback", handleOAuthCallback);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
}
