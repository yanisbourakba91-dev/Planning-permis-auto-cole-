"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/app-layout";
import { ChevronLeft, ChevronRight, Save, Info, Pencil, Check, X } from "lucide-react";
import { getMonthName, getSlotColor } from "@/lib/utils";

interface ExamMonth {
  id: string;
  year: number;
  month: number;
  totalSlots: number;
  usedSlots: number;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function PlacesExamenPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [months, setMonths] = useState<ExamMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});

  /* Weekly data */
  const [weekPlacements, setWeekPlacements] = useState(0);
  const [weeklyLimit, setWeeklyLimit] = useState(10);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [weeklyInput, setWeeklyInput] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("planpermis_weekly_limit");
    if (stored) setWeeklyLimit(parseInt(stored));
  }, []);

  const fetchMonths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/places-examen?year=${year}`);
      const data = await res.json();
      const list: ExamMonth[] = Array.isArray(data) ? data : [];
      setMonths(list);
      const initialEdits: Record<number, string> = {};
      MONTHS.forEach(m => {
        const found = list.find(x => x.month === m);
        initialEdits[m] = found ? found.totalSlots.toString() : "0";
      });
      setEdits(initialEdits);

      /* Fetch current week placements */
      const { start, end } = getWeekBounds();
      const [p1, p2] = await Promise.all([
        fetch(`/api/placements?year=${start.getFullYear()}&month=${start.getMonth() + 1}`).then(r => r.json()),
        start.getMonth() !== end.getMonth()
          ? fetch(`/api/placements?year=${end.getFullYear()}&month=${end.getMonth() + 1}`).then(r => r.json())
          : Promise.resolve([]),
      ]);
      const all = [...(Array.isArray(p1) ? p1 : []), ...(Array.isArray(p2) ? p2 : [])];
      const weekCount = all.filter((p: { date: string }) => {
        const d = new Date(p.date);
        return d >= start && d <= end;
      }).length;
      setWeekPlacements(weekCount);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchMonths(); }, [fetchMonths]);

  async function handleSave(month: number) {
    setSaving(month);
    try {
      const res = await fetch("/api/places-examen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, totalSlots: parseInt(edits[month] || "0") }),
      });
      if (res.ok) {
        const data = await res.json();
        setMonths(prev => {
          const exists = prev.find(m => m.month === month);
          if (exists) return prev.map(m => m.month === month ? data : m);
          return [...prev, data];
        });
      }
    } finally {
      setSaving(null);
    }
  }

  function saveWeeklyLimit(v: number) {
    setWeeklyLimit(v);
    localStorage.setItem("planpermis_weekly_limit", String(v));
    setEditingWeekly(false);
  }

  function getMonthData(month: number): ExamMonth | null {
    return months.find(m => m.month === month) || null;
  }

  const totalAvailable = months.reduce((sum, m) => sum + Math.max(0, m.totalSlots - m.usedSlots), 0);
  const totalUsed = months.reduce((sum, m) => sum + m.usedSlots, 0);
  const totalSlots = months.reduce((sum, m) => sum + m.totalSlots, 0);
  const weekAvailable = Math.max(0, weeklyLimit - weekPlacements);

  return (
    <AppLayout title="Places d'examen" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="space-y-6">

        {/* ── Top row: counters + navigation ── */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Year navigation */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-1">
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-bold text-gray-900 dark:text-white w-14 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Annual summary chips */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-2">
              <span className="text-xs text-gray-500">Total {year}</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{totalSlots}</span>
            </div>
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-2">
              <span className="text-xs text-orange-500">Occupées</span>
              <span className="text-sm font-bold text-orange-600">{totalUsed}</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-2">
              <span className="text-xs text-green-500">Disponibles</span>
              <span className="text-sm font-bold text-green-600">{totalAvailable}</span>
            </div>
          </div>
        </div>

        {/* ── Weekly counters ── */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl px-6 py-4 flex flex-col items-center min-w-[160px]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500/60 mb-1">Cette semaine · planifiés</span>
            <span className="text-2xl font-bold text-blue-600">{weekPlacements}</span>
            <span className="text-[10px] text-blue-400 mt-0.5">{weekAvailable} disponibles</span>
          </div>
          <div
            className="bg-green-50 dark:bg-green-900/20 rounded-2xl px-6 py-4 flex flex-col items-center min-w-[160px] cursor-pointer"
            onClick={() => { if (!editingWeekly) { setWeeklyInput(String(weeklyLimit)); setEditingWeekly(true); } }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-green-500/60 mb-1">Limite hebdomadaire</span>
            {editingWeekly ? (
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <input
                  type="number"
                  min={0}
                  value={weeklyInput}
                  onChange={e => setWeeklyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveWeeklyLimit(parseInt(weeklyInput) || 0); if (e.key === "Escape") setEditingWeekly(false); }}
                  autoFocus
                  className="w-16 text-center text-2xl font-bold text-green-600 bg-transparent border-b-2 border-green-400 focus:outline-none"
                />
                <button onClick={() => saveWeeklyLimit(parseInt(weeklyInput) || 0)} className="text-green-600 opacity-70 hover:opacity-100"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditingWeekly(false)} className="text-gray-400 opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-green-600">{weeklyLimit}</span>
                <Pencil className="h-3 w-3 text-green-400 opacity-60" />
              </div>
            )}
            <span className="text-[10px] text-green-400 mt-0.5">Cliquer pour modifier</span>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Définissez le nombre de places disponibles pour chaque mois. Le compteur décrémente automatiquement à chaque placement d'examen.</p>
        </div>

        {/* Month grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MONTHS.map(month => {
              const data = getMonthData(month);
              const used = data?.usedSlots ?? 0;
              const available = Math.max(0, (data?.totalSlots ?? 0) - used);
              const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
              const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
              const fillRatio = data?.totalSlots ? used / data.totalSlots : 0;

              return (
                <div
                  key={month}
                  className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border p-5 ${isCurrentMonth ? "border-blue-200 dark:border-blue-700 ring-2 ring-blue-500/20" : "border-gray-100 dark:border-gray-800"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{getMonthName(month)}</h3>
                    {isCurrentMonth && (
                      <span className="text-[10px] font-semibold bg-blue-500 text-white rounded-full px-2 py-0.5">Ce mois</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {data && data.totalSlots > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-400">{used} occupée{used !== 1 ? "s" : ""}</span>
                        <span className={`font-semibold ${getSlotColor(used, data.totalSlots)}`}>{available} libre{available !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${fillRatio >= 1 ? "bg-red-500" : fillRatio >= 0.75 ? "bg-orange-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(fillRatio * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Input + save */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={edits[month] || ""}
                      onChange={e => setEdits(prev => ({ ...prev, [month]: e.target.value }))}
                      disabled={isPast}
                      className="flex-1 h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-center text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      disabled={isPast || saving === month}
                      onClick={() => handleSave(month)}
                      title="Enregistrer"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:border-blue-400 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving === month
                        ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        : <Save className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    {isPast ? "Mois passé" : "Places disponibles à définir"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
