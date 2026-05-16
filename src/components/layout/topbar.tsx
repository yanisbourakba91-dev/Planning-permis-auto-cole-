"use client";

import { Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  title: string;
  onMenuToggle?: () => void;
}

export function Topbar({ title, onMenuToggle }: TopbarProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl px-6">
      {onMenuToggle && (
        <Button variant="ghost" size="icon" onClick={onMenuToggle} className="md:hidden -ml-2">
          <Menu className="h-5 w-5" />
        </Button>
      )}
      <h1 className="flex-1 text-[17px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h1>
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Changer le thème"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}
