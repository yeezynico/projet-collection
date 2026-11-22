"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import {
  Plus,
  Search,
  ImageOff,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
} from "lucide-react";
import { getImageSrc } from "@/lib/image";
import Modal from "@/components/ui/Modal";

export default function FuturePurchasesPage() {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLotName, setNewLotName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pickerLotId, setPickerLotId] = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);

  const fetchLots = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shopping-lots");
      if (res.ok) setLots(await res.json());
    } catch (error) {
      console.error("Error fetching lots:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  async function createLot(e) {
    e.preventDefault();
    const name = newLotName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch("/api/shopping-lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const lot = await res.json();
        setLots((prev) => [lot, ...prev]);
        setNewLotName("");
        setExpandedId(lot.id);
      }
    } catch (error) {
      console.error("Error creating lot:", error);
    } finally {
      setCreating(false);
    }
  }

  async function renameLot(lot) {
    const name = renameValue.trim();
    if (!name || name === lot.name) {
      setRenamingId(null);
      return;
    }

    const previous = lots;
    setLots((prev) => prev.map((l) => (l.id === lot.id ? { ...l, name } : l)));
    setRenamingId(null);

    try {
      const res = await fetch(`/api/shopping-lots/${lot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) setLots(previous);
    } catch (error) {
      console.error("Error renaming lot:", error);
      setLots(previous);
    }
  }

  async function deleteLot(lot) {
    if (
      !confirm(
        `Supprimer le lot « ${lot.name} » ? Les cartes suivies elles-mêmes restent inchangées.`
      )
    )
      return;

    const previous = lots;
    setLots((prev) => prev.filter((l) => l.id !== lot.id));

    try {
      const res = await fetch(`/api/shopping-lots/${lot.id}`, { method: "DELETE" });
      if (!res.ok) setLots(previous);
    } catch (error) {
      console.error("Error deleting lot:", error);
      setLots(previous);
    }
  }

  async function removeCardFromLot(lot, card) {
    const previous = lots;
    setLots((prev) =>
      prev.map((l) =>
        l.id === lot.id ? { ...l, cards: l.cards.filter((c) => c.id !== card.id) } : l
      )
    );

    try {
      const res = await fetch(`/api/shopping-lots/${lot.id}/cards/${card.id}`, {
        method: "DELETE",
      });
      if (!res.ok) setLots(previous);
    } catch (error) {
      console.error("Error removing card from lot:", error);
      setLots(previous);
    }
  }

  async function addCardToLot(lot, card) {
    const previous = lots;
    setLots((prev) =>
      prev.map((l) => (l.id === lot.id ? { ...l, cards: [...l.cards, card] } : l))
    );

    try {
      const res = await fetch(`/api/shopping-lots/${lot.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id }),
      });
      if (!res.ok) setLots(previous);
    } catch (error) {
      console.error("Error adding card to lot:", error);
      setLots(previous);
    }
  }

  async function openPicker(lot) {
    setPickerLotId(lot.id);
    setPickerSearch("");
    setPickerLoading(true);
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) setAllCards(await res.json());
    } catch (error) {
      console.error("Error fetching watched cards:", error);
    } finally {
      setPickerLoading(false);
    }
  }

  function lotTotal(lot) {
    const priced = lot.cards.filter((c) => c.currentPrice != null);
    const total = priced.reduce((sum, c) => sum + c.currentPrice * c.quantity, 0);
    return { total, unpriced: lot.cards.length - priced.length };
  }

  // Dérivé de `lots` à chaque rendu (plutôt qu'un instantané figé) : la
  // liste des cartes déjà dedans reste à jour pendant qu'on en ajoute.
  const pickerLot = pickerLotId ? lots.find((l) => l.id === pickerLotId) : null;
  const pickerResults = pickerLot
    ? allCards.filter(
        (c) =>
          !pickerLot.cards.some((lc) => lc.id === c.id) &&
          (!pickerSearch || c.name.toLowerCase().includes(pickerSearch.toLowerCase()))
      )
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark-50">Futur achat</h1>
            <p className="text-dark-400 mt-1">
              Simulez le coût d&apos;un lot de cartes suivies, sans les acheter.
            </p>
          </div>
        </div>

        <form onSubmit={createLot} className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={newLotName}
            onChange={(e) => setNewLotName(e.target.value)}
            placeholder="Nom du lot (ex: Alt 30 ans)"
            className="flex-1 min-w-64 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-50"
          />
          <button
            type="submit"
            disabled={creating || !newLotName.trim()}
            className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={18} /> Nouveau lot
          </button>
        </form>

        {loading ? (
          <p className="text-center py-12 text-dark-400">Chargement...</p>
        ) : lots.length === 0 ? (
          <div className="text-center py-12 surface rounded-2xl">
            <ShoppingBag size={32} className="mx-auto text-dark-600 mb-3" />
            <p className="text-dark-400">
              Aucun lot pour le moment. Créez-en un ci-dessus, ou ajoutez une carte à un
              lot depuis la page Cartes à suivre.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lots.map((lot) => {
              const { total, unpriced } = lotTotal(lot);
              const expanded = expandedId === lot.id;

              return (
                <div key={lot.id} className="surface rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <button
                      onClick={() => setExpandedId(expanded ? null : lot.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      {expanded ? (
                        <ChevronUp size={18} className="text-dark-400 shrink-0" />
                      ) : (
                        <ChevronDown size={18} className="text-dark-400 shrink-0" />
                      )}
                      {renamingId === lot.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameLot(lot);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => renameLot(lot)}
                          className="px-2 py-1 bg-dark-900 border border-brand-primary rounded text-dark-50 text-lg font-semibold"
                        />
                      ) : (
                        <h2 className="text-lg font-semibold text-dark-50 truncate">
                          {lot.name}
                        </h2>
                      )}
                      <span className="text-sm text-dark-500 shrink-0">
                        {lot.cards.length} carte{lot.cards.length > 1 ? "s" : ""}
                      </span>
                    </button>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-brand-primary leading-tight">
                        €{total.toFixed(2)}
                      </p>
                      {unpriced > 0 && (
                        <p className="text-[10px] text-dark-500">{unpriced} sans prix</p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setRenamingId(lot.id);
                        setRenameValue(lot.name);
                      }}
                      title="Renommer"
                      className="p-1.5 text-dark-400 hover:text-brand-primary transition shrink-0"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteLot(lot)}
                      title="Supprimer le lot"
                      className="p-1.5 text-dark-400 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {expanded && (
                    <div className="border-t border-dark-700 p-4 space-y-3">
                      {lot.cards.length === 0 ? (
                        <p className="text-sm text-dark-500 text-center py-4">
                          Aucune carte dans ce lot pour le moment.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                          {lot.cards.map((card) => (
                            <div
                              key={card.id}
                              className="surface rounded-lg overflow-hidden relative"
                            >
                              <button
                                onClick={() => removeCardFromLot(lot, card)}
                                title="Retirer du lot"
                                className="absolute top-1 right-1 z-10 p-1 bg-dark-950/90 border border-dark-600 rounded text-dark-300 hover:text-red-400 hover:border-red-400 transition"
                              >
                                <X size={12} />
                              </button>
                              <div className="aspect-3/4 bg-dark-900 flex items-center justify-center">
                                {card.imageUrl ? (
                                  <img
                                    src={getImageSrc(card.imageUrl)}
                                    alt={card.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageOff size={20} className="text-dark-600" />
                                )}
                              </div>
                              <div className="p-1.5">
                                <p
                                  className="text-[10px] font-medium text-dark-100 truncate"
                                  title={card.name}
                                >
                                  {card.name}
                                </p>
                                <p className="text-[10px] text-brand-primary font-semibold">
                                  {card.currentPrice != null
                                    ? `€${(card.currentPrice * card.quantity).toFixed(2)}`
                                    : "prix ?"}
                                  {card.quantity > 1 && ` (×${card.quantity})`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => openPicker(lot)}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-700 text-dark-200 rounded-lg hover:bg-dark-600 transition text-sm font-medium"
                      >
                        <Plus size={16} /> Ajouter des cartes
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pickerLot && (
        <Modal
          onClose={() => setPickerLotId(null)}
          panelClassName="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-lg font-semibold text-dark-50">
              Ajouter des cartes à « {pickerLot.name} »
            </h2>
            <button
              onClick={() => setPickerLotId(null)}
              className="text-dark-400 hover:text-dark-100"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative mb-4 shrink-0">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500"
            />
            <input
              type="text"
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Rechercher une carte suivie..."
              className="w-full pl-10 pr-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {pickerLoading ? (
              <p className="text-center py-8 text-dark-400">Chargement...</p>
            ) : pickerResults.length === 0 ? (
              <p className="text-center py-8 text-dark-400">
                {allCards.length === 0
                  ? "Aucune carte suivie. Ajoutez-en depuis la page Cartes à suivre."
                  : "Toutes les cartes correspondantes sont déjà dans ce lot."}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {pickerResults.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => addCardToLot(pickerLot, card)}
                    className="surface surface-hover rounded-lg overflow-hidden text-left transition"
                  >
                    <div className="aspect-3/4 bg-dark-900 flex items-center justify-center">
                      {card.imageUrl ? (
                        <img
                          src={getImageSrc(card.imageUrl)}
                          alt={card.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageOff size={18} className="text-dark-600" />
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-[10px] font-medium text-dark-100 truncate">
                        {card.name}
                      </p>
                      <p className="text-[10px] text-dark-500 truncate">
                        {card.currentPrice != null
                          ? `€${card.currentPrice.toFixed(2)}`
                          : "prix ?"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
