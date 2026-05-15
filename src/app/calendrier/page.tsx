"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Plus, X, User, MapPin, Clock, CalendarDays
} from "lucide-react";
import { getMonthName, formatDate } from "@/lib/utils";

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
}

interface ExamMonth {
  id: string;
  year: number;
  month: number;
  totalSlots: number;
  usedSlots: number;
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function CalendrierPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<"month" | "week">("month");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examMonth, setExamMonth] = useState<ExamMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    date: "",
    time: "",
    instructor: "",
    examCenter: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [placementsRes, studentsRes, monthRes] = await Promise.all([
        fetch(`/api/placements?year=${currentYear}&month=${currentMonth}`),
        fetch("/api/eleves"),
        fetch(`/api/places-examen?year=${currentYear}`),
      ]);
      const [pData, sData, mData] = await Promise.all([
        placementsRes.json(),
        studentsRes.json(),
        monthRes.json(),
      ]);
      setPlacements(Array.isArray(pData) ? pData : []);
      setStudents(Array.isArray(sData) ? sData : []);
      const monthData = Array.isArray(mData)
        ? mData.find((m: ExamMonth) => m.month === currentMonth)
        : null;
      setExamMonth(monthData || null);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function prevMonth() {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  }

  function openAddModal(dateStr?: string) {
    setSelectedPlacement(null);
    setFormError("");
    setForm({ studentId: "", date: dateStr || "", time: "09:00", instructor: "", examCenter: "", notes: "" });
    setModalOpen(true);
  }

  function openDetailModal(p: Placement) {
    setSelectedPlacement(p);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const res = await fetch("/api/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Erreur"); return; }
      setModalOpen(false);
      fetchData();
    } catch {
      setFormError("Erreur serveur");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeletePlacement(id: string) {
    await fetch(`/api/placements/${id}`, { method: "DELETE" });
    setModalOpen(false);
    fetchData();
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOffset = getFirstDayOfWeek(currentYear, currentMonth);

  const placementsByDay: Record<number, Placement[]> = {};
  placements.forEach((p) => {
    const day = new Date(p.date).getDate();
    if (!placementsByDay[day]) placementsByDay[day] = [];
    placementsByDay[day].push(p);
  });

  const slotsAvailable = examMonth ? Math.max(0, examMonth.totalSlots - examMonth.usedSlots) : null;

  return (
    <AppLayout title="Calendrier" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="space-y-4">
        {/* Header controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white min-w-[180px] text-center">
              {getMonthName(currentMonth)} {currentYear}
            </h2>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCurrentYear(now.getFullYear()); setCurrentMonth(now.getMonth() + 1); }}
              className="text-blue-600"
            >
              Aujourd'hui
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {examMonth && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Places :</span>
                <span className={`font-bold ${slotsAvailable === 0 ? "text-red-500" : slotsAvailable !== null && slotsAvailable <= 2 ? "text-orange-500" : "text-green-500"}`}>
                  {slotsAvailable}/{examMonth.totalSlots}
                </span>
              </div>
            )}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm transition-colors ${view === "month" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                onClick={() => setView("month")}
              >
                Mois
              </button>
              <button
                className={`px-3 py-1.5 text-sm transition-colors ${view === "week" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                onClick={() => setView("week")}
              >
                Semaine
              </button>
            </div>
            <Button onClick={() => openAddModal()} className="gap-2">
              <Plus className="h-4 w-4" />
              Planifier
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAYS.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for offset */}
                  {Array.from({ length: firstDayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[80px] rounded-lg" />
                  ))}

                  {/* Actual days */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const isToday =
                      day === now.getDate() &&
                      currentMonth === now.getMonth() + 1 &&
                      currentYear === now.getFullYear();
                    const dayPlacements = placementsByDay[day] || [];
                    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                    return (
                      <div
                        key={day}
                        className={`min-h-[80px] rounded-lg border p-1.5 cursor-pointer transition-colors ${
                          isToday
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                        onClick={() => openAddModal(dateStr)}
                      >
                        <span className={`text-xs font-semibold block mb-1 ${isToday ? "text-blue-600" : "text-gray-700 dark:text-gray-300"}`}>
                          {day}
                        </span>
                        <div className="space-y-0.5">
                          {dayPlacements.slice(0, 2).map((p) => (
                            <div
                              key={p.id}
                              className="text-xs bg-blue-600 text-white rounded px-1 py-0.5 truncate cursor-pointer hover:bg-blue-700"
                              onClick={(e) => { e.stopPropagation(); openDetailModal(p); }}
                            >
                              {p.time} {p.student.firstName[0]}. {p.student.lastName}
                            </div>
                          ))}
                          {dayPlacements.length > 2 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                              +{dayPlacements.length - 2}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Placements list for month */}
        {placements.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Examens de {getMonthName(currentMonth)} ({placements.length})
              </h3>
              <div className="space-y-2">
                {placements
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => openDetailModal(p)}
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-sm">
                        {new Date(p.date).getDate()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {p.student.firstName} {p.student.lastName}
                        </p>
                        <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.time}</span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.instructor}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.examCenter}</span>
                        </div>
                      </div>
                      <Badge variant={new Date(p.date) < now ? "secondary" : "default"} className="text-xs">
                        {new Date(p.date) < now ? "Passé" : "À venir"}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add placement modal */}
      <Modal
        open={modalOpen && !selectedPlacement}
        onClose={() => setModalOpen(false)}
        title="Planifier un examen"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Élève *"
            value={form.studentId}
            onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
            required
            placeholder="Sélectionner un élève"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date *"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
            <Input
              label="Heure *"
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              required
            />
          </div>

          <Input
            label="Moniteur *"
            placeholder="Nom du moniteur"
            value={form.instructor}
            onChange={(e) => setForm((f) => ({ ...f, instructor: e.target.value }))}
            required
          />
          <Input
            label="Centre d'examen *"
            placeholder="Ex : Centre de Versailles"
            value={form.examCenter}
            onChange={(e) => setForm((f) => ({ ...f, examCenter: e.target.value }))}
            required
          />
          <Textarea
            label="Notes"
            placeholder="Informations supplémentaires..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />

          {formError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" loading={formLoading} className="flex-1">
              Confirmer le placement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Placement detail modal */}
      <Modal
        open={modalOpen && !!selectedPlacement}
        onClose={() => setModalOpen(false)}
        title="Détail de l'examen"
      >
        {selectedPlacement && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold">
                {selectedPlacement.student.firstName[0]}{selectedPlacement.student.lastName[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {selectedPlacement.student.firstName} {selectedPlacement.student.lastName}
                </p>
                <p className="text-sm text-gray-500">{formatDate(selectedPlacement.date)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: CalendarDays, label: "Date", value: formatDate(selectedPlacement.date) },
                { icon: Clock, label: "Heure", value: selectedPlacement.time },
                { icon: User, label: "Moniteur", value: selectedPlacement.instructor },
                { icon: MapPin, label: "Centre", value: selectedPlacement.examCenter },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                    <Icon className="h-3 w-3" />{label}
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            {selectedPlacement.notes && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
                {selectedPlacement.notes}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="destructive"
                onClick={() => handleDeletePlacement(selectedPlacement.id)}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Supprimer
              </Button>
              <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
