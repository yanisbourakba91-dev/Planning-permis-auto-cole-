"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/app-layout";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  AlignJustify, LayoutGrid, Pencil, Check, X,
} from "lucide-react";

/* ── Types ── */
interface Placement {
  id: string;
  date: string;
  time: string;
  instructor: string;
  examCenter: string;
  notes?: string;
  student: { id: string; firstName: string; lastName: string };
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  drivingHours: number;
  lastDrivingDate: string | null;
}
interface ExamMonthData {
  id?: string;
  year: number;
  month: number;
  totalSlots: number;
  usedSlots: number;
}
type DragInfo =
  | { kind: "queue"; student: Student }
  | { kind: "placement"; placement: Placement };

/* ── Constants ── */
const TIME_SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

/* ── Helpers ── */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shiftWeek(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}
function drivingDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function getFirstOffset(y: number, m: number) {
  const d = new Date(y, m - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function initials(s: Student): string {
  return ((s.firstName?.[0] || "") + (s.lastName?.[0] || "")).toUpperCase() || "?";
}
function getWeekLabel(days: Date[]): string {
  const first = days[0];
  const last = days[6];
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
}

/* ── Editable counter ── */
function EditableCounter({
  label, value, sub, color, onSave,
}: {
  label: string;
  value: number | null;
  sub?: string;
  color: "blue" | "green" | "orange";
  onSave?: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const colorMap = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400",
    green: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400",
    orange: "text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400",
  };

  function startEdit() {
    if (!onSave) return;
    setInput(value !== null ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function save() {
    const n = parseInt(input);
    if (!isNaN(n) && n >= 0 && onSave) onSave(n);
    setEditing(false);
  }

  return (
    <div
      className={cn("flex flex-col items-center justify-center px-5 py-3 rounded-2xl min-w-[160px]", colorMap[color], onSave && "cursor-pointer")}
      onClick={!editing ? startEdit : undefined}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-60 mb-1 text-center">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="number"
            min={0}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="w-16 text-center text-2xl font-bold bg-transparent border-b-2 border-current focus:outline-none"
          />
          <button onClick={save} className="opacity-70 hover:opacity-100"><Check className="h-4 w-4" /></button>
          <button onClick={() => setEditing(false)} className="opacity-50 hover:opacity-80"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-bold">{value !== null ? value : "—"}</span>
          {onSave && <Pencil className="h-3 w-3 opacity-40" />}
        </div>
      )}
      {sub && <span className="text-[10px] opacity-50 mt-0.5 text-center">{sub}</span>}
    </div>
  );
}

/* ── Main page ── */
export default function CalendrierPage() {
  const { data: session } = useSession();
  const now = new Date();
  const todayKey = toKey(now);

  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(now));
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [monthData, setMonthData] = useState<ExamMonthData | null>(null);
  const [loading, setLoading] = useState(true);

  /* Drag & drop */
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragCounters = useRef<Map<string, number>>(new Map());

  /* Weekly limit (localStorage) */
  const [weeklyLimit, setWeeklyLimit] = useState<number>(10);
  useEffect(() => {
    const stored = localStorage.getItem("planpermis_weekly_limit");
    if (stored) setWeeklyLimit(parseInt(stored));
  }, []);
  function saveWeeklyLimit(v: number) {
    setWeeklyLimit(v);
    localStorage.setItem("planpermis_weekly_limit", String(v));
  }

  type ModalType = "add" | "detail" | "queue" | "newStudent" | null;
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null);
  const [queueStudent, setQueueStudent] = useState<Student | null>(null);

  const [pForm, setPForm] = useState({ studentId: "", date: "", time: "09:00", instructor: "", examCenter: "", notes: "" });
  const [sForm, setSForm] = useState({ firstName: "", lastName: "", email: "", phone: "", drivingHours: "0", lastDrivingDate: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const weekDays = getWeekDays(weekStart);
      const uniqMonths = [
        ...new Map(
          weekDays.map(d => [`${d.getFullYear()}-${d.getMonth() + 1}`, { year: d.getFullYear(), month: d.getMonth() + 1 }])
        ).values(),
      ];
      const activeYear = view === "week" ? weekStart.getFullYear() : currentYear;
      const activeMonth = view === "week" ? weekStart.getMonth() + 1 : currentMonth;

      const placementFetches =
        view === "week"
          ? uniqMonths.map(({ year, month }) =>
              fetch(`/api/placements?year=${year}&month=${month}`).then(r => r.json())
            )
          : [fetch(`/api/placements?year=${currentYear}&month=${currentMonth}`).then(r => r.json())];

      const [studentsData, allMonthsData, ...placementArrays] = await Promise.all([
        fetch("/api/eleves").then(r => r.json()),
        fetch(`/api/places-examen?year=${activeYear}`).then(r => r.json()),
        ...placementFetches,
      ]);

      const all = (placementArrays.flat() as unknown[]).filter(
        (p): p is Placement => !!p && typeof p === "object" && "id" in (p as object)
      );
      setPlacements(all);
      setStudents(Array.isArray(studentsData) ? studentsData : []);

      const found = Array.isArray(allMonthsData)
        ? (allMonthsData as ExamMonthData[]).find(m => m.month === activeMonth && m.year === activeYear) || null
        : null;
      setMonthData(found);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [weekStart, currentYear, currentMonth, view]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Save monthly total ── */
  async function saveMonthlyTotal(v: number) {
    const activeYear = view === "week" ? weekStart.getFullYear() : currentYear;
    const activeMonth = view === "week" ? weekStart.getMonth() + 1 : currentMonth;
    const res = await fetch("/api/places-examen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: activeYear, month: activeMonth, totalSlots: v }),
    });
    if (res.ok) setMonthData(await res.json());
  }

  /* ── Navigation ── */
  function prev() {
    if (view === "week") { setWeekStart(s => shiftWeek(s, -1)); return; }
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }
  function next() {
    if (view === "week") { setWeekStart(s => shiftWeek(s, 1)); return; }
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }
  function goToday() {
    setWeekStart(getWeekStart(now));
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  }

  /* ── Drag handlers ── */
  function onDragEnd() {
    setDragInfo(null);
    setDropTarget(null);
    dragCounters.current.clear();
  }
  function onSlotDragOver(e: React.DragEvent, slotKey: string) {
    e.preventDefault();
    if (dropTarget !== slotKey) setDropTarget(slotKey);
  }
  function onSlotDragEnter(slotKey: string) {
    dragCounters.current.set(slotKey, (dragCounters.current.get(slotKey) || 0) + 1);
    setDropTarget(slotKey);
  }
  function onSlotDragLeave(slotKey: string) {
    const c = (dragCounters.current.get(slotKey) || 1) - 1;
    dragCounters.current.set(slotKey, c);
    if (c <= 0) setDropTarget(t => t === slotKey ? null : t);
  }
  function onSlotDrop(e: React.DragEvent, dateStr: string, time: string) {
    e.preventDefault();
    const slotKey = `${dateStr}:${time}`;
    dragCounters.current.set(slotKey, 0);
    setDropTarget(null);
    if (!dragInfo) return;
    if (dragInfo.kind === "queue") {
      setPForm({ studentId: dragInfo.student.id, date: dateStr, time, instructor: "", examCenter: "", notes: "" });
      setQueueStudent(null);
      setFormError("");
      setModal("add");
    } else {
      const p = dragInfo.placement;
      if (p.date.slice(0, 10) !== dateStr || p.time !== time) {
        moveExistingPlacement(p.id, dateStr, time);
      }
    }
    setDragInfo(null);
  }

  async function moveExistingPlacement(id: string, date: string, time: string) {
    try {
      await fetch(`/api/placements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      fetchData();
    } catch { /* silent */ }
  }

  /* ── Modal helpers ── */
  function openFromSlot(dateStr: string, time: string) {
    if (dragInfo) return;
    setQueueStudent(null);
    setPForm({ studentId: "", date: dateStr, time, instructor: "", examCenter: "", notes: "" });
    setFormError("");
    setModal("add");
  }
  function openFromQueue(s: Student) {
    setQueueStudent(s);
    setPForm({ studentId: s.id, date: "", time: "09:00", instructor: "", examCenter: "", notes: "" });
    setFormError("");
    setModal("add");
  }
  function openDetail(p: Placement) { setSelectedPlacement(p); setModal("detail"); }
  function closeModal() { setModal(null); setSelectedPlacement(null); setQueueStudent(null); setFormError(""); }

  /* ── Submits ── */
  async function submitPlacement(e: React.FormEvent) {
    e.preventDefault();
    if (!pForm.studentId || !pForm.date || !pForm.time) { setFormError("Élève, date et heure requis"); return; }
    setFormLoading(true); setFormError("");
    try {
      const res = await fetch("/api/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pForm),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Erreur"); return; }
      closeModal(); fetchData();
    } catch { setFormError("Erreur serveur"); }
    finally { setFormLoading(false); }
  }

  async function submitStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!sForm.lastName.trim()) { setFormError("Le nom est requis"); return; }
    setFormLoading(true); setFormError("");
    try {
      const res = await fetch("/api/eleves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: sForm.firstName,
          lastName: sForm.lastName,
          email: sForm.email || undefined,
          phone: sForm.phone || undefined,
          drivingHours: parseFloat(sForm.drivingHours) || 0,
          lastDrivingDate: sForm.lastDrivingDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Erreur"); return; }
      setModal("queue");
      setSForm({ firstName: "", lastName: "", email: "", phone: "", drivingHours: "0", lastDrivingDate: "" });
      fetchData();
    } catch { setFormError("Erreur serveur"); }
    finally { setFormLoading(false); }
  }

  async function deletePlacement(id: string) {
    setFormLoading(true);
    try {
      await fetch(`/api/placements/${id}`, { method: "DELETE" });
      closeModal(); fetchData();
    } catch { setFormError("Erreur serveur"); }
    finally { setFormLoading(false); }
  }

  /* ── Derived data ── */
  const weekDays = getWeekDays(weekStart);
  const weekKeys = new Set(weekDays.map(toKey));
  const weekPlacementsCount = placements.filter(p => weekKeys.has(p.date.slice(0, 10))).length;
  const weekAvailable = Math.max(0, weeklyLimit - weekPlacementsCount);
  const monthAvailable = monthData ? Math.max(0, monthData.totalSlots - monthData.usedSlots) : null;
  const isDragging = dragInfo !== null;

  const bySlot = new Map<string, Placement[]>();
  placements.forEach(p => {
    const key = `${p.date.slice(0, 10)}:${p.time}`;
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(p);
  });

  const studentOptions = students.map(s => ({
    value: s.id,
    label: `${s.firstName ? s.firstName + " " : ""}${s.lastName}`.trim(),
  }));

  return (
    <AppLayout title="Calendrier" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 57px)" }}>

        {/* ── Top controls ── */}
        <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-1">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[200px] text-center">
              {view === "week" ? getWeekLabel(weekDays) : `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}
            </span>
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={goToday} className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-colors">
            Aujourd'hui
          </button>
          <div className="flex rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-1 ml-auto">
            <button
              onClick={() => setView("week")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", view === "week" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              <AlignJustify className="h-3.5 w-3.5" /> Semaine
            </button>
            <button
              onClick={() => setView("month")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", view === "month" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Mois
            </button>
          </div>
        </div>

        {/* ── Counters (week view only) ── */}
        {view === "week" && (
          <div className="flex gap-3 flex-wrap flex-shrink-0">
            <EditableCounter
              label="Places restantes ce mois"
              value={monthAvailable}
              sub={monthData ? `sur ${monthData.totalSlots} au total · cliquer pour modifier` : "Cliquer pour définir le total"}
              color="blue"
              onSave={saveMonthlyTotal}
            />
            <EditableCounter
              label="Places disponibles cette semaine"
              value={weekAvailable}
              sub={`${weekPlacementsCount} planifié${weekPlacementsCount !== 1 ? "s" : ""} · limite : ${weeklyLimit} · cliquer pour modifier`}
              color="green"
              onSave={saveWeeklyLimit}
            />
          </div>
        )}

        {/* ── Views ── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : view === "week" ? (
          /* WEEK VIEW */
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col min-h-0">
            {/* Day headers */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="w-14 flex-shrink-0" />
              {weekDays.map((day, di) => {
                const dKey = toKey(day);
                const isToday = dKey === todayKey;
                return (
                  <div key={dKey} className="flex-1 min-w-0 flex flex-col items-center py-2 border-l border-gray-100 dark:border-gray-800">
                    <span className={cn("text-[11px] font-semibold uppercase tracking-wider", isToday ? "text-blue-500" : "text-gray-400")}>
                      {DAYS_SHORT[di]}
                    </span>
                    <span className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold", isToday ? "bg-blue-500 text-white" : "text-gray-800 dark:text-gray-200")}>
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}
              <div className="w-40 flex-shrink-0 border-l-2 border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">File d'attente</span>
                <button
                  onClick={() => { setFormError(""); setModal("queue"); }}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-y-auto min-h-0">
              {/* Time labels */}
              <div className="w-14 flex-shrink-0 border-r border-gray-100 dark:border-gray-800">
                {TIME_SLOTS.map(t => (
                  <div key={t} className="h-14 flex items-center justify-center">
                    <span className="text-[10px] text-gray-400">{t}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map(day => {
                const dKey = toKey(day);
                return (
                  <div key={dKey} className="flex-1 min-w-0 border-l border-gray-100 dark:border-gray-800">
                    {TIME_SLOTS.map(time => {
                      const slotKey = `${dKey}:${time}`;
                      const slotPlacements = bySlot.get(slotKey) || [];
                      const isTarget = dropTarget === slotKey && isDragging;
                      return (
                        <div
                          key={time}
                          className={cn(
                            "h-14 border-t border-gray-50 dark:border-gray-800/50 relative transition-colors select-none",
                            isTarget ? "bg-blue-50 dark:bg-blue-900/20" : isDragging ? "hover:bg-blue-50/50" : "hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                          )}
                          onClick={() => openFromSlot(dKey, time)}
                          onDragOver={e => onSlotDragOver(e, slotKey)}
                          onDragEnter={() => onSlotDragEnter(slotKey)}
                          onDragLeave={() => onSlotDragLeave(slotKey)}
                          onDrop={e => onSlotDrop(e, dKey, time)}
                        >
                          {isTarget && <div className="absolute inset-0 border-2 border-blue-400 rounded pointer-events-none z-10" />}
                          {slotPlacements.map(p => (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={e => { e.stopPropagation(); setDragInfo({ kind: "placement", placement: p }); }}
                              onDragEnd={onDragEnd}
                              onClick={e => { e.stopPropagation(); openDetail(p); }}
                              className={cn(
                                "absolute inset-x-0.5 top-0.5 bottom-0.5 flex items-center px-1.5 rounded-lg text-[10px] font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm cursor-pointer select-none transition-opacity z-10",
                                "hover:from-blue-600 hover:to-blue-700",
                                dragInfo?.kind === "placement" && dragInfo.placement.id === p.id ? "opacity-40" : "opacity-100"
                              )}
                            >
                              <span className="truncate">{p.student.firstName ? `${p.student.firstName} ${p.student.lastName}` : p.student.lastName}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Queue column */}
              <div className="w-40 flex-shrink-0 border-l-2 border-gray-200 dark:border-gray-700 overflow-y-auto p-2 space-y-1.5">
                {students.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-xs text-gray-400">Aucun élève</p>
                    <button onClick={() => setModal("queue")} className="mt-2 text-xs text-blue-500 underline">Ajouter</button>
                  </div>
                ) : students.map(s => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDragInfo({ kind: "queue", student: s })}
                    onDragEnd={onDragEnd}
                    onClick={() => openFromQueue(s)}
                    className={cn(
                      "bg-gray-50 dark:bg-gray-800 rounded-xl p-2 cursor-grab active:cursor-grabbing select-none transition-all",
                      "hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600",
                      dragInfo?.kind === "queue" && dragInfo.student.id === s.id ? "opacity-40 scale-95" : "opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-[10px] font-bold flex-shrink-0">
                        {initials(s)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {s.firstName ? `${s.firstName} ${s.lastName}` : s.lastName}
                        </p>
                        <p className="text-[9px] text-gray-400 truncate">{s.drivingHours}h · {drivingDate(s.lastDrivingDate)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* MONTH VIEW */
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
              {DAYS_SHORT.map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: getFirstOffset(currentYear, currentMonth) }).map((_, i) => (
                <div key={`e-${i}`} className="h-20 border-b border-r border-gray-50 dark:border-gray-800" />
              ))}
              {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, i) => {
                const day = i + 1;
                const dKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayPlacements = placements.filter(p => p.date.slice(0, 10) === dKey);
                const isToday = dKey === todayKey;
                return (
                  <div
                    key={day}
                    onClick={() => {
                      setView("week");
                      setWeekStart(getWeekStart(new Date(currentYear, currentMonth - 1, day)));
                    }}
                    className="h-20 border-b border-r border-gray-50 dark:border-gray-800 p-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", isToday ? "bg-blue-500 text-white" : "text-gray-700 dark:text-gray-300")}>
                      {day}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayPlacements.slice(0, 2).map(p => (
                        <div key={p.id} onClick={e => { e.stopPropagation(); openDetail(p); }} className="text-[9px] font-semibold text-white bg-blue-500 rounded px-1 py-0.5 truncate">
                          {p.time} {p.student.lastName}
                        </div>
                      ))}
                      {dayPlacements.length > 2 && <div className="text-[9px] text-gray-400">+{dayPlacements.length - 2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Placement Modal ── */}
      <Modal open={modal === "add"} onClose={closeModal} title={queueStudent ? `Placer ${queueStudent.firstName ? `${queueStudent.firstName} ${queueStudent.lastName}` : queueStudent.lastName}` : "Placer un élève"}>
        <form onSubmit={submitPlacement} className="space-y-4 mt-2">
          {!queueStudent && (
            <Select label="Élève *" value={pForm.studentId} onChange={e => setPForm(f => ({ ...f, studentId: e.target.value }))} required>
              <option value="">Sélectionner un élève</option>
              {studentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date *" type="date" value={pForm.date} onChange={e => setPForm(f => ({ ...f, date: e.target.value }))} required />
            <Select label="Heure *" value={pForm.time} onChange={e => setPForm(f => ({ ...f, time: e.target.value }))} required>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Moniteur" value={pForm.instructor} onChange={e => setPForm(f => ({ ...f, instructor: e.target.value }))} placeholder="Optionnel" />
            <Input label="Centre d'examen" value={pForm.examCenter} onChange={e => setPForm(f => ({ ...f, examCenter: e.target.value }))} placeholder="Optionnel" />
          </div>
          <Textarea label="Notes" value={pForm.notes} onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optionnel" />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
            <button type="submit" disabled={formLoading} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">{formLoading ? "Enregistrement..." : "Confirmer"}</button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={modal === "detail"} onClose={closeModal} title="Détail du placement">
        {selectedPlacement && (
          <div className="space-y-3 mt-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2.5">
              {[
                ["Élève", `${selectedPlacement.student.firstName} ${selectedPlacement.student.lastName}`.trim()],
                ["Date", new Date(selectedPlacement.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })],
                ["Heure", selectedPlacement.time],
                ...(selectedPlacement.instructor ? [["Moniteur", selectedPlacement.instructor]] : []),
                ...(selectedPlacement.examCenter ? [["Centre", selectedPlacement.examCenter]] : []),
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-right max-w-[60%]">{val}</span>
                </div>
              ))}
              {selectedPlacement.notes && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">{selectedPlacement.notes}</div>
              )}
            </div>
            <button
              onClick={() => deletePlacement(selectedPlacement.id)}
              disabled={formLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              {formLoading ? "Suppression..." : "Supprimer ce placement"}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Queue Modal ── */}
      <Modal open={modal === "queue"} onClose={closeModal} title="Ajouter à la file d'attente">
        <div className="mt-3 space-y-3">
          <button
            onClick={() => setModal("newStudent")}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nouvel élève</p>
              <p className="text-xs text-gray-500">Créer et ajouter un nouvel élève</p>
            </div>
          </button>
          {students.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Élèves existants</p>
              {students.map(s => (
                <button key={s.id} onClick={() => openFromQueue(s)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-xs font-bold flex-shrink-0">{initials(s)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.firstName ? `${s.firstName} ${s.lastName}` : s.lastName}</p>
                    <p className="text-xs text-gray-400">{s.drivingHours}h · {drivingDate(s.lastDrivingDate)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── New Student Modal ── */}
      <Modal open={modal === "newStudent"} onClose={closeModal} title="Nouvel élève">
        <form onSubmit={submitStudent} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" placeholder="Jean" value={sForm.firstName} onChange={e => setSForm(f => ({ ...f, firstName: e.target.value }))} />
            <Input label="Nom *" placeholder="Dupont" value={sForm.lastName} onChange={e => setSForm(f => ({ ...f, lastName: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={sForm.email} onChange={e => setSForm(f => ({ ...f, email: e.target.value }))} placeholder="Optionnel" />
            <Input label="Téléphone" type="tel" value={sForm.phone} onChange={e => setSForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optionnel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Heures de conduite" type="number" min="0" step="0.5" value={sForm.drivingHours} onChange={e => setSForm(f => ({ ...f, drivingHours: e.target.value }))} />
            <Input label="Dernière heure de conduite" type="date" value={sForm.lastDrivingDate} onChange={e => setSForm(f => ({ ...f, lastDrivingDate: e.target.value }))} />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModal("queue")} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Retour</button>
            <button type="submit" disabled={formLoading} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">{formLoading ? "Création..." : "Créer l'élève"}</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
