import { Router, type IRouter, type Request, type Response } from "express";
import { doAuthExchange } from "../bot/index";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pageShell(opts: {
  borderColor: string;
  icon: string;
  titleColor: string;
  title: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #16213e; border: 1px solid ${opts.borderColor}; border-radius: 16px; padding: 40px; max-width: 560px; width: 100%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: ${opts.titleColor}; font-size: 24px; margin-bottom: 12px; }
    p { color: #b0b0c0; font-size: 15px; line-height: 1.6; }
    .code-box { display: flex; align-items: center; gap: 8px; background: #0f3460; border: 1px solid #5865f2; border-radius: 10px; padding: 14px 18px; margin-top: 20px; }
    .code { flex: 1; font-family: 'Courier New', monospace; color: #57f287; font-size: 14px; word-break: break-all; text-align: left; user-select: all; }
    button { background: #5865f2; color: white; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
    button:hover { background: #4752c4; }
    button.copied { background: #57f287; color: #0f3460; }
    .note { color: #b0b0c0; background: #0f3460; border-radius: 10px; padding: 14px 18px; margin-top: 20px; font-size: 14px; line-height: 1.7; text-align: left; }
    .note strong { color: #fff; }
    .warn { color: #faa61a; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${opts.icon}</div>
    <h1>${opts.title}</h1>
    ${opts.body}
  </div>
</body>
</html>`;
}

router.get("/redirect", async (req: Request, res: Response) => {
  const code = req.query["code"] as string | undefined;
  const error = req.query["error"] as string | undefined;
  const state = req.query["state"] as string | undefined;

  if (error) {
    const safeError = escapeHtml(error);
    res.send(
      pageShell({
        borderColor: "#ed4245",
        icon: "❌",
        titleColor: "#ed4245",
        title: "Authorization Failed",
        body: `<p>You denied access or an error occurred: <strong>${safeError}</strong></p>
               <p style="margin-top:12px;">Close this tab and try <code>/get_token</code> again.</p>`,
      }),
    );
    return;
  }

  if (!code) {
    res.send(
      pageShell({
        borderColor: "#faa61a",
        icon: "⚠️",
        titleColor: "#faa61a",
        title: "Invalid Request",
        body: `<p>This page only works when Discord redirects here after authorization.</p>
               <p style="margin-top:12px;">Use <code>/get_token</code> in Discord to get a proper link.</p>`,
      }),
    );
    return;
  }

  const safeCode = escapeHtml(code);

  // If we have a `state` (set to the requesting user's Discord ID by
  // /get_token), perform the OAuth exchange server-side, save the token to
  // the stored-tokens file, and DM the user. This means users no longer have
  // to copy/paste a code back into Discord.
  if (state && /^\d{5,25}$/.test(state)) {
    const result = await doAuthExchange(code, state);
    if (result.ok) {
      logger.info({ userId: state }, "User authorized via auto-redirect");
      res.send(
        pageShell({
          borderColor: "#57f287",
          icon: "✅",
          titleColor: "#57f287",
          title: "You're authorized!",
          body: `<p>Your account has been authorized and added to the bot's <strong>stored tokens</strong>.</p>
                 <p style="margin-top:12px;">Check your Discord DMs — the bot just sent you a confirmation message.</p>
                 <div class="note">
                   <div><strong>Authorization code (for reference):</strong></div>
                   <div class="code-box" style="margin-top:10px;">
                     <span class="code" id="code">${safeCode}</span>
                     <button id="copy-btn" onclick="copyCode()">Copy</button>
                   </div>
                 </div>
                 <p class="warn">You can safely close this tab.</p>
                 <script>
                   function copyCode() {
                     const c = document.getElementById('code').innerText;
                     const b = document.getElementById('copy-btn');
                     navigator.clipboard.writeText(c).then(() => {
                       b.innerText = 'Copied!'; b.classList.add('copied');
                       setTimeout(() => { b.innerText = 'Copy'; b.classList.remove('copied'); }, 2000);
                     }).catch(() => {});
                   }
                 </script>`,
        }),
      );
      return;
    }
    // Fall through to the manual code page if exchange failed (so the user
    // can still try `/auth code:...` from Discord).
    logger.warn({ userId: state, error: result.error }, "Auto-redirect auth exchange failed, falling back to manual");
  }

  // Manual fallback (no state, or auto-exchange failed): show the code so the
  // user can paste it into the /auth slash command.
  res.send(
    pageShell({
      borderColor: "#5865f2",
      icon: "✅",
      titleColor: "#57f287",
      title: "You're authorized!",
      body: `<p>Copy the code below and paste it into Discord using the <code>/auth</code> command.</p>
             <div class="code-box">
               <span class="code" id="code">${safeCode}</span>
               <button id="copy-btn" onclick="copyCode()">Copy</button>
             </div>
             <div class="note">
               <div><strong>Next steps:</strong></div>
               <div>1. Click <strong>Copy</strong> above</div>
               <div>2. Go back to Discord</div>
               <div>3. Run <code>/auth code:</code> and paste the code, or use <code>!auth &lt;code&gt;</code></div>
             </div>
             <p class="warn">⚠️ This code expires in <strong>10 minutes</strong> — use it soon.</p>
             <script>
               function copyCode() {
                 const c = document.getElementById('code').innerText;
                 const b = document.getElementById('copy-btn');
                 navigator.clipboard.writeText(c).then(() => {
                   b.innerText = 'Copied!'; b.classList.add('copied');
                   setTimeout(() => { b.innerText = 'Copy'; b.classList.remove('copied'); }, 2000);
                 }).catch(() => {
                   const r = document.createRange();
                   r.selectNode(document.getElementById('code'));
                   window.getSelection().removeAllRanges();
                   window.getSelection().addRange(r);
                   document.execCommand('copy');
                   b.innerText = 'Copied!'; b.classList.add('copied');
                   setTimeout(() => { b.innerText = 'Copy'; b.classList.remove('copied'); }, 2000);
                 });
               }
             </script>`,
    }),
  );
});

export default router;
