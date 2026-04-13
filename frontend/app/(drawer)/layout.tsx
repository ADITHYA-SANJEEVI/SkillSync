import type { ReactNode } from "react";
import "../globals.css";
import DashboardDrawer from "@/components/DashboardDrawer";

export default function DrawerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <DashboardDrawer />
      <div className="container mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
