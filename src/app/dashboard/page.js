import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/Layout";
import StatCard from "@/components/dashboard/StatCard";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Cpu,
  Target,
} from "lucide-react";

export const metadata = {
  title: "Dashboard | Pokémon Collection",
};

async function getStats(userId) {
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/stats`, {
      headers: {
        cookie: `next-auth.session-token=${process.env.AUTH_TOKEN}`,
      },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const stats = await getStats(session.user.id);

  return (
    <DashboardLayout user={session.user}>
      <div className="space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-dark-50 mb-2">
            Bienvenue, {session.user.name || "Collectionneur"}
          </h1>
          <p className="text-dark-400">
            Aperçu complet de votre collection Pokémon
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            label="Total de cartes"
            value={stats?.totalCards || 0}
            icon={Cpu}
            variant="primary"
          />
          <StatCard
            label="Produits scellés"
            value={stats?.totalSealed || 0}
            icon={Package}
          />
          <StatCard
            label="Total d'articles"
            value={stats?.totalItems || 0}
            icon={Target}
          />

          <StatCard
            label="Montant investi"
            value={`€${(stats?.totalInvested || 0).toFixed(2)}`}
            icon={Wallet}
          />
          <StatCard
            label="Valeur actuelle"
            value={`€${(stats?.currentValue || 0).toFixed(2)}`}
            icon={TrendingUp}
          />
        </div>

        {/* Gains Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-dark-50 mb-4">
              Gain potentiel
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-dark-400 text-sm mb-1">Montant</p>
                <p
                  className={`text-3xl font-bold ${
                    (stats?.potentialGain || 0) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  €{(stats?.potentialGain || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-dark-400 text-sm mb-1">Pourcentage</p>
                <p
                  className={`text-2xl font-bold ${
                    (stats?.potentialPercentage || 0) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {(stats?.potentialPercentage || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-dark-50 mb-4">
              Gain réalisé
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-dark-400 text-sm mb-1">Montant</p>
                <p
                  className={`text-3xl font-bold ${
                    (stats?.totalRealized || 0) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  €{(stats?.totalRealized || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-dark-400 text-sm mb-1">Pourcentage</p>
                <p
                  className={`text-2xl font-bold ${
                    (stats?.realizedPercentage || 0) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {(stats?.realizedPercentage || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/cards"
            className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-6 hover:border-brand-primary/50 transition group"
          >
            <Cpu size={32} className="text-brand-primary mb-3 group-hover:scale-110 transition" />
            <h3 className="text-lg font-semibold text-dark-50 mb-2">
              Gérer les cartes
            </h3>
            <p className="text-dark-400 text-sm">
              Ajouter, modifier ou vendre vos cartes Pokémon
            </p>
          </a>

          <a
            href="/sealed"
            className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-6 hover:border-brand-primary/50 transition group"
          >
            <Package size={32} className="text-brand-secondary mb-3 group-hover:scale-110 transition" />
            <h3 className="text-lg font-semibold text-dark-50 mb-2">
              Produits scellés
            </h3>
            <p className="text-dark-400 text-sm">
              Gérer vos boîtes, displays et coffrets
            </p>
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
