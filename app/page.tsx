import Link from "next/link";
import { Trophy, Users, Calendar, BarChart3, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Navigation */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b border-neutral-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <Link className="flex items-center justify-center gap-2" href="#">
          <div className="bg-green-600 p-1.5 rounded-lg">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-neutral-900">KickOff</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium text-neutral-600 hover:text-green-600 transition-colors" href="/login">
            Sign In
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full px-5">
              Get Started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-neutral-50 overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-100/40 via-transparent to-transparent pointer-events-none" />
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center space-y-8 text-center">
              <div className="space-y-4 max-w-3xl">
                <div className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                  The #1 Football Match Manager
                </div>
                <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-neutral-900 leading-[1.1]">
                  Organize Your Matches <br />
                  <span className="text-green-600">Like a Pro</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-neutral-500 md:text-xl/relaxed lg:text-2xl/relaxed">
                  The ultimate tool for recreational football players. Manage squads, track attendance, and keep history of every game.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 min-[400px]:gap-6 items-center justify-center">
                <Link href="/register">
                  <Button size="lg" className="h-14 px-8 rounded-full bg-green-600 hover:bg-green-700 text-lg font-semibold shadow-lg shadow-green-600/20 transition-all hover:scale-105 active:scale-95">
                    Start Your First Group
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="h-14 px-8 rounded-full border-neutral-200 text-neutral-700 hover:bg-white text-lg font-semibold transition-all">
                    View Demo
                  </Button>
                </Link>
              </div>
              
              {/* Floating UI Mockup Preview */}
              <div className="relative w-full max-w-5xl mt-12 animate-in fade-in zoom-in duration-1000 delay-300">
                <div className="rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden aspect-[16/9] flex items-center justify-center group cursor-pointer">
                  <div className="absolute inset-0 bg-neutral-900/5 group-hover:bg-neutral-900/0 transition-colors z-10" />
                  <Play className="w-16 h-16 text-green-600 drop-shadow-lg z-20" />
                  <div className="w-full h-full bg-slate-100 flex flex-col p-4 gap-4">
                    <div className="h-8 w-1/3 bg-neutral-200 rounded-md animate-pulse" />
                    <div className="grid grid-cols-3 gap-4 flex-1">
                      <div className="bg-neutral-200 rounded-lg animate-pulse" />
                      <div className="bg-neutral-200 rounded-lg animate-pulse" />
                      <div className="bg-neutral-200 rounded-lg animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-20 lg:py-32 bg-white border-t border-neutral-100">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center group">
                <div className="p-4 rounded-2xl bg-green-50 text-green-600 group-hover:scale-110 transition-transform">
                  <Users className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Squad Management</h3>
                <p className="text-neutral-500 leading-relaxed">
                  Manage your team rosters, handle invitations, and keep track of who&apos;s in and who&apos;s out.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center group">
                <div className="p-4 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                  <Calendar className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Seamless RSVP</h3>
                <p className="text-neutral-500 leading-relaxed">
                  Send match invites and let players confirm their attendance with a single click. No more messy group chats.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center group">
                <div className="p-4 rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Live Statistics</h3>
                <p className="text-neutral-500 leading-relaxed">
                  Record goals, assists, and results. Watch your player stats and group rankings evolve over time.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-8 border-t border-neutral-100 bg-neutral-50/50">
        <div className="container px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-neutral-500">© 2026 KickOff. Built for the game.</p>
          </div>
          <div className="flex gap-6">
            <Link className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors" href="#">Terms</Link>
            <Link className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors" href="#">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
