import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, KeyRound, Building2, CheckCircle, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  const [totalUsers, totalKeys, usedKeys, recentUsers] = await Promise.all([
    prisma.user.count({ where: { role: "SCHOOL" } }),
    prisma.accessKey.count(),
    prisma.accessKey.count({ where: { used: true } }),
    prisma.user.findMany({
      where: { role: "SCHOOL" },
      include: { school: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const activeUsers = await prisma.user.count({ where: { role: "SCHOOL", status: "ACTIVE" } });
  const pendingUsers = await prisma.user.count({ where: { role: "SCHOOL", status: "PENDING" } });

  return (
    <AppLayout title="Administration" role={session.user.role} schoolName="Admin">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Auto-écoles</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Comptes actifs</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeUsers}</p>
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
                  <p className="text-sm text-gray-500">En attente</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingUsers}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Clés utilisées</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{usedKeys}/{totalKeys}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <KeyRound className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Link href="/admin/cles">
            <Button className="gap-2">
              <KeyRound className="h-4 w-4" />
              Gérer les clés d'accès
            </Button>
          </Link>
        </div>

        {/* Users list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Comptes auto-école récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex-shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {user.school?.name || user.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={
                        user.status === "ACTIVE" ? "success" :
                        user.status === "PENDING" ? "warning" : "destructive"
                      }
                      className="text-xs"
                    >
                      {user.status === "ACTIVE" ? "Actif" : user.status === "PENDING" ? "En attente" : "Suspendu"}
                    </Badge>
                    <span className="text-xs text-gray-400">{formatDate(user.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
