"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GraduationCap, CheckCircle } from "lucide-react";
import { Suspense } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activated = searchParams.get("activated") === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) { setError("Email ou mot de passe incorrect"); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4" suppressHydrationWarning>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-200 dark:shadow-none">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-gray-900 dark:text-white tracking-tight">PlanPermis</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connexion</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connectez-vous à votre espace auto-école</p>
        </div>

        {activated && (
          <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2 mb-5">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            Compte activé ! Connectez-vous pour accéder à votre espace.
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="contact@auto-ecole.fr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-shadow"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            Pas encore de compte ?{" "}
            <Link href="/auth/register" className="text-blue-500 hover:text-blue-600 font-medium">Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
