"use client";

import { useEffect } from "react";
import { X, ImageOff, Clock, ArrowUpRight } from "lucide-react";
import { getImageSrc } from "@/lib/image";
import { buildFilteredUrl } from "@/lib/cardmarket";
import {
  CONDITION_STYLES,
  getLanguage,
  getCondition,
} from "@/lib/categories";

/** Petite pastille libellé / valeur, réutilisée pour toutes les caractéristiques. */
function Chip({ label, children }) {
  return (
    <div className="bg-dark-900/70 border border-dark-700/80 rounded-xl px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-dark-500">{label}</p>
      <div className="mt-1 font-semibold text-dark-50 text-sm leading-tight">
        {children}
      </div>
    </div>
  );
}

/**
 * Fiche détaillée d'une carte ou d'un produit scellé.
 * Illustration à gauche, caractéristiques à droite : tout tient à l'écran
 * sans défilement sur desktop, et s'empile proprement sur mobile.
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

  // Lien Cardmarket filtré sur les vendeurs français et la langue de l'exemplaire.
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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-dark-800 border border-dark-700 w-full h-full sm:h-auto sm:max-w-3xl sm:rounded-3xl shadow-2xl overflow-y-auto sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-dark-900/90 backdrop-blur text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition"
        >
          <X size={20} />
        </button>

        <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-6">
          {/* Illustration, taille contenue pour rester entièrement visible */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <div
              className={`w-40 sm:w-52 ${
                isCard ? "aspect-3/4" : "aspect-square"
              } rounded-2xl overflow-hidden bg-dark-900 shadow-xl ring-1 ring-white/10`}
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
          </div>

          {/* Colonne d'informations */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="pr-10">
              <h2 className="text-xl sm:text-2xl font-bold text-dark-50 leading-tight">
                {item.name}
                {isCard && item.number && (
                  <span className="text-dark-500 font-semibold"> {item.number}</span>
                )}
              </h2>
              <p className="text-dark-400 text-sm mt-0.5">
                {isCard ? item.extension : item.type}
                {item.quantity > 1 && (
                  <span className="text-brand-primary font-semibold">
                    {" · "}
                    {item.quantity} ex.
                  </span>
                )}
              </p>
            </div>

            {/* Prix */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-linear-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/30 rounded-xl px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-amber-200/70">
                  Estimation
                </p>
                <p className="text-xl font-bold text-amber-300 mt-0.5">
                  {currentPrice.toFixed(2)} €
                </p>
              </div>

              <div className="bg-dark-900/70 border border-dark-700/80 rounded-xl px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-dark-500">
                  Prix d'achat
                </p>
                <p className="text-xl font-bold text-dark-50 mt-0.5">
                  {item.purchasePrice.toFixed(2)} €
                </p>
              </div>
            </div>

            {/* Gain */}
            <div
              className={`rounded-xl px-3 py-2.5 border ${
                gain > 0
                  ? "bg-green-500/10 border-green-500/25"
                  : gain < 0
                    ? "bg-red-500/10 border-red-500/25"
                    : "bg-dark-900/70 border-dark-700/80"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-dark-500">
                Gain potentiel
                {item.quantity > 1 && ` · ${invested.toFixed(2)} € investis`}
              </p>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  gain > 0
                    ? "text-green-400"
                    : gain < 0
                      ? "text-red-400"
                      : "text-dark-300"
                }`}
              >
                {gain >= 0 ? "+" : ""}
                {gain.toFixed(2)} €
                {gainPercent !== null && (
                  <span className="text-sm ml-1 opacity-80">
                    ({gainPercent >= 0 ? "+" : ""}
                    {gainPercent.toFixed(1)} %)
                  </span>
                )}
              </p>
            </div>

            {/* Caractéristiques */}
            <div className="grid grid-cols-2 gap-2.5">
              <Chip label={isCard ? "Catégorie" : "Type"}>
                {(isCard ? item.category : item.type) || "—"}
              </Chip>

              <Chip label="Langue">
                {language ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{language.flag}</span>
                    {language.label}
                  </span>
                ) : (
                  "—"
                )}
              </Chip>

              <Chip label="État">
                {condition ? (
                  <span
                    className={`inline-block px-2 py-0.5 border rounded-md text-xs font-bold ${
                      CONDITION_STYLES[condition.value] || ""
                    }`}
                  >
                    {condition.short} · {condition.label}
                  </span>
                ) : (
                  "—"
                )}
              </Chip>

              <Chip label="Acheté le">{purchaseDate || "—"}</Chip>
            </div>

            {item.priceSource && (
              <p className="flex items-center gap-1.5 text-[11px] text-dark-500">
                <Clock size={11} />
                {item.priceSource}
                {item.priceUpdatedAt && ` · ${item.priceUpdatedAt}`}
              </p>
            )}

            {cmUrl && (
              <a
                href={cmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 w-full p-3 bg-dark-900/70 border border-dark-700 rounded-xl hover:border-brand-primary/50 hover:bg-dark-900 transition"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#012169] text-white font-bold text-xs shrink-0">
                  CM
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block text-sm font-semibold text-dark-50">
                    Voir sur Cardmarket
                  </span>
                  <span className="block text-[11px] text-dark-500">
                    Vendeurs FR
                    {language && ` · ${language.label.toLowerCase()}`}
                  </span>
                </span>
                <ArrowUpRight
                  size={18}
                  className="text-dark-500 group-hover:text-brand-primary transition shrink-0"
                />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
