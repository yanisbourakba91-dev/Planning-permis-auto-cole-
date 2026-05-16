"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  role: string;
  schoolName?: string | null;
}

export function AppLayout({ children, title, role, schoolName }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden relative bg-gradient-to-br from-sky-50 via-white to-indigo-50/60 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/20">

      {/* ── Decorative background blobs ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-[420px] w-[420px] rounded-full bg-indigo-400/8 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-[360px] w-[360px] rounded-full bg-sky-300/10 blur-3xl" />
        {/* subtle wave arcs */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="80%" cy="20%" rx="35%" ry="20%" fill="none" stroke="#007AFF" strokeWidth="1.5" />
          <ellipse cx="15%" cy="75%" rx="28%" ry="16%" fill="none" stroke="#5856D6" strokeWidth="1" />
        </svg>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div className="hidden md:flex flex-shrink-0 relative z-10">
        <Sidebar role={role} schoolName={schoolName} />
      </div>

      {/* Sidebar - mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex md:hidden transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar role={role} schoolName={schoolName} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <Topbar title={title} onMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
