import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
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

  const stats = [
    { label: "Élèves inscrits", value: studentCount, icon: Users, colorBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-500" },
    { label: "Examens à venir", value: upcomingPlacements.length, icon: CalendarDays, colorBg: "bg-orange-50 dark:bg-orange-900/20", iconColor: "text-orange-500" },
    { label: "Places disponibles", value: availableSlots !== null ? availableSlots : "—", sub: getMonthName(currentMonth), icon: CheckCircle, colorBg: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-500" },
    { label: "Places occupées", value: currentMonthData?.usedSlots ?? 0, sub: `sur ${currentMonthData?.totalSlots ?? 0}`, icon: TrendingUp, colorBg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-500" },
  ];

  return (
    <AppLayout title="Tableau de bord" role={session.user.role} schoolName={session.user.schoolName}>
      <div className="space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, sub, icon: Icon, colorBg, iconColor }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                  {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming exams */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Prochains examens</h2>
              <Link href="/calendrier" className="text-xs text-blue-500 hover:text-blue-600 font-medium">Voir tout →</Link>
            </div>
            <div className="p-4">
              {upcomingPlacements.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">Aucun examen planifié</p>
                  <Link href="/calendrier" className="mt-2 inline-block text-xs text-blue-500 hover:underline">Planifier un examen</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {upcomingPlacements.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 font-bold text-sm flex-shrink-0">
                        {new Date(p.date).getDate()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {p.student.firstName} {p.student.lastName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {p.time}{p.examCenter ? ` · ${p.examCenter}` : ""}
                        </p>
                      </div>
                      <Badge variant="warning" className="text-xs flex-shrink-0">{formatDate(p.date)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent students */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Derniers élèves ajoutés</h2>
              <Link href="/eleves" className="text-xs text-blue-500 hover:text-blue-600 font-medium">Voir tout →</Link>
            </div>
            <div className="p-4">
              {recentStudents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400 mb-2">Aucun élève inscrit</p>
                  <Link href="/eleves/nouveau" className="text-xs text-blue-500 hover:underline">Ajouter le premier élève</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentStudents.map((s) => (
                    <Link key={s.id} href={`/eleves/${s.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-bold text-sm flex-shrink-0">
                          {(s.firstName?.[0] || "")}{s.lastName?.[0] || ""}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{s.drivingHours}h de conduite
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
