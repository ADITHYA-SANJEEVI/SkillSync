"use client"
import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Menu, X, LogOut, Settings, Moon, Search } from "lucide-react"

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "ðŸ“Š" },
  { label: "Resume", href: "/resume", icon: "ðŸ“„" },
  { label: "Extract Skills", href: "/extract-skills", icon: "âš¡" },
  { label: "Resume Score", href: "/resume-score", icon: "â­" },
  { label: "Skill Analysis", href: "/skill-analysis", icon: "ðŸ”" },
  { label: "Compute Gaps", href: "/compute-gaps", icon: "ðŸŽ¯" },
  { label: "Course Genie", href: "/course-genie", icon: "ðŸŽ“" },
  { label: "Live Jobs", href: "/live-jobs", icon: "ðŸŒ" },
  { label: "Omni Chat", href: "/chat", icon: "ðŸ’¬" },
  { label: "Profile", href: "/profile", icon: "ðŸ‘¤" },
]

export function AppShell({ children }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="flex min-h-screen">
      {/* Drawer overlay */}
      {drawerOpen && <div className="fixed inset-0 z-30 bg-black/45 lg:hidden" onClick={closeDrawer} />}

      {/* Navigation Drawer */}
      <nav
        className={`
          fixed lg:static top-0 left-0 z-40 w-64 h-screen bg-[rgba(10,15,26,0.8)] backdrop-blur-md 
          border-r border-[rgba(255,255,255,0.14)] flex flex-col transition-transform duration-320 lg:translate-x-0
          ${drawerOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-6 border-b border-[rgba(255,255,255,0.14)]">
          <div className="flex items-center justify-between">
            <h1
              className="text-2xl font-bold"
              style={{
                background: "var(--brand-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SkillSync
            </h1>
            <button onClick={closeDrawer} className="lg:hidden text-[rgba(255,255,255,0.68)]">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={closeDrawer}>
                <div
                  className={`
                    px-4 py-3 rounded-[12px] flex items-center gap-3 transition-all duration-200
                    ${
                      isActive
                        ? "bg-[rgba(255,255,255,0.1)] font-semibold text-white"
                        : "text-[rgba(255,255,255,0.68)] hover:text-[rgba(255,255,255,0.92)] hover:translate-x-1"
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && <ChevronRight size={16} className="ml-auto" />}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-[rgba(255,255,255,0.14)] space-y-2">
          <button className="w-full px-4 py-2 rounded-[12px] bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.68)] hover:bg-[rgba(255,255,255,0.1)] transition-all flex items-center gap-2">
            <Moon size={18} />
            <span>Dark Mode</span>
          </button>
          <button className="w-full px-4 py-2 rounded-[12px] text-[rgba(255,255,255,0.68)] hover:bg-[rgba(255,255,255,0.05)] transition-all flex items-center gap-2">
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="w-full px-4 py-2 rounded-[12px] text-[#ef6262] hover:bg-[rgba(239,98,98,0.1)] transition-all flex items-center gap-2">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-[rgba(10,15,26,0.6)] backdrop-blur-md border-b border-[rgba(255,255,255,0.14)]">
          <div className="flex items-center justify-between px-6 h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="lg:hidden text-[rgba(255,255,255,0.68)] hover:text-white transition-colors"
              >
                <Menu size={20} />
              </button>
              <div className="relative hidden sm:block">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.32)]" />
                <input type="text" placeholder="Search..." className="input-glass w-64 pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.14)]" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}

