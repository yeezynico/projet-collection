"use client";

import { useState, useMemo } from "react";
import { X, ExternalLink, Check } from "lucide-react";
import { extractListings, average } from "@/lib/priceExtract";
import { buildFilteredUrl } from "@/lib/cardmarket";
import { CONDITION_STYLES } from "@/lib/categories";
import { useModalDismiss } from "@/components/ui/Modal";

const DEFAULT_KEPT = 5;

/** Seuls les exemplaires impeccables entrent dans l'estimation. */
const GOOD_CONDITIONS = new Set(["NM", "MT"]);

/**
 * Assistant de relevé de prix : l'utilisateur ouvre la page Cardmarket
 * filtrée, y copie tout, colle ici, et voit les annonces détectées.
 *
 * Chaque ligne affiche le vendeur et l'état pour qu'il sache exactement
 * quels montants entrent dans la moyenne.
 */
export default function CardmarketPriceModal({
  cardmarketUrl,
  language = "FR",
  onApply,
  onClose,
}) {
  useModalDismiss(onClose);

  const [pasted, setPasted] = useState("");
  const [selected, setSelected] = useState(null);

  const listings = useMemo(() => extractListings(pasted), [pasted]);

  // Par défaut : les cinq moins chères en Near Mint ou Mint. Un exemplaire
  // abîmé se vend bien en dessous et fausserait l'estimation.
  const defaultSelection = useMemo(() => {
    const good = [];
    listings.forEach((l, i) => {
      if (GOOD_CONDITIONS.has(l.condition)) good.push(i);
    });

    // Si l'état n'a pas pu être lu, on retombe sur les premières annonces.
    const pool = good.length > 0 ? good : listings.map((_, i) => i);
    return new Set(pool.slice(0, DEFAULT_KEPT));
  }, [listings]);

  const activeSelection = selected ?? defaultSelection;
  const kept = listings.filter((_, i) => activeSelection.has(i));
  const avg = average(kept.map((l) => l.value));

  // La page est ouverte déjà filtrée sur Near Mint minimum : Cardmarket
  // n'affiche alors que les NM et MT, ce qui évite tout tri manuel.
  const filteredUrl = cardmarketUrl
    ? buildFilteredUrl(cardmarketUrl, {
        sellerCountry: "FR",
        language,
        minCondition: "NM",
      })
    : null;

  function toggle(index) {
    const next = new Set(activeSelection);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
  }

  return (
    <div
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-dark-800 border border-dark-700 w-full h-full sm:h-auto sm:max-w-xl sm:rounded-2xl shadow-2xl overflow-y-auto sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-dark-900/90 text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition"
        >
          <X size={20} />
        </button>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="pr-10">
            <h2 className="text-lg font-bold text-dark-50">
              Relever le prix français
            </h2>
            <p className="text-sm text-dark-400 mt-1">
              Trois étapes, rien à installer.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-dark-100">
              <span className="text-brand-primary">1.</span> Ouvrir la page filtrée
            </p>
            {filteredUrl ? (
              <a
                href={filteredUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 btn-gold rounded-lg font-semibold hover:shadow-lg transition"
              >
                <ExternalLink size={16} />
                Ouvrir Cardmarket
              </a>
            ) : (
              <p className="text-sm text-dark-500">
                Renseignez d'abord le lien Cardmarket de l'article.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-dark-100">
              <span className="text-brand-primary">2.</span> Tout sélectionner et copier
            </p>
            <p className="text-sm text-dark-400">
              Sur la page Cardmarket :{" "}
              <kbd className="px-1.5 py-0.5 bg-dark-900 border border-dark-600 rounded text-xs">Ctrl</kbd>
              {" + "}
              <kbd className="px-1.5 py-0.5 bg-dark-900 border border-dark-600 rounded text-xs">A</kbd>
              {" puis "}
              <kbd className="px-1.5 py-0.5 bg-dark-900 border border-dark-600 rounded text-xs">Ctrl</kbd>
              {" + "}
              <kbd className="px-1.5 py-0.5 bg-dark-900 border border-dark-600 rounded text-xs">C</kbd>
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-dark-100">
              <span className="text-brand-primary">3.</span> Coller ici
            </p>
            <textarea
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setSelected(null);
              }}
              rows={3}
              placeholder="Collez ici avec Ctrl + V"
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 text-sm resize-none focus:border-brand-primary"
            />
          </div>

          {pasted && listings.length === 0 && (
            <p className="text-sm text-red-400">
              Aucune annonce détectée. Vérifiez d'avoir copié la page entière,
              annonces comprises.
            </p>
          )}

          {listings.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-dark-400">
                {listings.length} annonces détectées. Les {DEFAULT_KEPT} moins
                chères en <strong className="text-green-400">NM</strong> ou{" "}
                <strong className="text-blue-300">MT</strong> sont cochées ;
                cliquez pour ajuster.
              </p>

              <div className="border border-dark-700 rounded-lg divide-y divide-dark-700/70 max-h-56 overflow-y-auto">
                {listings.map((l, i) => {
                  const on = activeSelection.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggle(i)}
                      className={`flex items-center gap-3 w-full px-3 py-2 text-left transition ${
                        on ? "bg-green-500/10" : "hover:bg-dark-700/40"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 ${
                          on
                            ? "bg-green-500 border-green-500"
                            : "border-dark-500"
                        }`}
                      >
                        {on && <Check size={12} className="text-white" />}
                      </span>

                      <span
                        className={`font-bold tabular-nums shrink-0 ${
                          on ? "text-dark-50" : "text-dark-500"
                        }`}
                      >
                        {l.value.toFixed(2)} €
                      </span>

                      {l.condition && (
                        <span
                          className={`px-1.5 py-0.5 border rounded text-[10px] font-bold shrink-0 ${
                            CONDITION_STYLES[l.condition] || ""
                          }`}
                        >
                          {l.condition}
                        </span>
                      )}

                      <span className="text-xs text-dark-500 truncate">
                        {l.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {avg !== null && (
                <div className="bg-linear-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/30 rounded-xl px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-amber-200/70">
                    Moyenne de {kept.length} annonce{kept.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-2xl font-bold text-amber-300 mt-0.5">
                    {avg.toFixed(2)} €
                  </p>
                  {/* Détail du calcul : cocher une annonce plus chère que la
                      moyenne la fait monter, ce qui surprend sans explication. */}
                  <p className="text-[11px] text-amber-200/50 mt-1 wrap-break-word">
                    ({kept.map((l) => l.value.toFixed(2)).join(" + ")}) ÷{" "}
                    {kept.length}
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={avg === null}
                onClick={() => {
                  onApply(avg);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition disabled:opacity-40"
              >
                <Check size={16} />
                Utiliser ce prix
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
