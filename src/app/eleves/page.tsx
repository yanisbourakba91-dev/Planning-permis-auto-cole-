"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
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
      setStudents(prev => prev.filter(s => s.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AppLayout title="Élèves" role={session?.user?.role || ""} schoolName={session?.user?.schoolName}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un élève..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 h-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            />
          </div>
          <Link href="/eleves/nouveau">
            <button className="flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors shadow-sm whitespace-nowrap">
              <UserPlus className="h-4 w-4" />
              Nouvel élève
            </button>
          </Link>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mx-auto mb-4">
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
                <button className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">
                  Ajouter un élève
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800">
            {students.map((student) => (
              <div key={student.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold text-sm flex-shrink-0">
                  {(student.firstName?.[0] || "")}{student.lastName?.[0] || ""}
                </div>
                <Link href={`/eleves/${student.id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">
                    {student.firstName} {student.lastName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />{student.drivingHours}h
                    </span>
                    {student.lastDrivingDate && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />Dernière : {formatDate(student.lastDrivingDate)}
                      </span>
                    )}
                    {student._count.placements > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {student._count.placements} examen{student._count.placements > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link href={`/eleves/${student.id}`}>
                    <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </Link>
                  <button
                    disabled={deleting === student.id}
                    onClick={() => handleDelete(student.id, `${student.firstName} ${student.lastName}`)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {deleting === student.id
                      ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
