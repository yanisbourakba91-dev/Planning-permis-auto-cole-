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

interface WeekDef {
  lsKey: string;
  label: string;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtDate(d: Date) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }

function getWeeksOfMonth(year: number, month: number): WeekDef[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  let cursor = new Date(firstDay);
  const dow = cursor.getDay();
  cursor.setDate(cursor.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks: WeekDef[] = [];
  let idx = 0;
  while (cursor <= lastDay) {
    const wEnd = new Date(cursor);
    wEnd.setDate(cursor.getDate() + 6);
    const displayStart = cursor < firstDay ? new Date(firstDay) : new Date(cursor);
    const displayEnd = wEnd > lastDay ? new Date(lastDay) : new Date(wEnd);
    weeks.push({
      lsKey: `planpermis_wk_${year}_${month}_${idx}`,
      label: `${fmtDate(displayStart)} – ${fmtDate(displayEnd)}`,
    });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
    idx++;
  }
  return weeks;
}

function getCurrentWeekBounds(): { start: Date; end: Date } {
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

function calcMonthSum(year: number, month: number, slots: Record<string, number>): number {
  return getWeeksOfMonth(year, month).reduce((s, w) => s + (slots[w.lsKey] ?? 0), 0);
}

/* ── Inline editable week row ── */
function WeekRow({ lsKey, label, value, onChange }: {
  lsKey: string; label: string; value: number; onChange: (val: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const n = Math.max(0, parseInt(raw) || 0);
    onChange(n);
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-blue-50/60 dark:hover:bg-blue-900/20 group transition-colors cursor-pointer"
      onClick={() => { if (!editing) { setDraft(String(value)); setEditing(true); } }}
    >
      <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <input
            key={lsKey}
            type="number"
            min={0}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") commit(draft);
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="w-12 text-center text-xs font-bold text-blue-600 bg-transparent border-b border-blue-400 focus:outline-none"
          />
          <button onClick={() => commit(draft)} className="text-green-500 hover:text-green-600 p-0.5"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 p-0.5"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
            {value} <span className="font-normal text-gray-400">place{value !== 1 ? "s" : ""}</span>
          </span>
          <Pencil className="h-2.5 w-2.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      )}
    </div>
  );
}

export default function PlacesExamenPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [months, setMonths] = useState<ExamMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  /* monthly total inputs — driven by weekly sums */
  const [edits, setEdits] = useState<Record<number, string>>({});
  /* per-week slot counts, keyed by lsKey */
  const [weekSlots, setWeekSlots] = useState<Record<string, number>>({});

  /* Weekly global data */
  const [weekPlacements, setWeekPlacements] = useState(0);
  const [weeklyLimit, setWeeklyLimit] = useState(10);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [weeklyInput, setWeeklyInput] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("planpermis_weekly_limit");
    if (stored) setWeeklyLimit(parseInt(stored));
  }, []);

  /* Load week slots from localStorage whenever year changes */
  useEffect(() => {
    const slots: Record<string, number> = {};
    MONTHS.forEach(m => {
      getWeeksOfMonth(year, m).forEach(w => {
        slots[w.lsKey] = parseInt(localStorage.getItem(w.lsKey) || "0");
      });
    });
    setWeekSlots(slots);
  }, [year]);

  const fetchMonths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/places-examen?year=${year}`);
      const data = await res.json();
      const list: ExamMonth[] = Array.isArray(data) ? data : [];
      setMonths(list);

      /* Build initial edits from week slot sums; fall back to server total if weeks untouched */
      setWeekSlots(prev => {
        const initialEdits: Record<number, string> = {};
        MONTHS.forEach(m => {
          const weeks = getWeeksOfMonth(year, m);
          let sum = 0;
          let anySet = false;
          weeks.forEach(w => {
            const v = prev[w.lsKey] ?? parseInt(localStorage.getItem(w.lsKey) || "0");
            sum += v;
            if (v > 0) anySet = true;
          });
          const server = list.find(x => x.month === m);
          initialEdits[m] = anySet ? String(sum) : (server ? String(server.totalSlots) : "0");
        });
        setEdits(initialEdits);
        return prev;
      });

      /* Fetch current week placements */
      const { start, end } = getCurrentWeekBounds();
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

  /* Update a single week slot and auto-recalculate its month total */
  function updateWeekSlot(lsKey: string, month: number, val: number) {
    localStorage.setItem(lsKey, String(val));
    setWeekSlots(prev => {
      const updated = { ...prev, [lsKey]: val };
      const sum = calcMonthSum(year, month, updated);
      setEdits(e => ({ ...e, [month]: String(sum) }));
      return updated;
    });
  }

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
        <div className="flex flex-wrap items-center gap-4 animate-fade-up">
          <div className="flex items-center gap-1 glass rounded-xl shadow-sm border border-white/60 p-1">
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-bold text-gray-900 dark:text-white w-14 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 glass rounded-xl px-4 py-2 shadow-sm">
              <span className="text-xs text-gray-500">Total {year}</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{totalSlots}</span>
            </div>
            <div className="flex items-center gap-2 bg-orange-50/80 dark:bg-orange-900/20 rounded-xl px-4 py-2">
              <span className="text-xs text-orange-500">Occupées</span>
              <span className="text-sm font-bold text-orange-600">{totalUsed}</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50/80 dark:bg-green-900/20 rounded-xl px-4 py-2">
              <span className="text-xs text-green-500">Disponibles</span>
              <span className="text-sm font-bold text-green-600">{totalAvailable}</span>
            </div>
          </div>
        </div>

        {/* ── Weekly counters ── */}
        <div className="flex flex-wrap gap-4 animate-fade-up-1">
          <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl px-6 py-4 flex flex-col items-center min-w-[160px] shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500/60 mb-1">Cette semaine · planifiés</span>
            <span className="text-2xl font-bold text-blue-600">{weekPlacements}</span>
            <span className="text-[10px] text-blue-400 mt-0.5">{weekAvailable} disponibles</span>
          </div>
          <div
            className="bg-green-50/80 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl px-6 py-4 flex flex-col items-center min-w-[160px] cursor-pointer shadow-sm"
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
                  onKeyDown={e => {
                    if (e.key === "Enter") saveWeeklyLimit(parseInt(weeklyInput) || 0);
                    if (e.key === "Escape") setEditingWeekly(false);
                  }}
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
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 animate-fade-up-2">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>Définissez le nombre de places par semaine. Le total mensuel est calculé automatiquement. Cliquez sur <strong>Enregistrer</strong> pour synchroniser avec le serveur.</p>
        </div>

        {/* Month grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MONTHS.map((month, idx) => {
              const data = getMonthData(month);
              const used = data?.usedSlots ?? 0;
              const available = Math.max(0, (data?.totalSlots ?? 0) - used);
              const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
              const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
              const fillRatio = data?.totalSlots ? used / data.totalSlots : 0;
              const weeks = getWeeksOfMonth(year, month);
              const monthTotal = parseInt(edits[month] || "0");

              return (
                <div
                  key={month}
                  className={`glass rounded-2xl shadow-sm border p-5 animate-fade-up ${
                    isCurrentMonth ? "border-blue-300/50 dark:border-blue-700 ring-2 ring-blue-500/20" : "border-white/60 dark:border-gray-800"
                  }`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{getMonthName(month)}</h3>
                    {isCurrentMonth && (
                      <span className="text-[10px] font-semibold bg-blue-500 text-white rounded-full px-2 py-0.5">Ce mois</span>
                    )}
                  </div>

                  {/* Progress bar (shows server-synced data) */}
                  {data && data.totalSlots > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-400">{used} occupée{used !== 1 ? "s" : ""}</span>
                        <span className={`font-semibold ${getSlotColor(used, data.totalSlots)}`}>{available} libre{available !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${fillRatio >= 1 ? "bg-red-500" : fillRatio >= 0.75 ? "bg-orange-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(fillRatio * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Weekly breakdown ── */}
                  <div className="mb-3 space-y-0.5">
                    {weeks.map((week, wi) => (
                      <WeekRow
                        key={week.lsKey}
                        lsKey={week.lsKey}
                        label={`S${wi + 1} · ${week.label}`}
                        value={weekSlots[week.lsKey] ?? 0}
                        onChange={val => !isPast && updateWeekSlot(week.lsKey, month, val)}
                      />
                    ))}
                  </div>

                  {/* Auto-calculated total + Save */}
                  <div className="border-t border-gray-100/80 dark:border-gray-700 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Total calculé</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{monthTotal} <span className="text-xs font-normal text-gray-400">places</span></p>
                      </div>
                      <button
                        disabled={isPast || saving === month}
                        onClick={() => handleSave(month)}
                        title="Enregistrer sur le serveur"
                        className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        {saving === month
                          ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          : <Save className="h-3.5 w-3.5" />}
                        {saving === month ? "..." : "Sauver"}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {isPast ? "Mois passé — lecture seule" : "Cliquez sur les semaines pour modifier"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
