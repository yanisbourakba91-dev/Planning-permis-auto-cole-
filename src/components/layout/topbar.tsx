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
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6">
      {onMenuToggle && (
        <Button variant="ghost" size="icon" onClick={onMenuToggle} className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      )}
      <h1 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Changer le thème"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    </header>
  );
}
