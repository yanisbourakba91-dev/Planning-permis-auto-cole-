import Link from "next/link";
import { GraduationCap, CalendarDays, Users, Shield, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">PlanPermis</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost">Connexion</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Créer un compte</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 text-sm text-blue-700 dark:text-blue-400 mb-8">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          Solution SaaS pour auto-écoles
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
          Gérez votre auto-école
          <span className="text-blue-600"> simplement</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10">
          Planifiez les passages au permis, suivez vos élèves et gérez les places d'examen —
          tout en un, depuis n'importe quel appareil.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/register">
            <Button size="lg" className="gap-2">
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button size="lg" variant="outline">
              J'ai déjà un compte
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Tout ce dont vous avez besoin
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: "Gestion des élèves",
                description: "Fiches élèves complètes avec suivi des heures de conduite, dates et historique des examens.",
              },
              {
                icon: CalendarDays,
                title: "Calendrier d'examens",
                description: "Calendrier annuel interactif. Placez vos élèves sur les dates d'examen avec moniteur et centre assignés.",
              },
              {
                icon: Shield,
                title: "Compteur de places",
                description: "Suivez les places disponibles par mois. Le compteur décrémente automatiquement à chaque placement.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 mb-4">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Access methods */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Deux façons d'accéder
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Choisissez l'accès qui vous convient
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Paiement en ligne</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Réglez en ligne via Stripe (carte bancaire). Accès immédiat et sécurisé.
            </p>
            {[
              "Paiement sécurisé par Stripe",
              "Accès instantané après paiement",
              "Toutes les fonctionnalités incluses",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Clé d'accès</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Vous avez reçu une clé d'accès de l'administrateur ? Activez votre compte en un instant.
            </p>
            {[
              "Clé unique générée par l'admin",
              "Activation immédiate",
              "Accès complet identique",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Prêt à gérer votre auto-école efficacement ?
          </h2>
          <p className="text-blue-100 mb-8">
            Créez votre compte en moins de 2 minutes.
          </p>
          <Link href="/auth/register">
            <Button size="lg" variant="secondary" className="gap-2">
              Créer mon compte <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">PlanPermis</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} PlanPermis. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
