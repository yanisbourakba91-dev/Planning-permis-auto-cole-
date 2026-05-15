"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, CreditCard, KeyRound, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

      let attempts = 0;
      const maxAttempts = 10;

      const poll = () => {
        attempts++;
        update().then((updated) => {
          const status = (updated?.user as { status?: string } | null)?.status;
          if (status === "ACTIVE" || attempts >= maxAttempts) {
            setSuccess("Compte activé ! Redirection en cours...");
            router.push("/dashboard");
          } else {
            setTimeout(poll, 3000);
          }
        }).catch(() => {
          if (attempts >= maxAttempts) {
            router.push("/dashboard");
          } else {
            setTimeout(poll, 3000);
          }
        });
      };

      setTimeout(poll, 3000);
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
      if (!res.ok) {
        setError(data.error || "Erreur lors du paiement");
        return;
      }
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
      if (!res.ok) {
        setError(data.error || "Clé invalide");
        return;
      }
      setSuccess("Compte activé ! Redirection en cours...");
      await update();
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setError("Erreur lors de l'activation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-gray-900 dark:text-white">PlanPermis</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Activez votre compte
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Bienvenue {session?.user?.schoolName} ! Choisissez votre mode d'accès.
          </p>
        </div>

        {success && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2 mb-6">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-6 bg-white dark:bg-gray-900">
          <button
            onClick={() => setTab("payment")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === "payment"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Paiement en ligne
          </button>
          <button
            onClick={() => setTab("key")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === "key"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Clé d'accès
          </button>
        </div>

        <Card>
          {tab === "payment" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Paiement sécurisé
                </CardTitle>
                <CardDescription>
                  Réglez votre abonnement en ligne via Stripe. Accès immédiat après paiement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-300">
                  Paiement 100% sécurisé par Stripe. Toutes les cartes bancaires acceptées.
                </div>
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={handleStripePayment}
                  loading={stripeLoading}
                  size="lg"
                >
                  {stripeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Payer et activer mon compte
                </Button>
              </CardContent>
            </>
          )}

          {tab === "key" && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-green-600" />
                  Clé d'accès
                </CardTitle>
                <CardDescription>
                  Entrez la clé d'accès fournie par l'administrateur PlanPermis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleKeyActivation} className="space-y-4">
                  <Input
                    label="Clé d'accès"
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    required
                    className="font-mono tracking-wider"
                  />
                  {error && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                      {error}
                    </div>
                  )}
                  <Button type="submit" className="w-full" loading={loading} size="lg" variant="success">
                    Activer avec ma clé
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="hover:text-gray-700 dark:hover:text-gray-300 underline"
          >
            Se déconnecter
          </button>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
