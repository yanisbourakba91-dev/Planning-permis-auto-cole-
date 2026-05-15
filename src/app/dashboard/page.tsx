import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarDays, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { formatDate, getMonthName } from "@/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/auth/login");

  const schoolId = session.user.schoolId;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [studentCount, upcomingPlacements, currentMonthData, recentStudents] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.examPlacement.findMany({
      where: { schoolId, date: { gte: now } },
      include: { student: true },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.examMonth.findFirst({
      where: { schoolId, year: currentYear, month: currentMonth },
    }),
    prisma.student.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const availableSlots = currentMonthData
    ? Math.max(0, currentMonthData.totalSlots - currentMonthData.usedSlots)
    : null;

  return (
    <AppLayout title="Tableau de bord" role={session.user.role} schoolName={session.user.schoolName}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Élèves inscrits</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{studentCount}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Examens à venir</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {upcomingPlacements.length}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <CalendarDays className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Places disponibles</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {availableSlots !== null ? availableSlots : "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{getMonthName(currentMonth)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Places occupées</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                    {currentMonthData?.usedSlots ?? 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">sur {currentMonthData?.totalSlots ?? 0}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming exams */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Prochains examens</CardTitle>
              <Link href="/calendrier" className="text-sm text-blue-600 hover:underline">
                Voir tout
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingPlacements.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                  Aucun examen planifié
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingPlacements.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold text-sm flex-shrink-0">
                        {new Date(p.date).getDate()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {p.student.firstName} {p.student.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {p.time} · {p.examCenter}
                        </p>
                      </div>
                      <Badge variant="warning" className="text-xs flex-shrink-0">
                        {formatDate(p.date)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent students */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Derniers élèves ajoutés</CardTitle>
              <Link href="/eleves" className="text-sm text-blue-600 hover:underline">
                Voir tout
              </Link>
            </CardHeader>
            <CardContent>
              {recentStudents.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Aucun élève</p>
                  <Link href="/eleves/nouveau" className="text-sm text-blue-600 hover:underline">
                    Ajouter le premier élève
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentStudents.map((s) => (
                    <Link key={s.id} href={`/eleves/${s.id}`}>
                      <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 -mx-2 transition-colors">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-sm flex-shrink-0">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="inline h-3 w-3 mr-0.5" />
                            {s.drivingHours}h de conduite
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
