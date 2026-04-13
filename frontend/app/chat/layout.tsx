"use client";
import ShellLayout from "../../components/ShellLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ShellLayout>{children}</ShellLayout>;
}
