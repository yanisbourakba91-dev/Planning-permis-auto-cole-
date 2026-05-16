import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Users, KeyRound, Building2, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  const [totalUsers, totalKeys, usedKeys, activeUsers, pendingUsers, recentUsers] = await Promise.all([
    prisma.user.count({ where: { role: "SCHOOL" } }),
    prisma.accessKey.count(),
    prisma.accessKey.count({ where: { used: true } }),
    prisma.user.count({ where: { role: "SCHOOL", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "SCHOOL", status: "PENDING" } }),
    prisma.user.findMany({
      where: { role: "SCHOOL" },
      include: { school: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const stats = [
    { label: "Auto-écoles", value: totalUsers, icon: Building2, colorBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-500" },
    { label: "Comptes actifs", value: activeUsers, icon: CheckCircle, colorBg: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-500" },
    { label: "En attente", value: pendingUsers, icon: Clock, colorBg: "bg-orange-50 dark:bg-orange-900/20", iconColor: "text-orange-500" },
    { label: "Clés utilisées", value: `${usedKeys}/${totalKeys}`, icon: KeyRound, colorBg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-500" },
  ];

  return (
    <AppLayout title="Administration" role={session.user.role} schoolName="Admin">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, colorBg, iconColor }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Link href="/admin/cles">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors shadow-sm">
              <KeyRound className="h-4 w-4" />
              Gérer les clés d'accès
            </button>
          </Link>
        </div>

        {/* Users list */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <Users className="h-4 w-4 text-gray-400" />
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Comptes auto-école</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                  <Building2 className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {user.school?.name || user.email}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge
                    variant={user.status === "ACTIVE" ? "success" : user.status === "PENDING" ? "warning" : "destructive"}
                    className="text-xs"
                  >
                    {user.status === "ACTIVE" ? "Actif" : user.status === "PENDING" ? "En attente" : "Suspendu"}
                  </Badge>
                  <span className="text-xs text-gray-400">{formatDate(user.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
