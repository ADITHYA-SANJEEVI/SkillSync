// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SidebarGate } from "../components/SidebarGate";
import FabChat from "../components/FabChat";

export const metadata: Metadata = {
  title: "SkillSync - Résumé & Job Analysis",
  description:
    "Analyze résumés, extract skills, compute gaps, and discover jobs across India.",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Poppins:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Root stacking context */}
        <div className="relative min-h-screen">
          {/* Sliding sidebar (still conditional via SidebarGate) */}
          <div className="relative z-[80] pointer-events-auto">
            <SidebarGate />
          </div>

          {/* Page content */}
          {children}

          {/* Floating Omni Chat */}
          <FabChat />
        </div>

        <Analytics />
      </body>
    </html>
  );
}
