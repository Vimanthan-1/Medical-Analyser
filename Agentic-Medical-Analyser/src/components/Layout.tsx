import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Menu, X, Activity } from "lucide-react";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/intake", label: "Triage" },
  { to: "/results", label: "Results" },
  { to: "/hospitals", label: "Hospitals" },
  { to: "/chat", label: "AI Chat" },
  { to: "/explain", label: "Explain" },
];

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Full-screen gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(219,39,119,0.28) 0%, rgba(147,51,234,0.22) 40%, rgba(79,70,229,0.22) 70%, rgba(59,130,246,0.18) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 55% 48%, rgba(236,72,153,0.3) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 78% 38%, rgba(139,92,246,0.25) 0%, transparent 50%)",
        }}
      />
      <div className="absolute inset-0 bg-white/25 backdrop-blur-[2px]" />

      {/* Navbar */}
      <header className="relative z-20 flex-shrink-0">
        {/* Glass strip */}
        <div className="bg-white/40 backdrop-blur-xl border-b border-white/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-slate-800 tracking-tight hidden sm:block">
                Agentic Medical
                <span className="text-violet-600"> Analyser</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ to, label }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`
                      relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${active
                        ? "bg-violet-600/90 text-white shadow-sm shadow-violet-400/30"
                        : "text-slate-600 hover:text-violet-700 hover:bg-violet-50/70"
                      }
                    `}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-violet-50/80 transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-white/50 shadow-lg z-30">
            <nav className="flex flex-col p-3 gap-1">
              {NAV_LINKS.map(({ to, label }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${active
                        ? "bg-violet-600 text-white"
                        : "text-slate-700 hover:bg-violet-50 hover:text-violet-700"
                      }
                    `}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="relative z-10 flex-1 overflow-auto">
        {location.pathname === "/" ? (
          <Outlet />
        ) : (
          <div className="px-4 md:px-10 pt-8 md:pt-10 pb-8 md:pb-12">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
