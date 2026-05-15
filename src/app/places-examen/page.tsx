"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Save, Info } from "lucide-react";
import { getMonthName, getSlotColor } from "@/lib/utils";

interface ExamMonth {
  id: string;
  year: number;
  month: number;
  totalSlots: number;
  usedSlots: number;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function PlacesExamenPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [months, setMonths] = useState<ExamMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});

  const fetchMonths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/places-examen?year=${year}`);
      const data = await res.json();
      const list: ExamMonth[] = Array.isArray(data) ? data : [];
      setMonths(list);
      const initialEdits: Record<number, string> = {};
      MONTHS.forEach((m) => {
        const found = list.find((x) => x.month === m);
        initialEdits[m] = found ? found.totalSlots.toString() : "0";
      });
      setEdits(initialEdits);
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
        setMonths((prev) => {
          const exists = prev.find((m) => m.month === month);
          if (exists) return prev.map((m) => m.month === month ? data : m);
          return [...prev, data];
        });
      }
    } finally {
      setSaving(null);
    }
  }

  function getMonthData(month: number): ExamMonth | null {
    return months.find((m) => m.month === month) || null;
  }

  const totalAvailable = months.reduce((sum, m) => sum + Math.max(0, m.totalSlots - m.usedSlots), 0);
  const totalUsed = months.reduce((sum, m) => sum + m.usedSlots, 0);
  const totalSlots = months.reduce((sum, m) => sum + m.totalSlots, 0);

  return (
    <AppLayout title="Places d'examen" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="space-y-6">
        {/* Year navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xl font-bold text-gray-900 dark:text-white w-16 text-center">{year}</span>
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Annual summary */}
          <div className="hidden sm:flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">Total places</p>
              <p className="font-bold text-gray-900 dark:text-white">{totalSlots}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">Occupées</p>
              <p className="font-bold text-orange-500">{totalUsed}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">Disponibles</p>
              <p className="font-bold text-green-500">{totalAvailable}</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            Définissez le nombre de places disponibles pour chaque mois. Ce compteur décrémente automatiquement à chaque placement d'examen.
          </p>
        </div>

        {/* Month grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MONTHS.map((month) => {
              const data = getMonthData(month);
              const used = data?.usedSlots ?? 0;
              const total = parseInt(edits[month] || "0");
              const available = Math.max(0, (data?.totalSlots ?? 0) - used);
              const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
              const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
              const fillRatio = data?.totalSlots ? used / data.totalSlots : 0;

              return (
                <Card key={month} className={isCurrentMonth ? "ring-2 ring-blue-500" : ""}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        {getMonthName(month)}
                        {isCurrentMonth && (
                          <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">
                            Ce mois
                          </span>
                        )}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Progress bar */}
                    {data && data.totalSlots > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500 dark:text-gray-400">{used} occupée{used > 1 ? "s" : ""}</span>
                          <span className={getSlotColor(used, data.totalSlots) + " font-medium"}>
                            {available} libre{available > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              fillRatio >= 1 ? "bg-red-500" : fillRatio >= 0.75 ? "bg-orange-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(fillRatio * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Input + save */}
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={edits[month] || ""}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [month]: e.target.value }))}
                        className="text-center"
                        disabled={isPast}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        loading={saving === month}
                        onClick={() => handleSave(month)}
                        disabled={isPast}
                        title="Enregistrer"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                      {isPast ? "Mois passé" : "Places disponibles"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
