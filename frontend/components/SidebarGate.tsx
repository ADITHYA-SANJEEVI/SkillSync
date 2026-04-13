// components/SidebarGate.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SoftSidebar } from "./SoftSidebar";

/**
 * SidebarGate controls WHEN and HOW the SoftSidebar appears.
 *
 * - On /dashboard: no static bar, but a "hot edge" (2–8px strip on the left)
 *   that reveals an overlay sidebar on hover. Press ESC to close.
 * - On all other routes: behave exactly like before (always mounted).
 */
export function SidebarGate() {
  const pathname = usePathname() || "/";
  const onDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Overlay open state (only used on dashboard)
  const [open, setOpen] = useState(false);

  // Close on ESC
  useEffect(() => {
    if (!onDashboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDashboard]);

  if (!onDashboard) {
    // Default behavior everywhere else: render sidebar normally.
    return (
      <div data-app-taskbar className="relative z-[80] pointer-events-auto">
        <SoftSidebar />
      </div>
    );
  }

  // DASHBOARD MODE: hidden by default, reveal on hover near left edge.
  return (
    <>
      {/* Hover "hot edge" trigger (narrow, but easy to hit) */}
      <div
        aria-hidden
        className="fixed inset-y-0 left-0 z-[85] w-2 sm:w-3 md:w-4 pointer-events-auto"
        onMouseEnter={() => setOpen(true)}
      />

      {/* Overlay container for the sliding sidebar */}
      {open && (
        <div
          className="fixed inset-0 z-[90] pointer-events-none"
          // clicking outside closes; sidebar itself will have pointer events
          onClick={() => setOpen(false)}
        >
          {/* Allow interactions inside this region */}
          <div
            className="pointer-events-auto"
            onMouseLeave={() => setOpen(false)}
            // ensure it sits on the left and doesn't block the whole screen
          >
            <div className="fixed inset-y-0 left-0">
              {/* Your existing SoftSidebar (no prop changes) */}
              <SoftSidebar />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
