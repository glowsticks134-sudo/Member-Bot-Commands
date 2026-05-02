import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Users, KeyRound, Clock, Zap, ShieldCheck, ChevronRight,
  Terminal, Hash, Lock, Globe, Bell, RefreshCw, Server,
  CheckCircle2, ArrowRight, Star, Menu
} from 'lucide-react';

const BLURPLE = '#5865F2';
const BLURPLE_DARK = '#4752C4';
const BG = '#0b0d12';
const CARD_BG = '#12141c';
const BORDER = 'rgba(255,255,255,0.07)';

function Navbar() {
  return (
    <nav style={{ background: 'rgba(11,13,18,0.85)', borderBottom: `1px solid ${BORDER}` }}
      className="fixed top-0 w-full z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BLURPLE }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">Memberty</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#commands" className="hover:text-white transition-colors">Commands</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#security" className="hover:text-white transition-colors">Security</a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-zinc-300 hover:text-white hover:bg-white/10 hidden sm:flex">
            Log in
          </Button>
          <Button size="sm" style={{ background: BLURPLE }} className="text-white hover:opacity-90 border-0 font-semibold">
            Request Access
          </Button>
          <Menu className="w-5 h-5 text-zinc-400 md:hidden" />
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-36 pb-28 md:pt-52 md:pb-40 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/__mockup/images/memberty-hero-bg.png" alt="" className="w-full h-full object-cover opacity-20 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d12] via-transparent to-[#0b0d12]" />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[160px] pointer-events-none" style={{ background: 'rgba(88,101,242,0.18)' }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium mb-8"
          style={{ background: 'rgba(88,101,242,0.1)', borderColor: 'rgba(88,101,242,0.25)', color: '#8ea1e1' }}>
          <Zap className="w-3.5 h-3.5" />
          <span>Private — approved servers only</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.08]">
          Grow your Discord<br />
          community{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${BLURPLE} 0%, #8ea1e1 100%)` }}>
            effortlessly.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          The most powerful private Discord bot for mass server joining, OAuth2 token management, automated welcome pings, and scheduled member restocks.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Button size="lg" className="h-12 px-8 text-base font-semibold text-white border-0 rounded-lg"
            style={{ background: BLURPLE }}>
            Request Access <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8 text-base border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white bg-transparent rounded-lg">
            View Commands
          </Button>
        </div>

        {/* Stats row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-16">
          {[
            { value: '250K+', label: 'Members joined' },
            { value: '1,800+', label: 'Tokens managed' },
            { value: '99.9%', label: 'Uptime' },
            { value: '<2s', label: 'Avg join time' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-white">{s.value}</div>
              <div className="text-sm text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: <Users className="w-5 h-5" />,
      title: 'Mass Server Joining',
      desc: 'Instantly pull thousands of authorized members into any server using our highly optimised joining engine with built-in rate-limit handling.',
    },
    {
      icon: <KeyRound className="w-5 h-5" />,
      title: 'OAuth2 Token Management',
      desc: 'Securely collect, store, and refresh Discord OAuth2 tokens from users. Bulk-load tokens via file upload or slash commands.',
    },
    {
      icon: <Bell className="w-5 h-5" />,
      title: 'Auto-Ping Welcome',
      desc: 'Greet every new member the moment they join with a customisable ping in any channel. Supports role mentions and member counts.',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: 'Scheduled Restocks',
      desc: 'Set daily or custom restock schedules and Memberty will keep pulling members automatically — no manual intervention needed.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5" />,
      title: 'Server Allowlisting',
      desc: 'Full control over which servers can use the bot. Super-owner commands to enable, disable, and list allowed guilds instantly.',
    },
    {
      icon: <RefreshCw className="w-5 h-5" />,
      title: 'Token Auto-Refresh',
      desc: 'Memberty automatically refreshes expiring OAuth2 tokens in the background, so your member pool stays fresh without any effort.',
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: 'Blacklist System',
      desc: 'Block specific users from being joined or from using the bot. Full super-owner blacklist management with reason tracking.',
    },
    {
      icon: <Server className="w-5 h-5" />,
      title: 'Multi-Server Support',
      desc: 'Manage multiple Discord servers from one bot. Per-server role limits, locks, and restock configurations all in one place.',
    },
  ];

  return (
    <section id="features" className="py-28" style={{ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <Badge className="mb-4 text-xs font-semibold px-3 py-1 rounded-full border"
            style={{ background: 'rgba(88,101,242,0.12)', color: '#8ea1e1', borderColor: 'rgba(88,101,242,0.2)' }}>
            FEATURES
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need to scale</h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-base leading-relaxed">
            Built exclusively for approved server owners. Memberty handles the heavy lifting so you can focus on building your community.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="rounded-xl p-5 border transition-colors group hover:border-[#5865F2]/40"
              style={{ background: CARD_BG, borderColor: BORDER }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors group-hover:bg-[#5865F2]/25"
                style={{ background: 'rgba(88,101,242,0.15)', color: '#8ea1e1' }}>
                {f.icon}
              </div>
              <h3 className="text-white font-semibold mb-2 text-sm">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommandsSection() {
  const commands = [
    { cmd: '/get_token', desc: 'Generate an OAuth2 auth link for the user' },
    { cmd: '/djoin server_id:ID', desc: 'Mass-join all stored users into a server' },
    { cmd: '/restock tokens:…', desc: 'Add new tokens and join users immediately' },
    { cmd: '/autoping_set channel:#…', desc: 'Configure the welcome ping channel' },
    { cmd: '/schedule_restock time:…', desc: 'Schedule an automatic daily restock' },
    { cmd: '/blacklist add user:@…', desc: 'Block a user from being joined' },
    { cmd: '/enable_server server_id:…', desc: 'Allowlist a server (super-owner)' },
    { cmd: '/load_tokens', desc: 'Bulk-load tokens from the incoming file' },
  ];

  return (
    <section id="commands" className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Badge className="mb-4 text-xs font-semibold px-3 py-1 rounded-full border"
              style={{ background: 'rgba(88,101,242,0.12)', color: '#8ea1e1', borderColor: 'rgba(88,101,242,0.2)' }}>
              SLASH COMMANDS
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powerful commands,<br />simple interface.
            </h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              Every action is a clean Discord slash command — no dashboards to learn, no external tools. Run everything right inside your server.
            </p>
            <ul className="space-y-3">
              {['Instant autocomplete in Discord', 'Permission-gated commands', 'Ephemeral responses for privacy', 'Prefix fallback (!command) supported'].map(t => (
                <li key={t} className="flex items-center gap-3 text-zinc-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: BLURPLE }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Terminal mockup */}
          <div className="rounded-2xl overflow-hidden border shadow-2xl" style={{ background: '#0d0f14', borderColor: BORDER }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: BORDER, background: '#12141c' }}>
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="flex items-center gap-1.5 ml-3 text-xs text-zinc-500">
                <Hash className="w-3 h-3" />
                <span>general</span>
              </div>
            </div>
            <div className="p-5 space-y-2 font-mono text-sm">
              {commands.map((c, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  <span className="text-[#5865F2] flex-shrink-0 mt-0.5">/</span>
                  <div>
                    <span className="text-white">{c.cmd.slice(1)}</span>
                    <span className="block text-zinc-600 text-xs mt-0.5">{c.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Request Access',
      desc: 'Approved server owners request access. Once allowlisted, the bot is active in your server and ready to use.',
    },
    {
      n: '02',
      title: 'Collect Tokens',
      desc: 'Members run /get_token, authorize via Discord OAuth2, and their token is securely stored — or bulk-load from a file.',
    },
    {
      n: '03',
      title: 'Join & Automate',
      desc: 'Run /djoin to instantly pull members into any server, or set up scheduled restocks to grow on autopilot.',
    },
  ];

  return (
    <section id="how-it-works" className="py-28" style={{ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <Badge className="mb-4 text-xs font-semibold px-3 py-1 rounded-full border"
            style={{ background: 'rgba(88,101,242,0.12)', color: '#8ea1e1', borderColor: 'rgba(88,101,242,0.2)' }}>
            HOW IT WORKS
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Up and running in minutes</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">Three steps from approval to fully automated community growth.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              <div className="text-6xl font-black mb-4 select-none" style={{ color: 'rgba(88,101,242,0.15)' }}>{s.n}</div>
              <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-10 -right-5 w-5 h-5 text-zinc-700" />
              )}
            </div>
          ))}
        </div>

        {/* Discord auth card mockup */}
        <div className="max-w-sm mx-auto">
          <div className="rounded-2xl border p-6 shadow-2xl" style={{ background: '#1e1f22', borderColor: BORDER }}>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b" style={{ borderColor: BORDER }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: BLURPLE }}>
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">Memberty</div>
                <div className="text-xs text-zinc-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Verified Bot
                </div>
              </div>
            </div>
            <p className="text-sm text-zinc-300 mb-4">
              <strong className="text-white">Memberty</strong> wants to access your account
            </p>
            <div className="rounded-lg p-3 mb-4 space-y-2.5" style={{ background: '#2b2d31' }}>
              {['Know what servers you\'re in', 'Join servers on your behalf'].map(p => (
                <div key={p} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 text-green-500" />
                  {p}
                </div>
              ))}
            </div>
            <div className="flex gap-2.5">
              <Button className="flex-1 text-white font-semibold text-sm" style={{ background: BLURPLE }}>
                Authorize
              </Button>
              <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 text-sm">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const items = [
    {
      icon: <Lock className="w-5 h-5" />,
      title: 'Encrypted token storage',
      desc: 'All OAuth2 tokens are stored with encryption at rest. No plaintext credentials are ever logged.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5" />,
      title: 'Permission gating',
      desc: 'Commands are gated to server owners and super-owners. Blacklist and allowlist systems prevent misuse.',
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: 'Discord-native OAuth2',
      desc: 'We only use Discord\'s official OAuth2 flow. No passwords, no unofficial methods, fully TOS-compliant.',
    },
    {
      icon: <RefreshCw className="w-5 h-5" />,
      title: 'Automatic token rotation',
      desc: 'Tokens are refreshed before expiry automatically. Your member pool never goes stale due to expired credentials.',
    },
  ];

  return (
    <section id="security" className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="grid grid-cols-2 gap-4">
            {items.map((item, i) => (
              <div key={i} className="rounded-xl p-5 border" style={{ background: CARD_BG, borderColor: BORDER }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(88,101,242,0.15)', color: '#8ea1e1' }}>
                  {item.icon}
                </div>
                <h3 className="text-white text-sm font-semibold mb-1.5">{item.title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div>
            <Badge className="mb-4 text-xs font-semibold px-3 py-1 rounded-full border"
              style={{ background: 'rgba(88,101,242,0.12)', color: '#8ea1e1', borderColor: 'rgba(88,101,242,0.2)' }}>
              SECURITY
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built with security<br />at its core.
            </h2>
            <p className="text-zinc-400 mb-6 leading-relaxed">
              Memberty is designed from the ground up with member trust in mind. Every token, every action, every permission is handled with care.
            </p>
            <ul className="space-y-3">
              {['Only approved servers can use the bot', 'No data is ever shared with third parties', 'Ephemeral replies keep sensitive data private', 'Audit logs for all super-owner actions'].map(t => (
                <li key={t} className="flex items-center gap-3 text-zinc-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: BLURPLE }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const msgs = [
    {
      user: 'ServerOwner_K', tag: 'TODAY AT 9:14 AM', avatar: 'SK',
      color: '#5865F2',
      text: 'Memberty literally saved hours of manual work. Set up a restock, came back the next morning to 800 new members. Insane.',
    },
    {
      user: 'GuildMaster_R', tag: 'TODAY AT 11:02 AM', avatar: 'GR',
      color: '#23a559',
      text: 'The auto-ping feature is 🔥 Every single new member gets a welcome message immediately. Retention is up noticeably.',
    },
    {
      user: 'OwnerXYZ', tag: 'TODAY AT 2:45 PM', avatar: 'OX',
      color: '#eb459e',
      text: 'Bulk token loading from file is a game changer. Dropped a 2,000-line txt and it handled everything perfectly.',
    },
  ];

  return (
    <section className="py-28" style={{ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Trusted by server owners</h2>
          <p className="text-zinc-400">Here's what our approved users are saying.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {msgs.map((m, i) => (
            <div key={i} className="rounded-xl p-5 border" style={{ background: '#12141c', borderColor: BORDER }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: m.color }}>
                  {m.avatar}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{m.user}</div>
                  <div className="text-zinc-600 text-xs">{m.tag}</div>
                </div>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed">{m.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'rgba(88,101,242,0.04)' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-full max-w-4xl"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(88,101,242,0.5), transparent)' }} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-full max-w-4xl"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(88,101,242,0.3), transparent)' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'rgba(88,101,242,0.12)' }} />

      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5 leading-tight">
          Ready to scale your<br />Discord server?
        </h2>
        <p className="text-xl text-zinc-400 mb-10 leading-relaxed">
          Memberty is available for approved server owners only. Request access today and start growing your community on autopilot.
        </p>
        <Button size="lg" className="text-white font-bold text-lg h-14 px-12 rounded-full border-0"
          style={{ background: BLURPLE, boxShadow: '0 0 40px -8px rgba(88,101,242,0.7)' }}>
          Request Access <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
        <p className="text-zinc-600 text-sm mt-5">Private bot · Approved servers only · Instant setup</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-12" style={{ borderColor: BORDER }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-10">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BLURPLE }}>
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-lg text-white">Memberty</span>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              The private Discord bot for serious server owners. Mass joins, token management, and automated growth tools.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <div className="text-white font-semibold mb-3">Product</div>
              <ul className="space-y-2 text-zinc-500">
                <li><a href="#features" className="hover:text-zinc-300 transition-colors">Features</a></li>
                <li><a href="#commands" className="hover:text-zinc-300 transition-colors">Commands</a></li>
                <li><a href="#security" className="hover:text-zinc-300 transition-colors">Security</a></li>
                <li><a href="#how-it-works" className="hover:text-zinc-300 transition-colors">How it works</a></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-3">Resources</div>
              <ul className="space-y-2 text-zinc-500">
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-3">Legal</div>
              <ul className="space-y-2 text-zinc-500">
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-zinc-600"
          style={{ borderColor: BORDER }}>
          <span>© {new Date().getFullYear()} Memberty Bot. All rights reserved.</span>
          <span>Not affiliated with Discord Inc.</span>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen text-zinc-100 font-sans" style={{ background: BG }}>
      <style>{`
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }
        ::selection { background: rgba(88,101,242,0.4); }
      `}</style>
      <Navbar />
      <Hero />
      <FeaturesSection />
      <CommandsSection />
      <HowItWorks />
      <SecuritySection />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}
