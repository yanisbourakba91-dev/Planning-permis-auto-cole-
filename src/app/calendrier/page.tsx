"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/app-layout";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  GraduationCap, AlignJustify, LayoutGrid,
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

/* ── Constants ── */
const TIME_SLOTS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00",
];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTH_NAMES = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

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

/* ── Main ── */
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
  const [loading, setLoading] = useState(true);

  type ModalType = "add" | "detail" | "queue" | "newStudent" | null;
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null);
  const [queueStudent, setQueueStudent] = useState<Student | null>(null);

  const [pForm, setPForm] = useState({ studentId: "", date: "", time: "09:00", instructor: "", examCenter: "", notes: "" });
  const [sForm, setSForm] = useState({ firstName: "", lastName: "", email: "", phone: "", drivingHours: "0" });
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

      const fetches =
        view === "week"
          ? uniqMonths.map(({ year, month }) =>
              fetch(`/api/placements?year=${year}&month=${month}`).then(r => r.json())
            )
          : [fetch(`/api/placements?year=${currentYear}&month=${currentMonth}`).then(r => r.json())];

      const [studentsData, ...placementArrays] = await Promise.all([
        fetch("/api/eleves").then(r => r.json()),
        ...fetches,
      ]);

      const all = (placementArrays.flat() as unknown[]).filter(
        (p): p is Placement => !!p && typeof p === "object" && "id" in (p as object)
      );

      setPlacements(all);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [weekStart, currentYear, currentMonth, view]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  /* ── Modal helpers ── */
  function openFromSlot(dateStr: string, time: string) {
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
  function openDetail(p: Placement) {
    setSelectedPlacement(p);
    setModal("detail");
  }
  function closeModal() {
    setModal(null);
    setSelectedPlacement(null);
    setQueueStudent(null);
    setFormError("");
  }

  /* ── Submit ── */
  async function submitPlacement(e: React.FormEvent) {
    e.preventDefault();
    if (!pForm.studentId || !pForm.date || !pForm.time) {
      setFormError("Élève, date et heure sont requis");
      return;
    }
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pForm),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Erreur"); return; }
      closeModal();
      fetchData();
    } catch { setFormError("Erreur serveur"); }
    finally { setFormLoading(false); }
  }

  async function submitStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!sForm.lastName.trim()) { setFormError("Le nom est requis"); return; }
    setFormLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/eleves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: sForm.firstName,
          lastName: sForm.lastName,
          email: sForm.email || undefined,
          phone: sForm.phone || undefined,
          drivingHours: Number(sForm.drivingHours) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Erreur"); return; }
      setSForm({ firstName: "", lastName: "", email: "", phone: "", drivingHours: "0" });
      closeModal();
      fetchData();
    } catch { setFormError("Erreur serveur"); }
    finally { setFormLoading(false); }
  }

  async function deletePlacement(id: string) {
    await fetch(`/api/placements/${id}`, { method: "DELETE" });
    closeModal();
    fetchData();
  }

  /* ── Derived ── */
  const weekDays = getWeekDays(weekStart);

  const pBySlot: Record<string, Placement[]> = {};
  const pByDay: Record<number, Placement[]> = {};
  placements.forEach(p => {
    const d = new Date(p.date);
    const slotKey = `${toKey(d)}-${p.time}`;
    pBySlot[slotKey] = [...(pBySlot[slotKey] || []), p];
    const day = d.getDate();
    pByDay[day] = [...(pByDay[day] || []), p];
  });

  const weekEnd = weekDays[6];
  const periodLabel =
    view === "week"
      ? (() => {
          const sm = MONTH_NAMES[weekStart.getMonth()];
          const em = MONTH_NAMES[weekEnd.getMonth()];
          return sm === em
            ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${sm} ${weekStart.getFullYear()}`
            : `${weekStart.getDate()} ${sm} – ${weekEnd.getDate()} ${em} ${weekStart.getFullYear()}`;
        })()
      : `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

  /* ── Render ── */
  return (
    <AppLayout title="Calendrier" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[200px] text-center select-none">
            {periodLabel}
          </span>
          <button
            onClick={next}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 active:scale-95 transition-all"
          >
            Aujourd'hui
          </button>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-0.5">
          <button
            onClick={() => setView("week")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              view === "week" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <AlignJustify className="h-3.5 w-3.5" /> Semaine
          </button>
          <button
            onClick={() => setView("month")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              view === "month" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Mois
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : view === "week" ? (
        <WeekView
          weekDays={weekDays}
          todayKey={todayKey}
          pBySlot={pBySlot}
          students={students}
          onSlotClick={openFromSlot}
          onPlacementClick={openDetail}
          onQueueStudentClick={openFromQueue}
          onQueueAdd={() => setModal("queue")}
        />
      ) : (
        <MonthView
          year={currentYear}
          month={currentMonth}
          todayKey={todayKey}
          pByDay={pByDay}
          onDayClick={dateStr => openFromSlot(dateStr, "09:00")}
          onPlacementClick={openDetail}
        />
      )}

      {/* ── Add placement modal ── */}
      <Modal open={modal === "add"} onClose={closeModal} title="Planifier un examen">
        <form onSubmit={submitPlacement} className="space-y-4">
          {queueStudent ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500 text-white text-sm font-semibold flex-shrink-0">
                {initials(queueStudent)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{queueStudent.firstName} {queueStudent.lastName}</p>
                <p className="text-xs text-gray-500">{queueStudent.drivingHours}h de conduite</p>
              </div>
            </div>
          ) : (
            <Select
              label="Élève *"
              value={pForm.studentId}
              onChange={e => setPForm(f => ({ ...f, studentId: e.target.value }))}
              required
              placeholder="Choisir un élève"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Date *" type="date" value={pForm.date}
              onChange={e => setPForm(f => ({ ...f, date: e.target.value }))} required />
            <Input label="Heure *" type="time" value={pForm.time}
              onChange={e => setPForm(f => ({ ...f, time: e.target.value }))} required />
          </div>
          <Input label="Moniteur" placeholder="Nom du moniteur" value={pForm.instructor}
            onChange={e => setPForm(f => ({ ...f, instructor: e.target.value }))} />
          <Input label="Centre d'examen" placeholder="Ex : Centre de Versailles" value={pForm.examCenter}
            onChange={e => setPForm(f => ({ ...f, examCenter: e.target.value }))} />
          <Textarea label="Notes" placeholder="Informations supplémentaires..." value={pForm.notes}
            onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} rows={2} />

          {formError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{formError}</p>}

          <div className="flex gap-3 pt-1">
            <IosButton type="button" variant="secondary" onClick={closeModal} className="flex-1">Annuler</IosButton>
            <IosButton type="submit" loading={formLoading} className="flex-1">Confirmer</IosButton>
          </div>
        </form>
      </Modal>

      {/* ── Detail modal ── */}
      <Modal open={modal === "detail"} onClose={closeModal} title="Détail de l'examen">
        {selectedPlacement && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-semibold">
                {selectedPlacement.student.firstName[0]}{selectedPlacement.student.lastName[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedPlacement.student.firstName} {selectedPlacement.student.lastName}</p>
                <p className="text-sm text-gray-400">
                  {new Date(selectedPlacement.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["Heure", selectedPlacement.time],
                ["Moniteur", selectedPlacement.instructor || "—"],
                ["Centre", selectedPlacement.examCenter || "—"],
                ["Statut", new Date(selectedPlacement.date) < now ? "Passé" : "À venir"],
              ].map(([label, value]) => (
                <div key={label} className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {selectedPlacement.notes && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">{selectedPlacement.notes}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => deletePlacement(selectedPlacement.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 active:scale-95 transition-all"
              >
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
              <IosButton type="button" variant="secondary" onClick={closeModal} className="flex-1">Fermer</IosButton>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Queue modal ── */}
      <Modal open={modal === "queue"} onClose={closeModal} title="Ajouter un élève">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Que souhaitez-vous faire ?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setQueueStudent(null); setPForm(f => ({ ...f, studentId: "" })); setFormError(""); setModal("add"); }}
              className="flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-blue-200 hover:bg-blue-50 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-100">
                <GraduationCap className="h-6 w-6 text-blue-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900">Élève existant</p>
                <p className="text-xs text-gray-400 mt-0.5">Choisir dans la liste</p>
              </div>
            </button>
            <button
              onClick={() => setModal("newStudent")}
              className="flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-green-200 hover:bg-green-50 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-green-100">
                <Plus className="h-6 w-6 text-green-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900">Nouvel élève</p>
                <p className="text-xs text-gray-400 mt-0.5">Créer directement</p>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* ── New student modal ── */}
      <Modal open={modal === "newStudent"} onClose={closeModal} title="Nouvel élève">
        <form onSubmit={submitStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" placeholder="Jean" value={sForm.firstName}
              onChange={e => setSForm(f => ({ ...f, firstName: e.target.value }))} />
            <Input label="Nom *" placeholder="Dupont" value={sForm.lastName}
              onChange={e => setSForm(f => ({ ...f, lastName: e.target.value }))} required />
          </div>
          <Input label="Email" type="email" placeholder="jean@example.com" value={sForm.email}
            onChange={e => setSForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Téléphone" type="tel" placeholder="06 12 34 56 78" value={sForm.phone}
            onChange={e => setSForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Heures de conduite" type="number" min="0" value={sForm.drivingHours}
            onChange={e => setSForm(f => ({ ...f, drivingHours: e.target.value }))} />

          {formError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{formError}</p>}

          <div className="flex gap-3 pt-1">
            <IosButton type="button" variant="secondary" onClick={() => setModal("queue")} className="flex-1">Retour</IosButton>
            <IosButton type="submit" variant="success" loading={formLoading} className="flex-1">Créer l'élève</IosButton>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

/* ── iOS-style button ── */
function IosButton({
  children, type = "button", variant = "primary", onClick, loading, className,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "success";
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}) {
  const base = "py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50";
  const variants = {
    primary: "bg-blue-500 text-white hover:bg-blue-600",
    secondary: "border border-gray-200 text-gray-700 hover:bg-gray-50",
    success: "bg-green-500 text-white hover:bg-green-600",
  };
  return (
    <button type={type} onClick={onClick} disabled={!!loading} className={cn(base, variants[variant], className)}>
      {loading ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
    </button>
  );
}

/* ── Week View ── */
interface WeekViewProps {
  weekDays: Date[];
  todayKey: string;
  pBySlot: Record<string, Placement[]>;
  students: Student[];
  onSlotClick: (date: string, time: string) => void;
  onPlacementClick: (p: Placement) => void;
  onQueueStudentClick: (s: Student) => void;
  onQueueAdd: () => void;
}

function WeekView({ weekDays, todayKey, pBySlot, students, onSlotClick, onPlacementClick, onQueueStudentClick, onQueueAdd }: WeekViewProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {/* Grid */}
      <div className="flex-1 min-w-[560px] bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
        {/* Day headers */}
        <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
          <div />
          {weekDays.map((day, i) => {
            const k = toKey(day);
            const today = k === todayKey;
            return (
              <div key={i} className={cn("py-3 text-center border-l border-gray-50", today && "bg-blue-50/60")}>
                <p className={cn("text-[10px] font-semibold uppercase tracking-widest", today ? "text-blue-400" : "text-gray-400")}>
                  {DAYS_SHORT[i]}
                </p>
                <p className={cn(
                  "text-lg font-bold mt-0.5",
                  today ? "text-blue-600" : "text-gray-700"
                )}>
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time rows */}
        {TIME_SLOTS.map((time, ti) => (
          <div key={time} className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
            <div className={cn("py-2 pr-2 flex items-start justify-end", ti < TIME_SLOTS.length - 1 && "border-b border-gray-50")}>
              <span className="text-[10px] text-gray-300 font-medium">{time}</span>
            </div>
            {weekDays.map((day, di) => {
              const dateStr = toKey(day);
              const today = dateStr === todayKey;
              const slotPlacements = pBySlot[`${dateStr}-${time}`] || [];

              return (
                <div
                  key={di}
                  onClick={() => onSlotClick(dateStr, time)}
                  className={cn(
                    "relative px-1 py-1 border-l min-h-[46px] cursor-pointer group",
                    ti < TIME_SLOTS.length - 1 && "border-b border-gray-50",
                    today ? "bg-blue-50/40 border-l-blue-100 hover:bg-blue-50/70" : "border-l-gray-50 hover:bg-gray-50/80",
                    "transition-colors"
                  )}
                >
                  {slotPlacements.length === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-3.5 w-3.5 text-gray-300" />
                    </span>
                  )}
                  {slotPlacements.map(p => (
                    <div
                      key={p.id}
                      onClick={e => { e.stopPropagation(); onPlacementClick(p); }}
                      className="text-[11px] font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg px-2 py-1 mb-0.5 truncate cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm active:scale-95"
                    >
                      {p.student.firstName?.[0] ? `${p.student.firstName[0]}. ` : ""}{p.student.lastName}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Queue */}
      <div className="w-52 flex-shrink-0 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">File d'attente</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{students.length} élève{students.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={onQueueAdd}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {students.length === 0 ? (
            <div className="py-10 text-center">
              <GraduationCap className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-300">Aucun élève</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => onQueueStudentClick(s)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-semibold shadow-sm">
                      {initials(s)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
                        {s.firstName ? `${s.firstName} ` : ""}{s.lastName}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-gray-400 font-medium">{s.drivingHours}h</span>
                        <span className="text-[10px] text-gray-200">·</span>
                        <span className="text-[10px] text-gray-400">{drivingDate(s.lastDrivingDate)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Month View ── */
interface MonthViewProps {
  year: number;
  month: number;
  todayKey: string;
  pByDay: Record<number, Placement[]>;
  onDayClick: (dateStr: string) => void;
  onPlacementClick: (p: Placement) => void;
}

function MonthView({ year, month, todayKey, pByDay, onDayClick, onPlacementClick }: MonthViewProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstOffset = getFirstOffset(year, month);

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: firstOffset }).map((_, i) => (
          <div key={`e${i}`} className="min-h-[100px] border-b border-r border-gray-50" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayKey;
          const dayPlacements = pByDay[day] || [];

          return (
            <div
              key={day}
              onClick={() => onDayClick(dateStr)}
              className={cn(
                "min-h-[100px] p-2 border-b border-r border-gray-50 cursor-pointer transition-colors",
                isToday ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-gray-50/80"
              )}
            >
              <span className={cn(
                "text-sm font-bold inline-flex w-7 h-7 items-center justify-center rounded-full",
                isToday ? "bg-blue-500 text-white shadow-sm" : "text-gray-700"
              )}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayPlacements.slice(0, 3).map(p => (
                  <div
                    key={p.id}
                    onClick={e => { e.stopPropagation(); onPlacementClick(p); }}
                    className="text-[11px] font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md px-1.5 py-0.5 truncate hover:from-blue-600 hover:to-blue-700 transition-all cursor-pointer active:scale-95"
                  >
                    {p.time} {p.student.firstName?.[0] ? `${p.student.firstName[0]}. ` : ""}{p.student.lastName}
                  </div>
                ))}
                {dayPlacements.length > 3 && (
                  <p className="text-[10px] text-gray-400 font-medium pl-1">+{dayPlacements.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
