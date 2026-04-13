"use client";

import * as React from "react";
import { SoftSidebar } from "./SoftSidebar";
import { motion } from "framer-motion";

const SIDEBAR_W = 240;

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  // Mirror open state with a CSS var via a tiny event channel (no context required)
  // We just estimate: if pinned OR near left edge -> translate content.
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      // If near left edge, reserve space to avoid overlap; otherwise collapse
      const near = e.clientX <= 30;
      setOffset(near ? SIDEBAR_W : 0);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // If user pinned via localStorage, respect it from first render
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("sidebar_pinned") === "1") setOffset(SIDEBAR_W);
  }, []);

  return (
    <div>
      <SoftSidebar />
      <motion.div
        style={{ marginLeft: offset }}
        animate={{ marginLeft: offset }}
        transition={{ duration: 0.22 }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </div>
  );
}
