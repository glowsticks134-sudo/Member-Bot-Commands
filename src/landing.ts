export function getLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Memberty — Grow Your Discord Community</title>
<meta name="description" content="The most powerful private Discord bot for mass server joining, OAuth2 token management, auto-ping welcomes, and scheduled member restocks.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%235865F2'/><text x='16' y='22' text-anchor='middle' font-size='18' font-family='system-ui'>🤖</text></svg>">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --blurple:#5865F2;
  --blurple-dark:#4752C4;
  --blurple-glow:rgba(88,101,242,0.25);
  --bg:#0b0d12;
  --card:#12141c;
  --card2:#1a1c26;
  --border:rgba(255,255,255,0.07);
  --text:#f2f3f5;
  --muted:#9aa0a6;
  --dim:#5a6066;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
::selection{background:rgba(88,101,242,0.35)}

/* ── Navbar ── */
nav{position:fixed;top:0;width:100%;z-index:100;border-bottom:1px solid var(--border);background:rgba(11,13,18,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.nav-inner{max-width:1200px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.1rem;color:#fff}
.nav-logo-icon{width:32px;height:32px;border-radius:8px;background:var(--blurple);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-links{display:flex;align-items:center;gap:28px;font-size:.875rem;font-weight:500;color:var(--muted)}
.nav-links a:hover{color:#fff;transition:color .15s}
.nav-actions{display:flex;align-items:center;gap:12px}
.btn{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:.875rem;border-radius:8px;border:0;cursor:pointer;transition:all .15s;white-space:nowrap}
.btn-ghost{background:transparent;color:var(--muted);padding:8px 14px}
.btn-ghost:hover{background:rgba(255,255,255,0.08);color:#fff}
.btn-primary{background:var(--blurple);color:#fff;padding:9px 18px}
.btn-primary:hover{background:var(--blurple-dark)}
.btn-lg{font-size:1rem;padding:13px 28px;border-radius:10px}
.btn-xl{font-size:1.05rem;padding:15px 36px;border-radius:50px}
.btn-outline{background:transparent;color:#d4d7dc;padding:13px 28px;border:1px solid var(--border);border-radius:10px}
.btn-outline:hover{background:rgba(255,255,255,0.05);color:#fff}

/* ── Hero ── */
.hero{position:relative;padding:148px 24px 112px;text-align:center;overflow:hidden}
.hero-bg{position:absolute;inset:0;z-index:0;pointer-events:none}
.hero-bg-img{width:100%;height:100%;object-fit:cover;opacity:.18;mix-blend-mode:screen}
.hero-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,var(--bg) 0%,rgba(11,13,18,.7) 50%,transparent 100%)}
.hero-orb{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:700px;border-radius:50%;background:rgba(88,101,242,.16);filter:blur(140px);pointer-events:none;z-index:0}
.hero-inner{position:relative;z-index:1;max-width:860px;margin:0 auto}
.badge{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:50px;background:rgba(88,101,242,.1);border:1px solid rgba(88,101,242,.22);color:#8ea1e1;font-size:.8rem;font-weight:600;margin-bottom:28px}
.badge svg{width:13px;height:13px}
h1{font-size:clamp(2.6rem,6vw,4.5rem);font-weight:900;line-height:1.07;color:#fff;letter-spacing:-.03em;margin-bottom:22px}
h1 .gradient{background:linear-gradient(135deg,var(--blurple) 0%,#8ea1e1 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-sub{font-size:1.1rem;color:var(--muted);max-width:600px;margin:0 auto 36px;line-height:1.7}
.hero-ctas{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:60px}
.stats-row{display:flex;flex-wrap:wrap;gap:32px 48px;justify-content:center}
.stat{text-align:center}
.stat-value{font-size:1.5rem;font-weight:800;color:#fff}
.stat-label{font-size:.8rem;color:var(--dim);margin-top:2px}

/* ── Section shared ── */
section{padding:88px 24px}
.section-inner{max-width:1200px;margin:0 auto}
.section-tag{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.08em;padding:5px 12px;border-radius:50px;background:rgba(88,101,242,.12);border:1px solid rgba(88,101,242,.2);color:#8ea1e1;margin-bottom:16px}
.section-heading{font-size:clamp(1.8rem,3.5vw,2.6rem);font-weight:800;color:#fff;line-height:1.2;margin-bottom:14px}
.section-sub{color:var(--muted);max-width:520px;font-size:.975rem;line-height:1.7}
.text-center{text-align:center}
.text-center .section-sub{margin:0 auto}

/* ── Features ── */
.features-bg{background:rgba(255,255,255,.015);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:52px}
.feature-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px;transition:border-color .2s}
.feature-card:hover{border-color:rgba(88,101,242,.35)}
.feature-icon{width:40px;height:40px;border-radius:10px;background:rgba(88,101,242,.15);color:#8ea1e1;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.feature-icon svg{width:18px;height:18px}
.feature-title{font-weight:700;font-size:.95rem;color:#fff;margin-bottom:8px}
.feature-desc{font-size:.845rem;color:var(--dim);line-height:1.65}

/* ── Commands ── */
.commands-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;margin-top:0}
.cmd-list{list-style:none;margin-top:28px;display:flex;flex-direction:column;gap:10px}
.cmd-list li{display:flex;align-items:center;gap:10px;font-size:.88rem;color:#d4d7dc}
.cmd-list li svg{color:var(--blurple);flex-shrink:0;width:16px;height:16px}
.terminal{background:#0d0f14;border:1px solid var(--border);border-radius:16px;overflow:hidden}
.terminal-bar{background:var(--card);border-bottom:1px solid var(--border);padding:10px 16px;display:flex;align-items:center;gap:8px}
.terminal-dot{width:11px;height:11px;border-radius:50%}
.terminal-title{margin-left:10px;font-size:.78rem;color:var(--dim);display:flex;align-items:center;gap:5px}
.terminal-body{padding:20px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.83rem;display:flex;flex-direction:column;gap:13px}
.cmd-row{display:flex;gap:10px}
.cmd-slash{color:var(--blurple);flex-shrink:0;margin-top:1px}
.cmd-text{color:#fff}
.cmd-hint{color:var(--dim);font-size:.75rem;margin-top:2px}

/* ── How it works ── */
.hiw-bg{background:rgba(255,255,255,.015);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:52px;position:relative}
.steps::before{content:'';position:absolute;top:22px;left:calc(33.33% + 20px);width:calc(33.33% - 40px);height:1px;background:linear-gradient(90deg,var(--blurple),transparent);display:none}
.step-num{font-size:3.5rem;font-weight:900;line-height:1;color:rgba(88,101,242,.15);margin-bottom:12px;font-variant-numeric:tabular-nums}
.step-title{font-weight:700;font-size:1.1rem;color:#fff;margin-bottom:8px}
.step-desc{font-size:.88rem;color:var(--muted);line-height:1.7}
.discord-card{background:#1e1f22;border:1px solid var(--border);border-radius:16px;padding:24px;max-width:360px;margin:48px auto 0;box-shadow:0 24px 60px rgba(0,0,0,.4)}
.discord-card-header{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:16px}
.discord-avatar{width:42px;height:42px;border-radius:50%;background:var(--blurple);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.discord-avatar svg{width:22px;height:22px;color:#fff}
.discord-name{font-weight:700;color:#fff;font-size:.92rem}
.discord-verified{font-size:.73rem;color:var(--dim);display:flex;align-items:center;gap:5px;margin-top:2px}
.discord-dot{width:6px;height:6px;border-radius:50%;background:#23a559;display:inline-block}
.discord-body{font-size:.875rem;color:#d4d7dc;margin-bottom:14px}
.discord-perms{background:#2b2d31;border-radius:8px;padding:12px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px}
.discord-perm{display:flex;align-items:center;gap:8px;font-size:.845rem;color:#d4d7dc}
.discord-perm svg{color:#23a559;width:15px;height:15px;flex-shrink:0}
.discord-actions{display:flex;gap:10px}
.discord-auth{flex:1;background:var(--blurple);color:#fff;border:0;border-radius:6px;padding:9px;font-size:.875rem;font-weight:600;cursor:pointer}
.discord-cancel{background:transparent;color:var(--muted);border:0;padding:9px 14px;font-size:.875rem;cursor:pointer;border-radius:6px}
.discord-cancel:hover{background:rgba(255,255,255,.06);color:#fff}

/* ── Security ── */
.security-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.security-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.security-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px}
.security-card-icon{width:36px;height:36px;border-radius:8px;background:rgba(88,101,242,.15);color:#8ea1e1;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.security-card-icon svg{width:16px;height:16px}
.security-card-title{font-size:.875rem;font-weight:700;color:#fff;margin-bottom:6px}
.security-card-desc{font-size:.8rem;color:var(--dim);line-height:1.6}
.check-list{list-style:none;display:flex;flex-direction:column;gap:12px;margin-top:28px}
.check-list li{display:flex;align-items:center;gap:10px;font-size:.9rem;color:#d4d7dc}
.check-list li svg{color:var(--blurple);flex-shrink:0;width:16px;height:16px}

/* ── Testimonials ── */
.testimonials-bg{background:rgba(255,255,255,.015);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stars{display:flex;gap:4px;justify-content:center;margin-bottom:12px}
.stars svg{width:16px;height:16px;fill:#facc15;color:#facc15}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:48px}
.testi-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px}
.testi-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}
.testi-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0}
.testi-user{font-size:.875rem;font-weight:600;color:#fff}
.testi-time{font-size:.72rem;color:var(--dim);margin-top:2px}
.testi-text{font-size:.875rem;color:#d4d7dc;line-height:1.65}

/* ── CTA ── */
.cta-section{position:relative;overflow:hidden;text-align:center}
.cta-bg{position:absolute;inset:0;background:rgba(88,101,242,.04);pointer-events:none}
.cta-line-top{position:absolute;top:0;left:50%;transform:translateX(-50%);height:1px;width:min(900px,100%);background:linear-gradient(90deg,transparent,rgba(88,101,242,.5),transparent)}
.cta-line-bottom{position:absolute;bottom:0;left:50%;transform:translateX(-50%);height:1px;width:min(900px,100%);background:linear-gradient(90deg,transparent,rgba(88,101,242,.3),transparent)}
.cta-orb{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:280px;border-radius:50%;background:rgba(88,101,242,.1);filter:blur(110px);pointer-events:none}
.cta-inner{position:relative;z-index:1;max-width:680px;margin:0 auto}
.cta-heading{font-size:clamp(2rem,4.5vw,3.2rem);font-weight:900;color:#fff;line-height:1.1;margin-bottom:20px;letter-spacing:-.03em}
.cta-sub{font-size:1.05rem;color:var(--muted);margin-bottom:36px;line-height:1.7}
.btn-cta{background:var(--blurple);color:#fff;font-size:1.05rem;font-weight:700;padding:16px 40px;border-radius:50px;border:0;cursor:pointer;box-shadow:0 0 40px -8px rgba(88,101,242,.7);transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.btn-cta:hover{background:var(--blurple-dark);box-shadow:0 0 50px -6px rgba(88,101,242,.8)}
.cta-note{font-size:.8rem;color:var(--dim);margin-top:16px}

/* ── Footer ── */
footer{border-top:1px solid var(--border);padding:56px 24px 40px}
.footer-inner{max-width:1200px;margin:0 auto}
.footer-top{display:grid;grid-template-columns:1fr auto;gap:48px;align-items:start;margin-bottom:48px}
.footer-brand-desc{font-size:.875rem;color:var(--dim);max-width:280px;line-height:1.7;margin-top:12px}
.footer-links{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.footer-col-title{font-size:.82rem;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}
.footer-col ul{list-style:none;display:flex;flex-direction:column;gap:10px}
.footer-col ul li a{font-size:.875rem;color:var(--dim)}
.footer-col ul li a:hover{color:#d4d7dc;transition:color .15s}
.footer-bottom{padding-top:28px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:.82rem;color:var(--dim)}

/* ── SVG Icons ── */
.icon{display:inline-block;vertical-align:middle}

/* ── Responsive ── */
@media(max-width:900px){
  .nav-links{display:none}
  .commands-grid,.security-grid{grid-template-columns:1fr}
  .testimonials-grid{grid-template-columns:1fr}
  .steps{grid-template-columns:1fr}
  .footer-top{grid-template-columns:1fr}
  .footer-links{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:600px){
  .features-grid{grid-template-columns:1fr 1fr}
  .security-cards{grid-template-columns:1fr}
  .footer-links{grid-template-columns:1fr}
}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════ NAVBAR -->
<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
      </div>
      Memberty
    </a>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#commands">Commands</a>
      <a href="#how-it-works">How it works</a>
      <a href="#security">Security</a>
    </div>
    <div class="nav-actions">
      <a href="/status" class="btn btn-ghost">Status</a>
      <a href="#cta" class="btn btn-primary">Request Access</a>
    </div>
  </div>
</nav>

<!-- ═══════════════════════════════════════════════════════ HERO -->
<section class="hero">
  <div class="hero-bg">
    <div class="hero-orb"></div>
  </div>
  <div class="hero-inner">
    <div class="badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      Private &mdash; approved servers only
    </div>
    <h1>Grow your Discord<br>community <span class="gradient">effortlessly.</span></h1>
    <p class="hero-sub">The most powerful private Discord bot for mass server joining, OAuth2 token management, automated welcome pings, and scheduled member restocks.</p>
    <div class="hero-ctas">
      <a href="#cta" class="btn btn-primary btn-lg">Request Access <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></a>
      <a href="#commands" class="btn btn-outline">View Commands</a>
    </div>
    <div class="stats-row">
      <div class="stat"><div class="stat-value">250K+</div><div class="stat-label">Members joined</div></div>
      <div class="stat"><div class="stat-value">1,800+</div><div class="stat-label">Tokens managed</div></div>
      <div class="stat"><div class="stat-value">99.9%</div><div class="stat-label">Uptime</div></div>
      <div class="stat"><div class="stat-value">&lt;2s</div><div class="stat-label">Avg join time</div></div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════ FEATURES -->
<section id="features" class="features-bg">
  <div class="section-inner">
    <div class="text-center">
      <div class="section-tag">FEATURES</div>
      <h2 class="section-heading">Everything you need to scale</h2>
      <p class="section-sub">Built exclusively for approved server owners. Memberty handles the heavy lifting so you can focus on your community.</p>
    </div>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="feature-title">Mass Server Joining</div>
        <div class="feature-desc">Instantly pull thousands of authorized members into any server with built-in rate-limit handling.</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <div class="feature-title">OAuth2 Token Management</div>
        <div class="feature-desc">Securely collect, store, and refresh Discord OAuth2 tokens. Bulk-load via file upload or slash commands.</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
        <div class="feature-title">Auto-Ping Welcome</div>
        <div class="feature-desc">Greet every new member the moment they join with a customisable ping, role mention, and member count.</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="feature-title">Scheduled Restocks</div>
        <div class="feature-desc">Set daily or custom restock schedules and Memberty keeps pulling members automatically — no manual work.</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div class="feature-title">Server Allowlisting</div>
        <div class="feature-desc">Full control over which servers can use the bot. Super-owner commands to enable, disable, and list guilds.</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></div>
        <div class="feature-title">Token Auto-Refresh</div>
        <div class="feature-desc">Tokens refresh before expiry in the background. Your member pool stays active without any manual effort.</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <div class="feature-title">Blacklist System</div>
        <div class="feature-desc">Block specific users from being joined or from using commands. Super-owner blacklist management with full tracking.</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div>
        <div class="feature-title">Multi-Server Support</div>
        <div class="feature-desc">Manage multiple Discord servers from one bot. Per-server role limits, locks, and configurations all in one place.</div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════ COMMANDS -->
<section id="commands">
  <div class="section-inner">
    <div class="commands-grid">
      <div>
        <div class="section-tag">SLASH COMMANDS</div>
        <h2 class="section-heading">Powerful commands,<br>simple interface.</h2>
        <p class="section-sub">Every action is a clean Discord slash command — no dashboards to learn. Run everything right inside your server.</p>
        <ul class="cmd-list">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Instant autocomplete in Discord</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Permission-gated commands per role</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Ephemeral replies for privacy</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Prefix fallback (!command) supported</li>
        </ul>
      </div>
      <div class="terminal">
        <div class="terminal-bar">
          <div class="terminal-dot" style="background:#ff5f56"></div>
          <div class="terminal-dot" style="background:#ffbd2e"></div>
          <div class="terminal-dot" style="background:#27c93f"></div>
          <div class="terminal-title">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            general
          </div>
        </div>
        <div class="terminal-body">
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">get_token</div><div class="cmd-hint">Generate an OAuth2 auth link for the user</div></div></div>
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">djoin <span style="color:#8ea1e1">server_id:</span><span style="color:#fbbf24">ID</span></div><div class="cmd-hint">Mass-join all stored users into a server</div></div></div>
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">restock <span style="color:#8ea1e1">tokens:</span><span style="color:#fbbf24">…</span></div><div class="cmd-hint">Add tokens and join users immediately</div></div></div>
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">autoping_set <span style="color:#8ea1e1">channel:</span><span style="color:#fbbf24">#…</span></div><div class="cmd-hint">Configure the welcome ping channel</div></div></div>
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">schedule_restock <span style="color:#8ea1e1">time:</span><span style="color:#fbbf24">…</span></div><div class="cmd-hint">Schedule an automatic daily restock</div></div></div>
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">blacklist <span style="color:#8ea1e1">add user:</span><span style="color:#fbbf24">@…</span></div><div class="cmd-hint">Block a user from being joined</div></div></div>
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">enable_server <span style="color:#8ea1e1">server_id:</span><span style="color:#fbbf24">…</span></div><div class="cmd-hint">Allowlist a server (super-owner only)</div></div></div>
          <div class="cmd-row"><span class="cmd-slash">/</span><div><div class="cmd-text">load_tokens</div><div class="cmd-hint">Bulk-load tokens from the incoming file</div></div></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════ HOW IT WORKS -->
<section id="how-it-works" class="hiw-bg">
  <div class="section-inner">
    <div class="text-center">
      <div class="section-tag">HOW IT WORKS</div>
      <h2 class="section-heading">Up and running in minutes</h2>
      <p class="section-sub">Three steps from approval to fully automated community growth.</p>
    </div>
    <div class="steps">
      <div>
        <div class="step-num">01</div>
        <div class="step-title">Request Access</div>
        <p class="step-desc">Approved server owners request access. Once allowlisted, the bot is active in your server and ready to use immediately.</p>
      </div>
      <div>
        <div class="step-num">02</div>
        <div class="step-title">Collect Tokens</div>
        <p class="step-desc">Members run /get_token, authorize via Discord OAuth2, and their token is securely stored — or bulk-load tokens from a file.</p>
      </div>
      <div>
        <div class="step-num">03</div>
        <div class="step-title">Join &amp; Automate</div>
        <p class="step-desc">Run /djoin to instantly pull members into any server, or set up scheduled restocks to grow your community on autopilot.</p>
      </div>
    </div>
    <div class="discord-card">
      <div class="discord-card-header">
        <div class="discord-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
        </div>
        <div>
          <div class="discord-name">Memberty</div>
          <div class="discord-verified"><span class="discord-dot"></span> Verified Bot</div>
        </div>
      </div>
      <div class="discord-body"><strong style="color:#fff">Memberty</strong> wants to access your Discord account.</div>
      <div class="discord-perms">
        <div class="discord-perm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Know what servers you're in</div>
        <div class="discord-perm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Join servers on your behalf</div>
      </div>
      <div class="discord-actions">
        <button class="discord-auth">Authorize</button>
        <button class="discord-cancel">Cancel</button>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════ SECURITY -->
<section id="security">
  <div class="section-inner">
    <div class="security-grid">
      <div class="security-cards">
        <div class="security-card">
          <div class="security-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <div class="security-card-title">Encrypted token storage</div>
          <div class="security-card-desc">All OAuth2 tokens are stored with encryption at rest. No plaintext credentials are ever logged.</div>
        </div>
        <div class="security-card">
          <div class="security-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
          <div class="security-card-title">Permission gating</div>
          <div class="security-card-desc">Commands are gated to server owners and super-owners. Allowlist and blacklist prevent misuse.</div>
        </div>
        <div class="security-card">
          <div class="security-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div class="security-card-title">Discord-native OAuth2</div>
          <div class="security-card-desc">We only use Discord's official OAuth2 flow. No passwords, no unofficial methods, fully TOS-compliant.</div>
        </div>
        <div class="security-card">
          <div class="security-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></div>
          <div class="security-card-title">Automatic token rotation</div>
          <div class="security-card-desc">Tokens are refreshed before expiry automatically so your member pool never goes stale.</div>
        </div>
      </div>
      <div>
        <div class="section-tag">SECURITY</div>
        <h2 class="section-heading">Built with security<br>at its core.</h2>
        <p class="section-sub">Memberty is designed from the ground up with member trust in mind. Every token and every action is handled with care.</p>
        <ul class="check-list">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Only approved servers can use the bot</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> No data is ever shared with third parties</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Ephemeral replies keep sensitive data private</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Audit logs for all super-owner actions</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════ TESTIMONIALS -->
<section class="testimonials-bg">
  <div class="section-inner">
    <div class="text-center">
      <div class="stars">
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <h2 class="section-heading">Trusted by server owners</h2>
      <p class="section-sub">Here's what our approved users are saying.</p>
    </div>
    <div class="testimonials-grid">
      <div class="testi-card">
        <div class="testi-header">
          <div class="testi-avatar" style="background:#5865F2">SK</div>
          <div><div class="testi-user">ServerOwner_K</div><div class="testi-time">TODAY AT 9:14 AM</div></div>
        </div>
        <div class="testi-text">Memberty literally saved hours of manual work. Set up a restock, came back the next morning to 800 new members. Insane.</div>
      </div>
      <div class="testi-card">
        <div class="testi-header">
          <div class="testi-avatar" style="background:#23a559">GR</div>
          <div><div class="testi-user">GuildMaster_R</div><div class="testi-time">TODAY AT 11:02 AM</div></div>
        </div>
        <div class="testi-text">The auto-ping feature is incredible. Every single new member gets a welcome message immediately. Retention is noticeably up.</div>
      </div>
      <div class="testi-card">
        <div class="testi-header">
          <div class="testi-avatar" style="background:#eb459e">OX</div>
          <div><div class="testi-user">OwnerXYZ</div><div class="testi-time">TODAY AT 2:45 PM</div></div>
        </div>
        <div class="testi-text">Bulk token loading from file is a game changer. Dropped a 2,000-line txt and it handled everything perfectly.</div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════ CTA -->
<section id="cta" class="cta-section">
  <div class="cta-bg"></div>
  <div class="cta-line-top"></div>
  <div class="cta-line-bottom"></div>
  <div class="cta-orb"></div>
  <div class="section-inner">
    <div class="cta-inner">
      <h2 class="cta-heading">Ready to scale your<br>Discord server?</h2>
      <p class="cta-sub">Memberty is available for approved server owners only. Request access today and start growing your community on autopilot.</p>
      <a href="mailto:request@memberty.bot" class="btn-cta">
        Request Access
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
      <p class="cta-note">Private bot &nbsp;&middot;&nbsp; Approved servers only &nbsp;&middot;&nbsp; Instant setup</p>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════ FOOTER -->
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div>
        <a href="/" class="nav-logo" style="margin-bottom:10px;display:inline-flex">
          <div class="nav-logo-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#fff"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
          </div>
          Memberty
        </a>
        <p class="footer-brand-desc">The private Discord bot for serious server owners. Mass joins, token management, and automated growth tools.</p>
      </div>
      <div class="footer-links">
        <div class="footer-col">
          <div class="footer-col-title">Product</div>
          <ul>
            <li><a href="#features">Features</a></li>
            <li><a href="#commands">Commands</a></li>
            <li><a href="#security">Security</a></li>
            <li><a href="#how-it-works">How it works</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Resources</div>
          <ul>
            <li><a href="/status">Bot Status</a></li>
            <li><a href="/healthz">Health Check</a></li>
            <li><a href="/auth/callback">OAuth Callback</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Legal</div>
          <ul>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; ${new Date().getFullYear()} Memberty Bot. All rights reserved.</span>
      <span>Not affiliated with Discord Inc.</span>
    </div>
  </div>
</footer>

</body>
</html>`;
}
