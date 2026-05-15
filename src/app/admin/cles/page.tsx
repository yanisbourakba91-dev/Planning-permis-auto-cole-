"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Plus, Trash2, Copy, Check, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface AccessKey {
  id: string;
  key: string;
  used: boolean;
  usedAt?: string | null;
  note?: string | null;
  usedBy?: { email: string; school?: { name: string } | null } | null;
  createdAt: string;
}

export default function ClesPage() {
  const { data: session } = useSession();
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cles");
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/cles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setKeys((prev) => [data, ...prev]);
        setNote("");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette clé ?")) return;
    await fetch(`/api/admin/cles?id=${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function handleCopy(key: string, id: string) {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const unusedKeys = keys.filter((k) => !k.used);
  const usedKeys = keys.filter((k) => k.used);

  return (
    <AppLayout title="Clés d'accès" role={session?.user?.role || ""} schoolName="Admin">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/admin">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour à l'administration
          </Button>
        </Link>

        {/* Generate new key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5" />
              Générer une nouvelle clé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Note optionnelle (ex: Auto-École Martin)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleGenerate} loading={generating} className="gap-2 whitespace-nowrap">
                <KeyRound className="h-4 w-4" />
                Générer
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Unused keys */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Badge variant="success" className="text-xs">{unusedKeys.length}</Badge>
                  Clés disponibles (non utilisées)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unusedKeys.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Aucune clé disponible — générez-en une ci-dessus.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {unusedKeys.map((k) => (
                      <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/10">
                        <KeyRound className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <code className="flex-1 font-mono text-sm font-bold tracking-wider text-gray-900 dark:text-white">
                          {k.key}
                        </code>
                        {k.note && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                            {k.note}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 hidden sm:block">{formatDate(k.createdAt)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(k.key, k.id)}
                          className="flex-shrink-0"
                          title="Copier"
                        >
                          {copiedId === k.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                          onClick={() => handleDelete(k.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Used keys */}
            {usedKeys.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-gray-500">
                    <Badge variant="secondary" className="text-xs">{usedKeys.length}</Badge>
                    Clés utilisées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {usedKeys.map((k) => (
                      <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 opacity-60">
                        <KeyRound className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <code className="flex-1 font-mono text-sm text-gray-500 line-through">{k.key}</code>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-500">{k.usedBy?.school?.name || k.usedBy?.email}</p>
                          <p className="text-xs text-gray-400">{k.usedAt ? formatDate(k.usedAt) : ""}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">Utilisée</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
