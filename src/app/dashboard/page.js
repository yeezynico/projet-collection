import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/Layout";
import { getStats } from "@/lib/stats";
import { Cpu, Package, TrendingUp, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Dashboard | Pokémon Collection",
};

export const dynamic = "force-dynamic";

function fmt(n) {
  return `€${(n ?? 0).toFixed(2)}`;
}

function GainBadge({ gain, percentage, size = "md" }) {
  const positive = gain >= 0;
  const color = gain === 0 ? "text-dark-400" : positive ? "text-green-400" : "text-red-400";
  const textSize = size === "lg" ? "text-lg" : "text-sm";

  return (
    <span className={`font-semibold ${color} ${textSize}`}>
      {positive ? "+" : ""}{fmt(gain)}
      {percentage !== null && percentage !== undefined && (
        <span className="opacity-80"> ({positive ? "+" : ""}{percentage.toFixed(1)}%)</span>
      )}
    </span>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const stats = await getStats(session.user.id);

  return (
    <DashboardLayout user={session.user}>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">
            Bonjour, {session.user.name || "Collectionneur"}
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            Aperçu de votre collection Pokémon
          </p>
        </div>

        {/* Hero: valeur totale */}
        <div className="bg-linear-to-br from-brand-primary/10 via-dark-800/50 to-brand-secondary/10 border border-dark-700 rounded-2xl p-8">
          <p className="text-dark-400 text-sm mb-2">Valeur totale de la collection</p>
          <div className="flex items-end gap-4 flex-wrap">
            <p className="text-4xl md:text-5xl font-bold text-dark-50">
              {fmt(stats.currentValue)}
            </p>
            <div className="pb-1.5">
              <GainBadge gain={stats.potentialGain} percentage={stats.potentialPercentage} size="lg" />
            </div>
          </div>
          <p className="text-dark-500 text-sm mt-3">
            {fmt(stats.totalInvested)} investis · {stats.totalItems} article{stats.totalItems > 1 ? "s" : ""}
          </p>
        </div>

        {/* Répartition Cartes / Scellés */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/cards"
            className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-5 hover:border-brand-primary/50 transition group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-primary/10 rounded-lg">
                  <Cpu size={18} className="text-brand-primary" />
                </div>
                <span className="font-semibold text-dark-50">Cartes</span>
                <span className="text-dark-500 text-sm">· {stats.totalCards}</span>
              </div>
              <ArrowRight size={16} className="text-dark-500 group-hover:translate-x-0.5 group-hover:text-brand-primary transition" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <p className="text-dark-500 text-xs">Investi</p>
                <p className="text-dark-200 font-medium">{fmt(stats.cards.invested)}</p>
              </div>
              <div>
                <p className="text-dark-500 text-xs">Valeur actuelle</p>
                <p className="text-dark-200 font-medium">{fmt(stats.cards.value)}</p>
              </div>
            </div>

            <GainBadge gain={stats.cards.gain} percentage={stats.cards.gainPercentage} />
          </Link>

          <Link
            href="/sealed"
            className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-5 hover:border-brand-secondary/50 transition group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-secondary/10 rounded-lg">
                  <Package size={18} className="text-brand-secondary" />
                </div>
                <span className="font-semibold text-dark-50">Scellés</span>
                <span className="text-dark-500 text-sm">· {stats.totalSealed}</span>
              </div>
              <ArrowRight size={16} className="text-dark-500 group-hover:translate-x-0.5 group-hover:text-brand-secondary transition" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <p className="text-dark-500 text-xs">Investi</p>
                <p className="text-dark-200 font-medium">{fmt(stats.sealed.invested)}</p>
              </div>
              <div>
                <p className="text-dark-500 text-xs">Valeur actuelle</p>
                <p className="text-dark-200 font-medium">{fmt(stats.sealed.value)}</p>
              </div>
            </div>

            <GainBadge gain={stats.sealed.gain} percentage={stats.sealed.gainPercentage} />
          </Link>
        </div>

        {/* Gain réalisé */}
        <Link
          href="/sales"
          className="flex items-center justify-between bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-5 hover:border-dark-600 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-dark-50">Gain réalisé</p>
              <p className="text-dark-500 text-xs">
                {stats.totalSales} vente{stats.totalSales > 1 ? "s" : ""} au total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GainBadge gain={stats.totalRealized} percentage={stats.realizedPercentage} size="lg" />
            <ArrowRight size={16} className="text-dark-500 group-hover:translate-x-0.5 transition" />
          </div>
        </Link>
      </div>
    </DashboardLayout>
  );
}
