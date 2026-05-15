"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NouvelElevePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/eleves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          drivingHours: form.drivingHours ? parseFloat(form.drivingHours) : 0,
          lastDrivingDate: form.lastDrivingDate || null,
          email: form.email || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'ajout");
        return;
      }

      router.push("/eleves");
    } catch {
      setError("Erreur lors de l'ajout de l'élève");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title="Nouvel élève" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/eleves">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour aux élèves
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Informations de l'élève</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Prénom *"
                  name="firstName"
                  placeholder="Jean"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Nom *"
                  name="lastName"
                  placeholder="Dupont"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="jean.dupont@email.fr"
                  value={form.email}
                  onChange={handleChange}
                />
                <Input
                  label="Téléphone"
                  name="phone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Suivi de conduite
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Heures de conduite"
                    name="drivingHours"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
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

              <Textarea
                label="Notes"
                name="notes"
                placeholder="Remarques, informations supplémentaires..."
                value={form.notes}
                onChange={handleChange}
                rows={3}
              />

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Link href="/eleves" className="flex-1">
                  <Button variant="outline" className="w-full" type="button">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" loading={loading} className="flex-1">
                  Ajouter l'élève
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
