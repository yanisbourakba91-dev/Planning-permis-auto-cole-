"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList,
  KeyRound, LogOut, GraduationCap, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SidebarProps {
  role: string;
  schoolName?: string | null;
}

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { href: "/eleves", icon: Users, label: "Élèves" },
  { href: "/calendrier", icon: CalendarDays, label: "Calendrier" },
  { href: "/places-examen", icon: ClipboardList, label: "Places d'examen" },
];

const adminItems = [
  { href: "/admin", icon: KeyRound, label: "Administration" },
];

export function Sidebar({ role, schoolName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center p-4 border-b border-gray-100 dark:border-gray-800", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500 shadow-sm shadow-blue-200">
              <GraduationCap className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold text-[15px] text-gray-900 dark:text-white tracking-tight">PlanPermis</span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500 shadow-sm shadow-blue-200">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* School name */}
      {!collapsed && schoolName && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">Auto-école</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{schoolName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", active ? "text-blue-500" : "text-gray-400")} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {role === "ADMIN" && (
          <>
            <div className={cn("my-2 border-t border-gray-100 dark:border-gray-800", collapsed && "mx-1")} />
            {adminItems.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", active ? "text-blue-500" : "text-gray-400")} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors w-full"
          title={collapsed ? "Déconnexion" : undefined}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
