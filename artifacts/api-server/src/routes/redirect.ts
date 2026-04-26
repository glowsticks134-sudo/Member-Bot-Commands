import { Router, type IRouter } from "express";
import { CLIENT_ID, CLIENT_SECRET, getRedirectUri, saveUserAuth } from "../bot/index";

const router: IRouter = Router();

router.get("/redirect", async (req, res) => {
  const code = req.query["code"] as string | undefined;
  const error = req.query["error"] as string | undefined;
  const userId = req.query["state"] as string | undefined;

  // Use the same redirect_uri that the auth-link generator used, so Discord
  // sees an identical value during the token exchange (it must match exactly).
  const redirectUri = getRedirectUri();

  if (error) {
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
    <p>You denied access or an error occurred: <strong>${error}</strong></p>
    <p style="margin-top:12px;">Close this tab and try <code>/get_token</code> again.</p>
  </div>
</body>
</html>`);
    return;
  }

  if (!code || !userId) {
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

  try {
    const tokenData = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenData.toString(),
    });

    if (!tokenRes.ok) {
      const err = (await tokenRes.json()) as { error_description?: string };
      const msg = err.error_description ?? "Unknown error from Discord";
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
    <p>${msg}</p>
    <p style="margin-top:12px;">Close this tab and try <code>/get_token</code> again.</p>
  </div>
</body>
</html>`);
      return;
    }

    const info = (await tokenRes.json()) as { access_token: string; refresh_token: string };
    saveUserAuth(userId, info.access_token, info.refresh_token);

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorized!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #16213e; border: 1px solid #57f287; border-radius: 16px; padding: 40px; max-width: 480px; width: 90%; text-align: center; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #57f287; font-size: 24px; margin-bottom: 12px; }
    p { color: #b0b0c0; font-size: 15px; line-height: 1.6; }
    .tag { display: inline-block; background: #0f3460; border: 1px solid #57f287; border-radius: 8px; padding: 6px 16px; font-family: 'Courier New', monospace; color: #57f287; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>You're authorized!</h1>
    <p>Your account has been successfully linked. You can close this tab and return to Discord.</p>
    <div class="tag">Discord ID: ${userId}</div>
  </div>
</body>
</html>`);
  } catch {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error</title>
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
    <h1>Something went wrong</h1>
    <p>A network error occurred while contacting Discord. Please close this tab and try <code>/get_token</code> again.</p>
  </div>
</body>
</html>`);
  }
});

export default router;
