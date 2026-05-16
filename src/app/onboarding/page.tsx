"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, CreditCard, KeyRound, CheckCircle } from "lucide-react";

function OnboardingContent() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"payment" | "key">("payment");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pollRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("success") === "true" && !pollRef.current) {
      pollRef.current = true;
      setSuccess("Paiement confirmé ! Activation en cours...");
      const sessionId = searchParams.get("session_id");
      fetch("/api/stripe/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(() => {
          setSuccess("Compte activé ! Reconnexion en cours...");
          setTimeout(() => { signOut({ callbackUrl: "/auth/login?activated=true" }); }, 1000);
        })
        .catch(() => {
          setSuccess("Compte activé ! Reconnexion en cours...");
          setTimeout(() => { signOut({ callbackUrl: "/auth/login?activated=true" }); }, 1000);
        });
    }
    if (searchParams.get("canceled") === "true") {
      setError("Paiement annulé. Vous pouvez réessayer.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStripePayment() {
    setStripeLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors du paiement"); return; }
      window.location.href = data.url;
    } catch {
      setError("Erreur lors de la connexion à Stripe");
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleKeyActivation(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Clé invalide"); return; }
      setSuccess("Compte activé ! Redirection en cours...");
      await update();
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setError("Erreur lors de l'activation");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-shadow";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-200 dark:shadow-none">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-gray-900 dark:text-white tracking-tight">PlanPermis</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activez votre compte</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Bienvenue {session?.user?.schoolName} ! Choisissez votre mode d'accès.
          </p>
        </div>

        {success && (
          <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2 mb-5">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Tab toggle */}
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 p-1 mb-5 bg-white dark:bg-gray-900 shadow-sm">
          <button
            onClick={() => setTab("payment")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "payment" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <CreditCard className="h-4 w-4" />
            Paiement en ligne
          </button>
          <button
            onClick={() => setTab("key")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "key" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <KeyRound className="h-4 w-4" />
            Clé d'accès
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          {tab === "payment" ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                  <CreditCard className="h-4.5 w-4.5 text-blue-500" />
                  Paiement sécurisé
                </h2>
                <p className="text-sm text-gray-500">Réglez votre abonnement via Stripe. Accès immédiat après paiement.</p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-300">
                Paiement 100% sécurisé par Stripe. Toutes les cartes bancaires acceptées.
              </div>
              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
              )}
              <button
                onClick={handleStripePayment}
                disabled={stripeLoading}
                className="w-full h-11 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                {stripeLoading ? "Redirection vers Stripe..." : "Payer et activer mon compte"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                  <KeyRound className="h-4.5 w-4.5 text-green-500" />
                  Clé d'accès
                </h2>
                <p className="text-sm text-gray-500">Entrez la clé fournie par l'administrateur PlanPermis.</p>
              </div>
              <form onSubmit={handleKeyActivation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Clé d'accès</label>
                  <input
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                    value={key}
                    onChange={e => setKey(e.target.value.toUpperCase())}
                    required
                    className={`${inputClass} font-mono tracking-wider`}
                  />
                </div>
                {error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loading ? "Activation..." : "Activer avec ma clé"}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-5">
          <button onClick={() => signOut({ callbackUrl: "/" })} className="hover:text-gray-600 dark:hover:text-gray-300 underline">
            Se déconnecter
          </button>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <OnboardingContent />
    </Suspense>
  );
}
