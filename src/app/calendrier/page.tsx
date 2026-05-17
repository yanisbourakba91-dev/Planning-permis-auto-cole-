"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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

/* ─────────── Types ─────────── */
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
  year: number;
  month: number;
  totalSlots: number;
  usedSlots: number;
}
type DragData =
  | { kind: "student"; student: Student }
  | { kind: "placement"; placement: Placement };

/* ─────────── Constants ─────────── */
const TIME_SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

/* ─────────── Helpers ─────────── */
function weekStartOf(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}
function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function shiftWeek(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n * 7); return r;
}
function fmt2(n: number) { return String(n).padStart(2,"0"); }
function drivingDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return `${fmt2(d.getDate())}/${fmt2(d.getMonth()+1)}`;
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function getFirstOffset(y: number, m: number) {
  const d = new Date(y, m-1, 1).getDay(); return d === 0 ? 6 : d-1;
}
function initials(s: Student) {
  return ((s.firstName?.[0] ?? "") + (s.lastName?.[0] ?? "")).toUpperCase() || "?";
}
function fullName(s: { firstName: string; lastName: string }) {
  return s.firstName ? `${s.firstName} ${s.lastName}` : s.lastName;
}
function weekLabel(days: Date[]): string {
  const [f, l] = [days[0], days[6]];
  return f.getMonth() === l.getMonth()
    ? `${f.getDate()} – ${l.getDate()} ${MONTH_NAMES[f.getMonth()]} ${f.getFullYear()}`
    : `${f.getDate()} ${MONTH_NAMES[f.getMonth()]} – ${l.getDate()} ${MONTH_NAMES[l.getMonth()]} ${l.getFullYear()}`;
}

/* ─────────────────────────────────────────────
   DND COMPONENTS
   Key design: drag handle is SEPARATE from click area
   so browser's post-drag "click" event doesn't open modals.
───────────────────────────────────────────── */

/**
 * Queue card.
 * - Avatar = drag handle (gets dnd-kit listeners, no onClick)
 * - Text = click area (opens placement modal, no drag listeners)
 * This completely prevents the browser's post-drag click from triggering the modal.
 */
function QueueCard({
  student,
  onClickCard,
}: {
  student: Student;
  onClickCard: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `student-${student.id}`,
      data: { kind: "student", student } satisfies DragData,
    });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn(
        "bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700",
        "flex items-center gap-2 px-2 py-1.5 select-none",
        isDragging && "opacity-40"
      )}
    >
      {/* ── DRAG HANDLE: avatar circle ── */}
      <div
        {...listeners}
        {...attributes}
        style={{ touchAction: "none" }}
        title="Glisser vers un créneau"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 text-[10px] font-bold flex-shrink-0 cursor-grab active:cursor-grabbing"
      >
        {initials(student)}
      </div>

      {/* ── CLICK AREA: student info ── */}
      <button
        type="button"
        onClick={onClickCard}
        className="min-w-0 flex-1 text-left leading-tight"
      >
        <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 truncate">
          {fullName(student)}
        </p>
        <p className="text-[9px] text-gray-400 truncate">
          {student.drivingHours}h · {drivingDate(student.lastDrivingDate)}
        </p>
      </button>
    </div>
  );
}

/**
 * Existing placement chip inside a time slot.
 * - Whole chip is the drag handle.
 * - Uses dragJustEndedRef to suppress the post-drag click.
 */
function PlacementChip({
  placement,
  dragJustEndedRef,
  onClickChip,
}: {
  placement: Placement;
  dragJustEndedRef: React.RefObject<boolean>;
  onClickChip: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `placement-${placement.id}`,
      data: { kind: "placement", placement } satisfies DragData,
    });

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (dragJustEndedRef.current) return; // suppress click after drag
    onClickChip(e);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ touchAction: "none", ...(transform ? { transform: CSS.Translate.toString(transform) } : {}) }}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute inset-x-0.5 top-0.5 bottom-0.5 flex items-center px-1.5 rounded-lg z-10 select-none",
        "bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[10px] font-semibold shadow-sm",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30"
      )}
      onClick={handleClick}
    >
      <span className="truncate">{fullName(placement.student)}</span>
    </div>
  );
}

/**
 * Time slot — drop target.
 * Highlights blue when a draggable hovers over it.
 */
function TimeSlot({
  slotId,
  dateStr,
  time,
  children,
  onClickSlot,
  dragJustEndedRef,
}: {
  slotId: string;
  dateStr: string;
  time: string;
  children: React.ReactNode;
  onClickSlot: () => void;
  dragJustEndedRef: React.RefObject<boolean>;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: { dateStr, time },
  });

  function handleClick() {
    if (dragJustEndedRef.current) return; // suppress click fired after drop
    onClickSlot();
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-14 border-t border-gray-100 dark:border-gray-800/60 relative cursor-pointer transition-colors duration-75",
        isOver
          ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-500"
          : "hover:bg-gray-50/80 dark:hover:bg-gray-800/30"
      )}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

/* ─────────── Editable counter ─────────── */
function EditableCounter({
  label, value, sub, color, onSave,
}: {
  label: string; value: number | null; sub?: string;
  color: "blue" | "green"; onSave?: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const cls =
    color === "blue"
      ? "bg-blue-50 border border-blue-100 text-blue-600"
      : "bg-green-50 border border-green-100 text-green-600";

  function start() {
    if (!onSave) return;
    setInput(value !== null ? String(value) : "");
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 40);
  }
  function save() {
    const n = parseInt(input);
    if (!isNaN(n) && n >= 0 && onSave) onSave(n);
    setEditing(false);
  }

  return (
    <div
      className={cn("flex flex-col items-center px-5 py-3 rounded-2xl min-w-[150px] shadow-sm", cls, onSave && "cursor-pointer")}
      onClick={!editing ? start : undefined}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1 text-center leading-tight">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <input ref={ref} type="number" min={0} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="w-16 text-center text-2xl font-bold bg-transparent border-b-2 border-current focus:outline-none"
          />
          <button onClick={save}><Check className="h-4 w-4" /></button>
          <button onClick={() => setEditing(false)}><X className="h-3 w-3 opacity-50" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-bold">{value !== null ? value : "—"}</span>
          {onSave && <Pencil className="h-3 w-3 opacity-40" />}
        </div>
      )}
      {sub && <span className="text-[9px] opacity-50 mt-0.5 text-center leading-tight">{sub}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */
export default function CalendrierPage() {
  const { data: session } = useSession();
  const now = new Date();
  const todayKey = dateKey(now);

  const [view, setView] = useState<"week" | "month">("week");
  const [wStart, setWStart] = useState(() => weekStartOf(now));
  const [curYear, setCurYear] = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth() + 1);

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [monthData, setMonthData] = useState<ExamMonthData | null>(null);
  const [loading, setLoading] = useState(true);

  const [weeklyLimit, setWeeklyLimit] = useState(10);
  useEffect(() => {
    const s = localStorage.getItem("planpermis_weekly_limit");
    if (s) setWeeklyLimit(parseInt(s));
  }, []);
  function saveWeeklyLimit(v: number) {
    setWeeklyLimit(v);
    localStorage.setItem("planpermis_weekly_limit", String(v));
  }

  /* Single PointerSensor — handles mouse + touch */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* Track if a drag just ended so PlacementChip can suppress the post-drag click */
  const dragJustEndedRef = useRef(false);

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  /* Modals */
  type ModalKind = "add" | "detail" | "queue" | "newStudent" | null;
  const [modal, setModal] = useState<ModalKind>(null);
  const [selPlacement, setSelPlacement] = useState<Placement | null>(null);
  const [queueStu, setQueueStu] = useState<Student | null>(null);
  const [pForm, setPForm] = useState({ studentId: "", date: "", time: "09:00", instructor: "", examCenter: "", notes: "" });
  const [sForm, setSForm] = useState({ firstName: "", lastName: "", email: "", phone: "", drivingHours: "0", lastDrivingDate: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  /* ── Data fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = weekDays(wStart);
      const uniqMonths = [
        ...new Map(days.map(d => [
          `${d.getFullYear()}-${d.getMonth()+1}`,
          { year: d.getFullYear(), month: d.getMonth()+1 },
        ])).values(),
      ];
      const activeYear = view === "week" ? wStart.getFullYear() : curYear;
      const activeMonth = view === "week" ? wStart.getMonth()+1 : curMonth;
      const placeFetches = view === "week"
        ? uniqMonths.map(({ year, month }) =>
            fetch(`/api/placements?year=${year}&month=${month}`).then(r => r.json()))
        : [fetch(`/api/placements?year=${curYear}&month=${curMonth}`).then(r => r.json())];

      const [stuData, allMonths, ...pArrays] = await Promise.all([
        fetch("/api/eleves").then(r => r.json()),
        fetch(`/api/places-examen?year=${activeYear}`).then(r => r.json()),
        ...placeFetches,
      ]);
      const all = (pArrays.flat() as unknown[]).filter(
        (p): p is Placement => !!p && typeof p === "object" && "id" in (p as object)
      );
      setPlacements(all);
      setStudents(Array.isArray(stuData) ? stuData : []);
      const found = Array.isArray(allMonths)
        ? (allMonths as ExamMonthData[]).find(m => m.month === activeMonth && m.year === activeYear) ?? null
        : null;
      setMonthData(found);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [wStart, curYear, curMonth, view]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveMonthlyTotal(v: number) {
    const ay = view === "week" ? wStart.getFullYear() : curYear;
    const am = view === "week" ? wStart.getMonth()+1 : curMonth;
    const res = await fetch("/api/places-examen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: ay, month: am, totalSlots: v }),
    });
    if (res.ok) setMonthData(await res.json());
  }

  /* ── Navigation ── */
  function prev() {
    if (view === "week") { setWStart(s => shiftWeek(s, -1)); return; }
    if (curMonth === 1) { setCurMonth(12); setCurYear(y => y-1); }
    else setCurMonth(m => m-1);
  }
  function next() {
    if (view === "week") { setWStart(s => shiftWeek(s, 1)); return; }
    if (curMonth === 12) { setCurMonth(1); setCurYear(y => y+1); }
    else setCurMonth(m => m+1);
  }
  function goToday() {
    setWStart(weekStartOf(now));
    setCurYear(now.getFullYear());
    setCurMonth(now.getMonth()+1);
  }

  /* ── DnD ── */
  function handleDragStart({ active }: DragStartEvent) {
    setActiveDrag(active.data.current as DragData);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDrag(null);

    /* Mark drag-just-ended so PlacementChip suppresses the upcoming click */
    dragJustEndedRef.current = true;
    setTimeout(() => { dragJustEndedRef.current = false; }, 200);

    if (!over) return;

    const src = active.data.current as DragData | undefined;
    const dst = over.data.current as { dateStr: string; time: string } | undefined;
    if (!src || !dst?.dateStr || !dst?.time) return;

    if (src.kind === "student") {
      /* Drop queue student onto a slot → pre-fill placement modal */
      setPForm({
        studentId: src.student.id,
        date: dst.dateStr,
        time: dst.time,
        instructor: "",
        examCenter: "",
        notes: "",
      });
      setQueueStu(null);
      setFormError("");
      setModal("add");
    } else if (src.kind === "placement") {
      /* Move existing placement to another slot */
      const p = src.placement;
      if (p.date.slice(0, 10) !== dst.dateStr || p.time !== dst.time) {
        fetch(`/api/placements/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dst.dateStr, time: dst.time }),
        })
          .then(() => fetchData())
          .catch(() => { /* silent */ });
      }
    }
  }

  /* ── Modal helpers ── */
  function openFromSlot(d: string, t: string) {
    setQueueStu(null);
    setPForm({ studentId: "", date: d, time: t, instructor: "", examCenter: "", notes: "" });
    setFormError("");
    setModal("add");
  }
  function openFromQueue(s: Student) {
    setQueueStu(s);
    setPForm({ studentId: s.id, date: "", time: "09:00", instructor: "", examCenter: "", notes: "" });
    setFormError("");
    setModal("add");
  }
  function openDetail(p: Placement) { setSelPlacement(p); setModal("detail"); }
  function closeModal() { setModal(null); setSelPlacement(null); setQueueStu(null); setFormError(""); }

  /* ── Form submits ── */
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
          ...sForm,
          drivingHours: parseFloat(sForm.drivingHours) || 0,
          lastDrivingDate: sForm.lastDrivingDate || null,
          email: sForm.email || undefined,
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
    try { await fetch(`/api/placements/${id}`, { method: "DELETE" }); closeModal(); fetchData(); }
    catch { setFormError("Erreur serveur"); }
    finally { setFormLoading(false); }
  }

  /* ── Derived ── */
  const days = weekDays(wStart);
  const wKeys = new Set(days.map(dateKey));
  const weekCount = placements.filter(p => wKeys.has(p.date.slice(0,10))).length;
  const monthAvailable = monthData ? Math.max(0, monthData.totalSlots - monthData.usedSlots) : null;
  const bySlot = new Map<string, Placement[]>();
  placements.forEach(p => {
    const k = `${p.date.slice(0,10)}:${p.time}`;
    bySlot.set(k, [...(bySlot.get(k) ?? []), p]);
  });
  const studentOptions = students.map(s => ({ value: s.id, label: fullName(s) }));

  /* ═══════════ RENDER ═══════════ */
  return (
    <AppLayout title="Calendrier" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>

      {/* DndContext wraps ONLY the calendar. Modals are intentionally outside. */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 57px)" }}>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-1">
              <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[210px] text-center">
                {view === "week" ? weekLabel(days) : `${MONTH_NAMES[curMonth-1]} ${curYear}`}
              </span>
              <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={goToday} className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
              Aujourd'hui
            </button>
            <div className="flex rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-1 ml-auto">
              <button onClick={() => setView("week")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", view === "week" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                <AlignJustify className="h-3.5 w-3.5" /> Semaine
              </button>
              <button onClick={() => setView("month")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", view === "month" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                <LayoutGrid className="h-3.5 w-3.5" /> Mois
              </button>
            </div>
          </div>

          {/* Counters */}
          {view === "week" && (
            <div className="flex gap-3 flex-wrap flex-shrink-0">
              <EditableCounter label="Places restantes ce mois" value={monthAvailable}
                sub={monthData ? `sur ${monthData.totalSlots} · cliquer` : "Cliquer pour définir"}
                color="blue" onSave={saveMonthlyTotal} />
              <EditableCounter label="Places cette semaine" value={Math.max(0, weeklyLimit - weekCount)}
                sub={`${weekCount} planifié${weekCount !== 1 ? "s" : ""} · limite ${weeklyLimit} · cliquer`}
                color="green" onSave={saveWeeklyLimit} />
            </div>
          )}

          {/* Calendar */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>

          ) : view === "week" ? (

            /* ══ WEEK VIEW ══ */
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0">

              {/* Day headers */}
              <div className="flex border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 flex-shrink-0">
                <div className="w-14 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />
                {days.map((day, di) => {
                  const dk = dateKey(day);
                  const isToday = dk === todayKey;
                  return (
                    <div key={dk} className={cn("flex-1 min-w-0 flex flex-col items-center py-2.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0", isToday && "bg-blue-50/60")}>
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest", isToday ? "text-blue-500" : "text-gray-400")}>
                        {DAYS_SHORT[di]}
                      </span>
                      <span className={cn("mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold", isToday ? "bg-blue-500 text-white shadow-sm" : "text-gray-800 dark:text-gray-200")}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
                <div className="w-44 flex-shrink-0 border-l-2 border-blue-100 dark:border-blue-900/50 bg-blue-50/30 flex items-center justify-between px-3 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">File d'attente</span>
                  <button
                    onClick={() => { setFormError(""); setModal("queue"); }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex flex-1 overflow-y-auto min-h-0">
                {/* Time labels */}
                <div className="w-14 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50/30">
                  {TIME_SLOTS.map(t => (
                    <div key={t} className="h-14 flex items-start justify-center pt-1.5 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] font-medium text-gray-400">{t}</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {days.map(day => {
                  const dk = dateKey(day);
                  const isToday = dk === todayKey;
                  return (
                    <div key={dk} className={cn("flex-1 min-w-0 border-r border-gray-100 dark:border-gray-800 last:border-r-0", isToday && "bg-blue-50/20")}>
                      {TIME_SLOTS.map(time => {
                        const slotId = `${dk}:${time}`;
                        const slotPlacements = bySlot.get(slotId) ?? [];
                        return (
                          <TimeSlot
                            key={time}
                            slotId={slotId}
                            dateStr={dk}
                            time={time}
                            onClickSlot={() => openFromSlot(dk, time)}
                            dragJustEndedRef={dragJustEndedRef}
                          >
                            {slotPlacements.map(p => (
                              <PlacementChip
                                key={p.id}
                                placement={p}
                                dragJustEndedRef={dragJustEndedRef}
                                onClickChip={e => { e.stopPropagation(); openDetail(p); }}
                              />
                            ))}
                          </TimeSlot>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Queue column */}
                <div className="w-44 flex-shrink-0 border-l-2 border-blue-100 dark:border-blue-900/50 bg-blue-50/20 overflow-y-auto p-2 space-y-1.5">
                  {students.length === 0 ? (
                    <div className="h-24 flex flex-col items-center justify-center text-center gap-1">
                      <p className="text-xs text-gray-400">Aucun élève</p>
                      <button onClick={() => setModal("queue")} className="text-xs text-blue-500 underline">Ajouter</button>
                    </div>
                  ) : (
                    students.map(s => (
                      <QueueCard key={s.id} student={s} onClickCard={() => openFromQueue(s)} />
                    ))
                  )}
                </div>
              </div>
            </div>

          ) : (

            /* ══ MONTH VIEW ══ */
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="grid grid-cols-7 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50/50">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: getFirstOffset(curYear, curMonth) }).map((_, i) => (
                  <div key={`e-${i}`} className="h-24 border-b border-r border-gray-50 dark:border-gray-800 bg-gray-50/30" />
                ))}
                {Array.from({ length: getDaysInMonth(curYear, curMonth) }).map((_, i) => {
                  const day = i + 1;
                  const dk = `${curYear}-${fmt2(curMonth)}-${fmt2(day)}`;
                  const dayPlacements = placements.filter(p => p.date.slice(0,10) === dk);
                  const isToday = dk === todayKey;
                  return (
                    <div key={day}
                      onClick={() => { setView("week"); setWStart(weekStartOf(new Date(curYear, curMonth-1, day))); }}
                      className={cn("h-24 border-b border-r border-gray-100 dark:border-gray-800 p-1.5 cursor-pointer hover:bg-blue-50/30 transition-colors", isToday && "bg-blue-50/40")}
                    >
                      <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", isToday ? "bg-blue-500 text-white" : "text-gray-700 dark:text-gray-300")}>
                        {day}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayPlacements.slice(0, 2).map(p => (
                          <div key={p.id}
                            onClick={e => { e.stopPropagation(); openDetail(p); }}
                            className="text-[9px] font-semibold text-white bg-blue-500 rounded px-1 py-0.5 truncate"
                          >
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

        {/* Drag ghost — z-index 999 by default in dnd-kit */}
        <DragOverlay dropAnimation={null}>
          {activeDrag?.kind === "student" && (
            <div className="bg-white rounded-xl shadow-2xl border border-blue-200 p-2 w-40 rotate-2 opacity-95 pointer-events-none">
              <div className="flex items-center gap-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                  {initials(activeDrag.student)}
                </div>
                <span className="text-[11px] font-semibold text-gray-900 truncate">
                  {fullName(activeDrag.student)}
                </span>
              </div>
            </div>
          )}
          {activeDrag?.kind === "placement" && (
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[10px] font-semibold rounded-lg px-2 py-1.5 shadow-2xl rotate-1 opacity-95 pointer-events-none">
              {fullName(activeDrag.placement.student)}
            </div>
          )}
        </DragOverlay>

      </DndContext>

      {/* ══ Modals (outside DndContext — intentional) ══ */}

      <Modal open={modal === "add"} onClose={closeModal} title={queueStu ? `Placer ${fullName(queueStu)}` : "Placer un élève"}>
        <form onSubmit={submitPlacement} className="space-y-4 mt-2">
          {!queueStu && (
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
            <button type="submit" disabled={formLoading} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {formLoading ? "Enregistrement..." : "Confirmer"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "detail"} onClose={closeModal} title="Détail du placement">
        {selPlacement && (
          <div className="space-y-3 mt-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2.5">
              {([
                ["Élève", fullName(selPlacement.student)],
                ["Date", new Date(selPlacement.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })],
                ["Heure", selPlacement.time],
                ...(selPlacement.instructor ? [["Moniteur", selPlacement.instructor]] : []),
                ...(selPlacement.examCenter ? [["Centre", selPlacement.examCenter]] : []),
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">{val}</span>
                </div>
              ))}
              {selPlacement.notes && <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">{selPlacement.notes}</div>}
            </div>
            <button onClick={() => deletePlacement(selPlacement.id)} disabled={formLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
              <Trash2 className="h-4 w-4" />
              {formLoading ? "Suppression..." : "Supprimer ce placement"}
            </button>
          </div>
        )}
      </Modal>

      <Modal open={modal === "queue"} onClose={closeModal} title="Ajouter à la file d'attente">
        <div className="mt-3 space-y-3">
          <button onClick={() => setModal("newStudent")}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-500">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nouvel élève</p>
              <p className="text-xs text-gray-500">Créer et ajouter un nouvel élève</p>
            </div>
          </button>
          {students.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Élèves existants</p>
              {students.map(s => (
                <button key={s.id} onClick={() => openFromQueue(s)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500 text-xs font-bold flex-shrink-0">{initials(s)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{fullName(s)}</p>
                    <p className="text-xs text-gray-400">{s.drivingHours}h · {drivingDate(s.lastDrivingDate)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

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
            <button type="submit" disabled={formLoading} className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {formLoading ? "Création..." : "Créer l'élève"}
            </button>
          </div>
        </form>
      </Modal>

    </AppLayout>
  );
}
