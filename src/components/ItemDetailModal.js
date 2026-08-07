"use client";

import { useEffect } from "react";
import { X, ImageOff, ExternalLink } from "lucide-react";
import { getImageSrc } from "@/lib/image";
import { buildFilteredUrl } from "@/lib/cardmarket";
import {
  CONDITION_STYLES,
  getLanguage,
  getCondition,
} from "@/lib/categories";
import { buildSearchQuery, ebaySoldUrl, vintedUrl } from "@/lib/marketplaces";

/** Caractéristique affichée à droite de l'illustration. */
function Spec({ label, children }) {
  return (
    <div className="surface rounded-xl px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-dark-500">{label}</p>
      <div className="mt-0.5 font-semibold text-dark-50 text-sm leading-tight truncate">
        {children}
      </div>
    </div>
  );
}

/** Ligne de comparaison de prix vers une place de marché. */
function MarketRow({ href, logo, name, subtitle }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="surface surface-hover group flex items-center gap-3 rounded-xl p-3 transition"
    >
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-dark-950/60 shrink-0">
        {logo}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-dark-50">{name}</span>
        <span className="block text-xs text-dark-500">{subtitle}</span>
      </span>
      <span className="flex items-center gap-1.5 text-sm text-dark-400 group-hover:text-brand-primary transition shrink-0">
        Consulter
        <ExternalLink size={14} />
      </span>
    </a>
  );
}

/**
 * Fiche détaillée d'une carte ou d'un produit scellé.
 * Illustration et caractéristiques en haut, valeur mise en avant,
 * puis comparaison des places de marché.
 */
export default function ItemDetailModal({ item, kind = "card", onClose }) {
  useEffect(() => {
    if (!item) return;

    function onKey(e) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [item, onClose]);

  if (!item) return null;

  const isCard = kind === "card";
  const currentPrice = item.currentPrice ?? item.purchasePrice;
  const invested = item.purchasePrice * item.quantity;
  const value = currentPrice * item.quantity;
  const gain = value - invested;
  const gainPercent = invested > 0 ? (gain / invested) * 100 : null;

  const language = getLanguage(item.language);
  const condition = getCondition(item.condition);
  const query = buildSearchQuery(item, kind);

  const cmUrl = item.cardmarketUrl
    ? buildFilteredUrl(item.cardmarketUrl, {
        sellerCountry: "FR",
        language: item.language || "FR",
        minCondition: null,
      })
    : null;

  const purchaseDate = item.purchaseDate
    ? new Date(item.purchaseDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-dark-900 border border-white/8 w-full h-full sm:h-auto sm:max-w-3xl sm:rounded-3xl shadow-2xl overflow-hidden sm:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hors de la zone défilante : la croix reste toujours accessible. */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-dark-950/80 backdrop-blur border border-white/8 text-dark-300 hover:text-dark-50 hover:border-brand-primary/40 transition"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto">
        {/* Illustration et caractéristiques */}
        <div className="relative px-5 sm:px-8 pt-8 pb-6">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-64 bg-linear-to-b from-brand-primary/12 to-transparent pointer-events-none"
          />

          <div className="relative flex flex-col sm:flex-row gap-6">
            <div
              className={`mx-auto sm:mx-0 w-44 shrink-0 ${
                isCard ? "aspect-3/4" : "aspect-square"
              } rounded-2xl overflow-hidden bg-dark-950 ring-1 ring-white/10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)]`}
            >
              {item.imageUrl ? (
                <img
                  src={getImageSrc(item.imageUrl)}
                  alt={item.name}
                  className={`w-full h-full ${
                    isCard ? "object-cover" : "object-contain p-2"
                  }`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-dark-600">
                  <ImageOff size={40} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-2 gap-2.5 content-start pt-1">
              <div className="col-span-2">
                <Spec label={isCard ? "Catégorie" : "Type"}>
                  {(isCard ? item.category : item.type) || "—"}
                </Spec>
              </div>

              <Spec label="Langue">
                {language ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{language.flag}</span>
                    {language.label}
                  </span>
                ) : (
                  "—"
                )}
              </Spec>

              <Spec label="État">
                {condition ? (
                  <span
                    className={`inline-block px-2 py-0.5 border rounded-md text-xs font-bold ${
                      CONDITION_STYLES[condition.value] || ""
                    }`}
                  >
                    {condition.short}
                  </span>
                ) : (
                  "—"
                )}
              </Spec>

              <Spec label="Quantité">{item.quantity}</Spec>
              <Spec label="Acheté le">{purchaseDate || "—"}</Spec>
            </div>
          </div>
        </div>

        {/* Identité */}
        <div className="px-5 sm:px-8 pb-6 text-center border-b border-white/6">
          <h2 className="text-2xl font-bold text-dark-50 leading-tight">
            {item.name}
            {isCard && item.number && (
              <span className="text-dark-500"> {item.number}</span>
            )}
          </h2>
          <p className="text-dark-400 mt-1">
            {isCard ? item.extension : item.type}
          </p>
        </div>

        {/* Valeur */}
        <div className="px-5 sm:px-8 py-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="surface-gold rounded-2xl px-4 py-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-dark-500">
                Estimation
              </p>
              <p className="text-3xl font-bold text-gradient-gold mt-1">
                {currentPrice.toFixed(2)} €
              </p>
            </div>

            <div className="surface rounded-2xl px-4 py-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-dark-500">
                Prix d'achat
              </p>
              <p className="text-3xl font-bold text-dark-50 mt-1">
                {item.purchasePrice.toFixed(2)} €
              </p>
            </div>

            <div
              className={`rounded-2xl px-4 py-4 text-center border ${
                gain > 0
                  ? "bg-green-500/8 border-green-500/25"
                  : gain < 0
                    ? "bg-red-500/8 border-red-500/25"
                    : "surface"
              }`}
            >
              <p className="text-[11px] uppercase tracking-wider text-dark-500">
                Gain
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  gain > 0
                    ? "text-green-400"
                    : gain < 0
                      ? "text-red-400"
                      : "text-dark-300"
                }`}
              >
                {gain >= 0 ? "+" : ""}
                {gain.toFixed(2)} €
              </p>
              {gainPercent !== null && (
                <p
                  className={`text-xs mt-0.5 ${
                    gain > 0 ? "text-green-400/70" : gain < 0 ? "text-red-400/70" : "text-dark-500"
                  }`}
                >
                  {gainPercent >= 0 ? "+" : ""}
                  {gainPercent.toFixed(1)} %
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Comparaison des places de marché */}
        <div className="px-5 sm:px-8 pb-8 space-y-2.5">
          <h3 className="text-sm font-semibold text-dark-200 mb-3">
            Comparer les prix
          </h3>

          <MarketRow
            href={cmUrl}
            name="Cardmarket"
            subtitle={`Annonces en cours · vendeurs FR${
              language ? ` · ${language.label.toLowerCase()}` : ""
            }`}
            logo={
              <span className="text-[10px] font-black text-[#4a8fd4] tracking-tight">
                CM
              </span>
            }
          />

          <MarketRow
            href={ebaySoldUrl(query)}
            name="eBay"
            subtitle="Ventes réalisées · prix réellement payés"
            logo={
              <span className="text-[10px] font-black tracking-tight">
                <span className="text-[#e53238]">e</span>
                <span className="text-[#0064d2]">b</span>
                <span className="text-[#f5af02]">a</span>
                <span className="text-[#86b817]">y</span>
              </span>
            }
          />

          <MarketRow
            href={vintedUrl(query)}
            name="Vinted"
            subtitle="Annonces en cours"
            logo={
              <span className="text-[10px] font-black text-[#09b1ba] tracking-tight">
                V
              </span>
            }
          />
        </div>
        </div>
      </div>
    </div>
  );
}
