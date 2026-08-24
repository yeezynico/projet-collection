import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/Layout";
import { getStats } from "@/lib/stats";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  ChevronRight,
  Layers,
  Package,
} from "lucide-react";
import { getImageSrc } from "@/lib/image";

export const metadata = {
  title: "Portefeuille | Pokémon Collection",
};

export const dynamic = "force-dynamic";

function eur(n) {
  return `${(n ?? 0).toFixed(2)} €`;
}

/**
 * Nomme la variation selon son sens : « plus-value » n'a de sens qu'au-dessus
 * de zéro, « moins-value » en dessous.
 */
function deltaLabel(value, { realized = false } = {}) {
  if (value == null) return null;
  if (value === 0) return realized ? "Résultat des ventes" : "Aucune variation";
  const sign = value > 0 ? "Plus-value" : "Moins-value";
  return realized ? `${sign} réalisée` : `${sign} potentielle`;
}

/** Variation chiffrée, colorée selon le sens. */
function Delta({ value, percentage, className = "", iconSize = 15, percentClass = "" }) {
  if (value == null) return null;
  const positive = value > 0;
  const neutral = value === 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  // Montant et pourcentage sont chacun insécables : sur mobile, la coupure
  // se fait entre les deux plutôt qu'au milieu d'un nombre.
  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-1.5 font-bold ${
        neutral ? "text-dark-400" : positive ? "text-green-400" : "text-red-400"
      } ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {!neutral && <Icon size={iconSize} className="shrink-0" />}
        {positive ? "+" : ""}
        {eur(value)}
      </span>
      {percentage != null && (
        <span
          className={`opacity-70 font-semibold whitespace-nowrap ${percentClass}`}
        >
          ({positive ? "+" : ""}
          {percentage.toFixed(1)} %)
        </span>
      )}
    </span>
  );
}

/** Intitulé discret qui nomme le montant placé juste en dessous. */
function Label({ children, className = "" }) {
  return (
    <p className={`text-[11px] uppercase tracking-wider text-dark-500 ${className}`}>
      {children}
    </p>
  );
}

/**
 * Aperçu de la collection en éventail, occupant la zone libre à droite
 * des chiffres : entièrement visible, sans débord ni chevauchement.
 */
function PreviewStack({ images, sealed }) {
  if (!images?.length) return null;

  return (
    <div
      aria-hidden
      className="absolute right-5 bottom-4 flex items-end -space-x-4 pointer-events-none"
    >
      {images.map((src, i) => (
        <div
          key={i}
          style={{
            zIndex: images.length - i,
            rotate: `${(i - 1) * 7}deg`,
            translate: `0 ${Math.abs(i - 1) * 5}px`,
          }}
          className={`w-14 ${
            sealed ? "aspect-square" : "aspect-3/4"
          } rounded-md overflow-hidden bg-dark-950 ring-1 ring-white/12 shadow-[0_12px_28px_-8px_rgba(0,0,0,0.9)]`}
        >
          <img
            src={getImageSrc(src)}
            alt=""
            className={`w-full h-full ${sealed ? "object-contain p-1" : "object-cover"}`}
          />
        </div>
      ))}
    </div>
  );
}

/** Carte de synthèse pour une catégorie de collection. */
function SegmentCard({ href, icon: Icon, label, count, stats, accent, sealed }) {
  return (
    <Link
      href={href}
      className="surface surface-hover group relative overflow-hidden rounded-2xl p-4 transition"
    >
      <div className="relative z-10 flex items-center justify-between mb-3">
        <span className="flex items-center gap-2.5">
          <span className={`p-2 rounded-xl ${accent}`}>
            <Icon size={17} />
          </span>
          <span>
            <span className="block font-semibold text-dark-50">{label}</span>
            <span className="block text-xs text-dark-400">
              {count} élément{count > 1 ? "s" : ""}
            </span>
          </span>
        </span>
        <ChevronRight
          size={18}
          className="text-dark-600 group-hover:text-brand-primary group-hover:translate-x-0.5 transition"
        />
      </div>

      <div className="relative z-10 min-w-0 pr-28">
        <Label>Valeur</Label>
        <p className="text-2xl font-bold text-brand-primary whitespace-nowrap">
          {eur(stats.value)}
        </p>

        <Label className="mt-2">Investi</Label>
        <p className="text-sm font-semibold text-dark-100 whitespace-nowrap">
          {eur(stats.invested)}
        </p>

        <Label className="mt-2">{deltaLabel(stats.gain)}</Label>
        <Delta
          value={stats.gain}
          percentage={stats.gainPercentage}
          className="text-sm"
        />
      </div>

      <PreviewStack images={stats.previews} sealed={sealed} />
    </Link>
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
      <div className="space-y-4 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-dark-50">Portefeuille</h1>
          <p className="text-dark-500 text-sm mt-0.5">
            Bonjour {session.user.name || "collectionneur"}, voici votre collection.
          </p>
        </div>

        {/* Valeur totale */}
        <div className="surface rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="p-2 rounded-xl bg-brand-primary/12 text-brand-primary">
              <Wallet size={17} />
            </span>
            <div>
              <p className="font-semibold text-dark-50 leading-tight">
                Portefeuille global
              </p>
              <p className="text-xs text-dark-400">
                {stats.totalItems} élément{stats.totalItems > 1 ? "s" : ""} en
                collection
              </p>
            </div>
          </div>

          {/* Même libellé que sur les cartes de catégorie : le montant est
              nommé, pas seulement mis en avant. */}
          <Label>Valeur totale estimée</Label>
          <p className="text-3xl sm:text-4xl font-bold text-gradient-gold">
            {eur(stats.currentValue)}
          </p>

          {/* Mêmes tailles que les cartes de catégorie, pour que l'œil
              compare les montants sans changer d'échelle. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="surface rounded-2xl px-4 py-3">
              <Label className="mb-1">{deltaLabel(stats.potentialGain)}</Label>
              <Delta
                value={stats.potentialGain}
                percentage={stats.potentialPercentage}
                className="text-xl sm:text-2xl"
                iconSize={20}
                percentClass="text-sm sm:text-base"
              />
            </div>
            <div className="surface rounded-2xl px-4 py-3">
              <Label className="mb-1">Total investi</Label>
              <p className="text-xl sm:text-2xl font-bold text-dark-50 flex items-center gap-1.5 whitespace-nowrap">
                <ShoppingCart size={20} className="text-dark-400 shrink-0" />
                {eur(stats.totalInvested)}
              </p>
            </div>
          </div>
        </div>

        {/* Répartition : les trois blocs partagent une rangée pour que la
            page tienne à l'écran sans défilement. */}
        <div>
          <h2 className="text-sm font-semibold text-dark-300 mb-2.5">
            Mes investissements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <SegmentCard
              href="/cards"
              icon={Layers}
              label="Cartes"
              count={stats.totalCards}
              stats={stats.cards}
              accent="bg-brand-primary/12 text-brand-primary"
            />
            <SegmentCard
              href="/sealed"
              icon={Package}
              label="Produits scellés"
              count={stats.totalSealed}
              stats={stats.sealed}
              accent="bg-sky-500/12 text-sky-400"
              sealed
            />

            {/* Les ventes complètent la rangée : même gabarit que les
                deux catégories, avec le montant déjà encaissé. */}
            <Link
              href="/sales"
              className="surface surface-hover group relative overflow-hidden rounded-2xl p-4 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-green-500/12 text-green-400">
                    <TrendingUp size={17} />
                  </span>
                  <span>
                    <span className="block font-semibold text-dark-50">
                      Ventes
                    </span>
                    <span className="block text-xs text-dark-400">
                      {stats.totalSales} réalisée
                      {stats.totalSales > 1 ? "s" : ""}
                    </span>
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="text-dark-600 group-hover:text-brand-primary group-hover:translate-x-0.5 transition"
                />
              </div>

              <Label>Encaissé</Label>
              <p className="text-2xl font-bold text-brand-primary whitespace-nowrap">
                {eur(stats.totalSold)}
              </p>

              <Label className="mt-2">Coût d'achat</Label>
              <p className="text-sm font-semibold text-dark-100 whitespace-nowrap">
                {eur(stats.totalSold - stats.totalRealized)}
              </p>

              <Label className="mt-2">
                {deltaLabel(stats.totalRealized, { realized: true })}
              </Label>
              <Delta
                value={stats.totalRealized}
                percentage={stats.realizedPercentage}
                className="text-sm"
              />
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
