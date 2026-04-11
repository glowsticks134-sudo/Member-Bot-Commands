import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/redirect", (req, res) => {
  const code = req.query["code"] as string | undefined;
  const error = req.query["error"] as string | undefined;

  if (error) {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorization Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #1a1a2e;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #16213e;
      border: 1px solid #ed4245;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 90%;
      text-align: center;
    }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #ed4245; font-size: 24px; margin-bottom: 12px; }
    p { color: #b0b0c0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Authorization Failed</h1>
    <p>You denied access or an error occurred: <strong>${error}</strong></p>
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
  <title>No Code Found</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #1a1a2e;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #16213e;
      border: 1px solid #faa61a;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 90%;
      text-align: center;
    }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #faa61a; font-size: 24px; margin-bottom: 12px; }
    p { color: #b0b0c0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>No Code Received</h1>
    <p>This page only works when Discord redirects here after authorization.</p>
    <p style="margin-top:12px;">Use <code>/get_token</code> in Discord to get a proper link.</p>
  </div>
</body>
</html>`);
    return;
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorization Code</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #1a1a2e;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #16213e;
      border: 1px solid #5865f2;
      border-radius: 16px;
      padding: 40px;
      max-width: 520px;
      width: 90%;
      text-align: center;
    }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #ffffff; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #b0b0c0; font-size: 15px; margin-bottom: 28px; }
    .code-box {
      background: #0f3460;
      border: 1px solid #5865f2;
      border-radius: 10px;
      padding: 14px 20px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #57d9ff;
      word-break: break-all;
      margin-bottom: 20px;
      cursor: pointer;
      transition: background 0.2s;
      user-select: all;
    }
    .code-box:hover { background: #1a4a7a; }
    .copy-btn {
      background: #5865f2;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 28px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-bottom: 24px;
    }
    .copy-btn:hover { background: #4752c4; }
    .copy-btn:active { transform: scale(0.97); }
    .copy-btn.copied { background: #57f287; color: #1a1a2e; }
    .steps {
      background: #0d1b35;
      border-radius: 10px;
      padding: 16px 20px;
      text-align: left;
    }
    .steps p {
      color: #b0b0c0;
      font-size: 14px;
      margin-bottom: 6px;
      line-height: 1.5;
    }
    .steps strong { color: #ffffff; }
    .steps code {
      background: #1a4a7a;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: 'Courier New', monospace;
      color: #57d9ff;
      font-size: 13px;
    }
    .warning {
      color: #faa61a;
      font-size: 13px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Authorization Successful!</h1>
    <p class="subtitle">Copy your code below and paste it into Discord.</p>

    <div class="code-box" id="code" onclick="copyCode()">${code}</div>

    <button class="copy-btn" id="copyBtn" onclick="copyCode()">📋 Copy Code</button>

    <div class="steps">
      <p><strong>Step 1:</strong> Copy the code above.</p>
      <p><strong>Step 2:</strong> Go back to Discord.</p>
      <p><strong>Step 3:</strong> Use the command <code>/auth code:PASTE_HERE</code></p>
      <p><strong>Step 4:</strong> Your account will be authenticated!</p>
    </div>

    <p class="warning">⚠️ Codes expire in 10 minutes — use it quickly!</p>
  </div>

  <script>
    function copyCode() {
      const code = document.getElementById('code').innerText;
      const btn = document.getElementById('copyBtn');
      function markCopied() {
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '📋 Copy Code';
          btn.classList.remove('copied');
        }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(markCopied).catch(() => {
          fallbackCopy(code);
          markCopied();
        });
      } else {
        fallbackCopy(code);
        markCopied();
      }
    }
    function fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
    }
  </script>
</body>
</html>`);
});

export default router;
