"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, Clock, Calendar, Trash2, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  drivingHours: number;
  lastDrivingDate?: string | null;
  _count: { placements: number };
}

export default function ElevesPage() {
  const { data: session } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/eleves?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 300);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer l'élève ${name} ? Cette action est irréversible.`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/eleves/${id}`, { method: "DELETE" });
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AppLayout title="Élèves" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un élève..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <Link href="/eleves/nouveau">
            <Button className="gap-2 w-full sm:w-auto">
              <UserPlus className="h-4 w-4" />
              Nouvel élève
            </Button>
          </Link>
        </div>

        {/* Students list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <UserPlus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                {search ? "Aucun élève trouvé" : "Aucun élève inscrit"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {search ? "Essayez avec un autre terme" : "Commencez par ajouter votre premier élève"}
              </p>
              {!search && (
                <Link href="/eleves/nouveau">
                  <Button>Ajouter un élève</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {students.map((student) => (
              <Card key={student.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-sm flex-shrink-0">
                      {student.firstName[0]}{student.lastName[0]}
                    </div>
                    <Link href={`/eleves/${student.id}`} className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {student.firstName} {student.lastName}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3" />
                          {student.drivingHours}h de conduite
                        </span>
                        {student.lastDrivingDate && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="h-3 w-3" />
                            Dernière : {formatDate(student.lastDrivingDate)}
                          </span>
                        )}
                        {student._count.placements > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {student._count.placements} examen{student._count.placements > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/eleves/${student.id}`}>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        loading={deleting === student.id}
                        onClick={() => handleDelete(student.id, `${student.firstName} ${student.lastName}`)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
