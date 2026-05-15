"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Trash2, CalendarDays, Clock, MapPin, User } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface Placement {
  id: string;
  date: string;
  time: string;
  instructor: string;
  examCenter: string;
  notes?: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  drivingHours: number;
  lastDrivingDate?: string | null;
  notes?: string | null;
  placements: Placement[];
}

export default function StudentDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    drivingHours: "",
    lastDrivingDate: "",
    notes: "",
  });

  const fetchStudent = useCallback(async () => {
    try {
      const res = await fetch(`/api/eleves/${params.id}`);
      if (!res.ok) { router.push("/eleves"); return; }
      const data: Student = await res.json();
      setStudent(data);
      setForm({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || "",
        phone: data.phone || "",
        drivingHours: data.drivingHours.toString(),
        lastDrivingDate: data.lastDrivingDate ? data.lastDrivingDate.split("T")[0] : "",
        notes: data.notes || "",
      });
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => { fetchStudent(); }, [fetchStudent]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/eleves/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          drivingHours: form.drivingHours ? parseFloat(form.drivingHours) : 0,
          lastDrivingDate: form.lastDrivingDate || null,
          email: form.email || null,
          phone: form.phone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur"); return; }
      setStudent((prev) => prev ? { ...prev, ...data } : null);
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlacement(placementId: string) {
    if (!confirm("Supprimer ce placement ?")) return;
    await fetch(`/api/placements/${placementId}`, { method: "DELETE" });
    setStudent((prev) =>
      prev ? { ...prev, placements: prev.placements.filter((p) => p.id !== placementId) } : null
    );
  }

  async function handleDeleteStudent() {
    if (!confirm(`Supprimer définitivement l'élève ${student?.firstName} ${student?.lastName} ?`)) return;
    await fetch(`/api/eleves/${params.id}`, { method: "DELETE" });
    router.push("/eleves");
  }

  if (loading) return (
    <AppLayout title="Chargement..." role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    </AppLayout>
  );

  if (!student) return null;

  const isPast = (date: string) => new Date(date) < new Date();

  return (
    <AppLayout title={`${student.firstName} ${student.lastName}`} role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/eleves">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={handleDeleteStudent}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer l'élève
          </Button>
        </div>

        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Fiche élève
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prénom *" name="firstName" value={form.firstName} onChange={handleChange} required />
                <Input label="Nom *" name="lastName" value={form.lastName} onChange={handleChange} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
                <Input label="Téléphone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Suivi de conduite
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Heures effectuées"
                    name="drivingHours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.drivingHours}
                    onChange={handleChange}
                  />
                  <Input
                    label="Date dernière heure"
                    name="lastDrivingDate"
                    type="date"
                    value={form.lastDrivingDate}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <Textarea label="Notes" name="notes" value={form.notes} onChange={handleChange} rows={3} />

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" loading={saving} className="gap-2">
                <Save className="h-4 w-4" />
                Enregistrer les modifications
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Placements history */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5" />
              Passages au permis ({student.placements.length})
            </CardTitle>
            <Link href="/calendrier">
              <Button size="sm" variant="outline">+ Planifier</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {student.placements.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                Aucun passage planifié
              </p>
            ) : (
              <div className="space-y-3">
                {student.placements.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      isPast(p.date) ? "bg-gray-200 dark:bg-gray-700 text-gray-500" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    }`}>
                      {new Date(p.date).getDate()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {formatDate(p.date)} à {p.time}
                        </span>
                        <Badge variant={isPast(p.date) ? "secondary" : "default"} className="text-xs">
                          {isPast(p.date) ? "Passé" : "À venir"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <User className="h-3 w-3" /> {p.instructor}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="h-3 w-3" /> {p.examCenter}
                        </span>
                      </div>
                      {p.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{p.notes}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                      onClick={() => handleDeletePlacement(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
