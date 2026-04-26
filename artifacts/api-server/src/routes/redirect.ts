import { Router, type IRouter } from "express";

const router: IRouter = Router();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

router.get("/redirect", (req, res) => {
  const code = req.query["code"] as string | undefined;
  const error = req.query["error"] as string | undefined;

  if (error) {
    const safeError = escapeHtml(error);
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorization Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #16213e; border: 1px solid #ed4245; border-radius: 16px; padding: 40px; max-width: 480px; width: 90%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #ed4245; font-size: 24px; margin-bottom: 12px; }
    p { color: #b0b0c0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Authorization Failed</h1>
    <p>You denied access or an error occurred: <strong>${safeError}</strong></p>
    <p style="margin-top:12px;">Close this tab and try <code>/get_token</code> again.</p>
  </div>
</body>
</html>`);
    return;
  }

  if (!code) {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invalid Request</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #16213e; border: 1px solid #faa61a; border-radius: 16px; padding: 40px; max-width: 480px; width: 90%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #faa61a; font-size: 24px; margin-bottom: 12px; }
    p { color: #b0b0c0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Invalid Request</h1>
    <p>This page only works when Discord redirects here after authorization.</p>
    <p style="margin-top:12px;">Use <code>/get_token</code> in Discord to get a proper link.</p>
  </div>
</body>
</html>`);
    return;
  }

  const safeCode = escapeHtml(code);
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Authorization Code</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #16213e; border: 1px solid #5865f2; border-radius: 16px; padding: 40px; max-width: 560px; width: 100%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #57f287; font-size: 24px; margin-bottom: 12px; }
    p { color: #b0b0c0; font-size: 15px; line-height: 1.6; }
    .code-box { display: flex; align-items: center; gap: 8px; background: #0f3460; border: 1px solid #5865f2; border-radius: 10px; padding: 14px 18px; margin-top: 20px; }
    .code { flex: 1; font-family: 'Courier New', monospace; color: #57f287; font-size: 14px; word-break: break-all; text-align: left; user-select: all; }
    button { background: #5865f2; color: white; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
    button:hover { background: #4752c4; }
    button.copied { background: #57f287; color: #0f3460; }
    .steps { background: #0f3460; border-radius: 10px; padding: 16px 20px; margin-top: 20px; text-align: left; color: #b0b0c0; font-size: 14px; line-height: 1.8; }
    .steps strong { color: #fff; }
    .warn { color: #faa61a; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>You're authorized!</h1>
    <p>Copy the code below and paste it into Discord using the <code>/auth</code> command.</p>
    <div class="code-box">
      <span class="code" id="code">${safeCode}</span>
      <button id="copy-btn" onclick="copyCode()">Copy</button>
    </div>
    <div class="steps">
      <div><strong>Next steps:</strong></div>
      <div>1. Click <strong>Copy</strong> above</div>
      <div>2. Go back to Discord</div>
      <div>3. Run <code>/auth code:</code> and paste the code, or use <code>!auth &lt;code&gt;</code></div>
    </div>
    <p class="warn">⚠️ This code expires in <strong>10 minutes</strong> — use it soon.</p>
  </div>
  <script>
    function copyCode() {
      const code = document.getElementById('code').innerText;
      const btn = document.getElementById('copy-btn');
      navigator.clipboard.writeText(code).then(() => {
        btn.innerText = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerText = 'Copy'; btn.classList.remove('copied'); }, 2000);
      }).catch(() => {
        const range = document.createRange();
        range.selectNode(document.getElementById('code'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        btn.innerText = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerText = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    }
  </script>
</body>
</html>`);
});

export default router;
