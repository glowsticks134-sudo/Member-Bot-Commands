import express, { type Request, type Response } from "express";
import { PORT } from "./config.js";

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

function handleOAuthLanding(req: Request, res: Response): void {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : null;
  const errorDesc =
    typeof req.query.error_description === "string"
      ? req.query.error_description
      : null;

  if (error) {
    res.set("content-type", "text/html; charset=utf-8").send(
      renderOAuthPage({
        success: false,
        errorTitle: "Authorization Cancelled",
        errorBody: errorDesc ?? error ?? "Discord did not return a code.",
      }),
    );
    return;
  }
  if (!code) {
    res.set("content-type", "text/html; charset=utf-8").send(
      renderOAuthPage({
        success: false,
        errorTitle: "No Code in URL",
        errorBody: "Discord didn't include a code. Try the link again.",
      }),
    );
    return;
  }
  res
    .set("content-type", "text/html; charset=utf-8")
    .send(renderOAuthPage({ success: true, code, state }));
}

export function startServer(): void {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
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
