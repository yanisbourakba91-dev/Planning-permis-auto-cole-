"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    schoolName: "",
    address: "",
    phone: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          schoolName: form.schoolName,
          address: form.address || undefined,
          phone: form.phone || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        return;
      }

      router.push("/auth/login?registered=true");
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-gray-900 dark:text-white">PlanPermis</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Créer un compte</CardTitle>
            <CardDescription>Inscrivez votre auto-école sur PlanPermis</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nom de l'auto-école *"
                name="schoolName"
                placeholder="Auto-École du Soleil"
                value={form.schoolName}
                onChange={handleChange}
                required
              />
              <Input
                label="Email *"
                name="email"
                type="email"
                placeholder="contact@auto-ecole.fr"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Adresse"
                  name="address"
                  placeholder="12 rue de la Paix"
                  value={form.address}
                  onChange={handleChange}
                />
                <Input
                  label="Téléphone"
                  name="phone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <Input
                label="Mot de passe *"
                name="password"
                type="password"
                placeholder="Minimum 8 caractères"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <Input
                label="Confirmer le mot de passe *"
                name="confirmPassword"
                type="password"
                placeholder="Répétez le mot de passe"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                Créer mon compte
              </Button>
            </form>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
              Déjà un compte ?{" "}
              <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
