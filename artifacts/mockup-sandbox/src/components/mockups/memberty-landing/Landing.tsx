import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Users, KeyRound, Clock, Zap, ShieldCheck, ChevronRight } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-zinc-100 font-sans selection:bg-[#5865F2] selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-[#0b0d12]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#5865F2] flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Memberty</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-zinc-300 hover:text-white hover:bg-white/10">Login</Button>
            <Button className="bg-[#5865F2] hover:bg-[#4752C4] text-white border-0">Add to Discord</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/__mockup/images/memberty-hero-bg.png" 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d12] via-transparent to-[#0b0d12]" />
        </div>
        
        {/* Glowing orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#5865F2]/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/20 text-[#5865F2] text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            <span>Now with advanced Gecko support</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Grow your community <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5865F2] to-[#8ea1e1]">effortlessly.</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The most powerful private Discord bot for managing mass invites, OAuth2 token storage, and automated member retention workflows.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto bg-[#5865F2] hover:bg-[#4752C4] text-white text-base h-12 px-8">
              Get Started Now <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white bg-transparent">
              View Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-zinc-900/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need to scale</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">Built exclusively for approved server owners. Memberty handles the heavy lifting so you can focus on building your community.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-[#12141c] border-white/10 text-zinc-300">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center mb-4 text-[#5865F2]">
                  <Users className="w-5 h-5" />
                </div>
                <CardTitle className="text-white">Mass Server Joining</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-zinc-400">
                  Instantly pull thousands of authorized members into your servers using our highly optimized joining engine.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-[#12141c] border-white/10 text-zinc-300">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center mb-4 text-[#5865F2]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <CardTitle className="text-white">OAuth2 Token Mgmt</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-zinc-400">
                  Securely collect and store user tokens via the seamless /get_token authentication flow.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-[#12141c] border-white/10 text-zinc-300">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center mb-4 text-[#5865F2]">
                  <Bot className="w-5 h-5" />
                </div>
                <CardTitle className="text-white">Auto-Ping Welcome</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-zinc-400">
                  Automatically mention and welcome new members the second they join to boost initial engagement.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-[#12141c] border-white/10 text-zinc-300">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center mb-4 text-[#5865F2]">
                  <Clock className="w-5 h-5" />
                </div>
                <CardTitle className="text-white">Scheduled Restocks</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-zinc-400">
                  Automate member additions with scheduled restocks. Set it once and let Memberty grow your server over time.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">How it works</h2>
              <p className="text-zinc-400 mb-8">Memberty streamlines the OAuth2 authorization process into three simple steps.</p>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white">1</div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Authenticate</h3>
                    <p className="text-zinc-400">Users run the /get_token command and authorize the bot via Discord's standard OAuth2 prompt.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white">2</div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Store Token</h3>
                    <p className="text-zinc-400">Memberty securely stores the authorization token in our encrypted database.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white">3</div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Join Servers</h3>
                    <p className="text-zinc-400">Authorized owners use their panel to instantly pull those users into target servers.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 w-full max-w-md">
              <div className="bg-[#1e1f22] p-6 rounded-2xl border border-white/5 shadow-2xl relative">
                <div className="absolute -top-3 -right-3">
                  <div className="bg-[#23a559] text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">Verified</div>
                </div>
                <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-4">
                  <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Memberty Auth</div>
                    <div className="text-xs text-zinc-400">BOT</div>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 mb-4">An application would like to connect to your Discord account.</p>
                <div className="bg-[#2b2d31] rounded-lg p-3 mb-4">
                  <ul className="text-sm space-y-2 text-zinc-300">
                    <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#23a559]" /> Know what servers you're in</li>
                    <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#23a559]" /> Join servers for you</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 bg-[#5865F2] hover:bg-[#4752C4] text-white">Authorize</Button>
                  <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5">Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#5865F2]/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#5865F2]/50 to-transparent" />
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to scale your server?</h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            Memberty is currently available for approved server owners only. Request access to start growing today.
          </p>
          <Button size="lg" className="bg-[#5865F2] hover:bg-[#4752C4] text-white text-lg h-14 px-10 rounded-full shadow-[0_0_30px_-5px_#5865F2]">
            Request Access
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10 text-center text-sm text-zinc-500">
        <p>© {new Date().getFullYear()} Memberty Bot. All rights reserved.</p>
      </footer>
    </div>
  );
}
