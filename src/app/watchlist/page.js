"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import {
  Plus,
  Search,
  ImageOff,
  Tag,
  SlidersHorizontal,
  Pencil,
  Link2,
  Loader2,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import { getImageSrc } from "@/lib/image";
import Modal from "@/components/ui/Modal";
import {
  CARD_CATEGORIES,
  LANGUAGES,
  CONDITIONS,
  getLanguage,
} from "@/lib/categories";
import { buildFilteredUrl } from "@/lib/cardmarket";
import ItemDetailModal from "@/components/ItemDetailModal";
import CardmarketPriceModal from "@/components/CardmarketPriceModal";

const emptyForm = {
  externalId: "",
  name: "",
  extension: "",
  number: "",
  category: "",
  language: "FR",
  condition: "NM",
  quantity: "1",
  currentPrice: "",
  priceDate: "",
  priceSource: "",
  priceUpdatedAt: "",
  imageUrl: "",
  cardmarketUrl: "",
};

export default function CardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("custom");
  const [draggedId, setDraggedId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [buyingCard, setBuyingCard] = useState(null);
  const [buyData, setBuyData] = useState({
    quantity: "1",
    purchasePrice: "0",
    currentPrice: "",
    purchaseDate: new Date().toISOString().split("T")[0],
  });
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [lots, setLots] = useState([]);
  const [lotPickerCard, setLotPickerCard] = useState(null);
  const [newLotName, setNewLotName] = useState("");
  const [editingCard, setEditingCard] = useState(null);
  const [editData, setEditData] = useState(emptyForm);
  const [detailCard, setDetailCard] = useState(null);
  const [priceHelper, setPriceHelper] = useState(null);
  const [lookupUrl, setLookupUrl] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupInfo, setLookupInfo] = useState("");
  const [lookupCandidates, setLookupCandidates] = useState([]);
  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState([]);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameTotal, setNameTotal] = useState(0);

  function toggleIn(setter) {
    return (value) =>
      setter((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
  }

  const toggleCategory = toggleIn(setSelectedCategories);
  const toggleLanguage = toggleIn(setSelectedLanguages);
  const toggleCondition = toggleIn(setSelectedConditions);

  const activeFilterCount =
    selectedCategories.length + selectedLanguages.length + selectedConditions.length;

  /** Recopie une version de carte dans le formulaire. */
  function applyCandidate(c) {
    setFormData((prev) => ({
      ...prev,
      externalId: c.externalId || prev.externalId,
      name: c.name || prev.name,
      extension: c.extension || prev.extension,
      number: c.number || prev.number,
      category: c.category || prev.category,
      imageUrl: c.imageUrl || prev.imageUrl,
      cardmarketUrl: c.cardmarketUrl || lookupUrl.trim(),
      currentPrice:
        c.suggestedPrice != null ? c.suggestedPrice.toFixed(2) : prev.currentPrice,
      priceSource: c.priceSource || "",
      priceUpdatedAt: c.priceUpdatedAt || "",
    }));

    const base =
      c.suggestedPrice != null
        ? `${c.name} n°${c.number} — prix indicatif ${c.suggestedPrice.toFixed(2)} € (${c.priceSource}, maj ${c.priceUpdatedAt}). Moyenne européenne toutes langues : vérifiez sur Cardmarket.`
        : `${c.name} n°${c.number} récupérée. Aucun prix de référence, saisissez-le manuellement.`;

    // Cette carte n'a pas de correspondance connue : son lien a été composé
    // et peut tomber à côté. Mieux vaut le dire que le laisser croire exact.
    setLookupInfo(
      c.cardmarketUrlGuessed
        ? `${base} Le lien Cardmarket est reconstitué : vérifiez qu'il ouvre bien la bonne fiche.`
        : base
    );
  }

  /** Cherche une carte par son nom français, sans passer par Cardmarket. */
  async function searchByName() {
    const query = nameQuery.trim();
    if (query.length < 2) return;

    setNameLoading(true);
    setNameError("");
    setLookupInfo("");
    setNameResults([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok) {
        setNameError(data.error || "Recherche impossible");
        return;
      }

      setNameResults(data.results);
      setNameTotal(data.total || data.results.length);

      if (!data.results.length) {
        setNameError(`Aucune carte ne correspond à « ${query} ».`);
      }
    } catch {
      setNameError("Erreur réseau lors de la recherche");
    } finally {
      setNameLoading(false);
    }
  }

  /** Charge la fiche complète de la carte choisie et remplit le formulaire. */
  async function pickSearchResult(card) {
    setNameError("");
    setLookupCandidates([]);

    try {
      const res = await fetch(`/api/lookup?id=${encodeURIComponent(card.id)}`);
      const data = await res.json();

      if (!res.ok) {
        setNameError(data.error || "Chargement impossible");
        return;
      }

      applyCandidate(data);
      // La grille disparaît : le formulaire rempli devient le sujet.
      setNameResults([]);
      setNameQuery("");
    } catch {
      setNameError("Erreur réseau lors du chargement de la carte");
    }
  }

  /** Remplit le formulaire à partir d'un lien Cardmarket. */
  async function handleLookup() {
    if (!lookupUrl.trim()) return;

    setLookupLoading(true);
    setLookupError("");
    setLookupInfo("");
    setLookupCandidates([]);

    try {
      const res = await fetch(`/api/lookup?url=${encodeURIComponent(lookupUrl.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setLookupError(data.error || "Récupération impossible");
        return;
      }

      applyCandidate(data);
      setLookupCandidates(data.candidates || []);

      // Le lien ne désigne pas une version précise : on propose le choix.
      if (data.multiple) {
        setLookupInfo(
          `${data.candidates.length} versions trouvées pour « ${data.name} ». Sélectionnez la vôtre ci-dessous.`
        );
      }
    } catch {
      setLookupError("Erreur réseau lors de la récupération");
    } finally {
      setLookupLoading(false);
    }
  }

  // Debounce la recherche pour éviter une requête réseau à chaque frappe
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (sort) params.append("sort", sort);

      const res = await fetch(`/api/watchlist?${params}`);
      if (res.ok) {
        setCards(await res.json());
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const fetchLots = useCallback(async () => {
    try {
      const res = await fetch("/api/shopping-lots");
      if (res.ok) setLots(await res.json());
    } catch (error) {
      console.error("Error fetching shopping lots:", error);
    }
  }, []);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  /** Ajoute ou retire une carte d'un lot depuis le sélecteur rapide. */
  async function toggleCardInLot(lot, card) {
    const inLot = lot.cards.some((c) => c.id === card.id);
    const previous = lots;
    setLots((prev) =>
      prev.map((l) =>
        l.id === lot.id
          ? {
              ...l,
              cards: inLot
                ? l.cards.filter((c) => c.id !== card.id)
                : [...l.cards, card],
            }
          : l
      )
    );

    try {
      const res = await fetch(
        inLot
          ? `/api/shopping-lots/${lot.id}/cards/${card.id}`
          : `/api/shopping-lots/${lot.id}/cards`,
        {
          method: inLot ? "DELETE" : "POST",
          headers: inLot ? undefined : { "Content-Type": "application/json" },
          body: inLot ? undefined : JSON.stringify({ cardId: card.id }),
        }
      );
      if (!res.ok) setLots(previous);
    } catch (error) {
      console.error("Error toggling card in lot:", error);
      setLots(previous);
    }
  }

  /** Crée un nouveau lot et y ajoute directement la carte en cours. */
  async function createLotWithCard(card) {
    const name = newLotName.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/shopping-lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const lot = await res.json();
      setNewLotName("");

      const addRes = await fetch(`/api/shopping-lots/${lot.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id }),
      });
      const finalLot = addRes.ok ? { ...lot, cards: [card] } : lot;
      setLots((prev) => [finalLot, ...prev]);
    } catch (error) {
      console.error("Error creating lot:", error);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity) || 1,
          currentPrice: formData.currentPrice
            ? parseFloat(formData.currentPrice)
            : null,
        }),
      });

      if (res.ok) {
        const newCard = await res.json();
        setCards((prev) => [newCard, ...prev]);
        setFormData(emptyForm);
        setLookupUrl("");
        setLookupInfo("");
        setLookupError("");
        setLookupCandidates([]);
        setShowForm(false);
      }
    } catch (error) {
      console.error("Error adding card:", error);
    }
  }

  async function deleteCard(id) {
    if (!confirm("Êtes-vous sûr ?")) return;

    const previous = cards;
    setCards((prev) => prev.filter((c) => c.id !== id));

    try {
      const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      if (!res.ok) setCards(previous);
    } catch (error) {
      console.error("Error deleting card:", error);
      setCards(previous);
    }
  }

  function openEditModal(card) {
    setEditingCard(card);
    setEditData({
      // Identifiant de la carte dans la base de référence, conservé tel quel.
      externalId: card.externalId ?? "",
      name: card.name ?? "",
      extension: card.extension ?? "",
      number: card.number ?? "",
      category: card.category ?? "",
      language: card.language ?? "",
      condition: card.condition ?? "",
      quantity: card.quantity.toString(),
      currentPrice: card.currentPrice != null ? card.currentPrice.toString() : "",
      // Toujours la date du jour par défaut : seule une modification
      // volontaire de ce champ date le point ailleurs dans le temps.
      priceDate: new Date().toISOString().split("T")[0],
      priceSource: card.priceSource ?? "",
      priceUpdatedAt: card.priceUpdatedAt ?? "",
      imageUrl: card.imageUrl ?? "",
      cardmarketUrl: card.cardmarketUrl ?? "",
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editingCard) return;

    const payload = {
      ...editData,
      quantity: parseInt(editData.quantity) || 1,
      currentPrice:
        editData.currentPrice === "" ? null : parseFloat(editData.currentPrice),
    };

    const previous = cards;
    setCards((prev) =>
      prev.map((c) => (c.id === editingCard.id ? { ...c, ...payload } : c))
    );
    setEditingCard(null);

    try {
      const res = await fetch(`/api/watchlist/${editingCard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) setCards(previous);
    } catch (error) {
      console.error("Error updating card:", error);
      setCards(previous);
    }
  }

  /**
   * Ouvre l'achat d'une carte suivie.
   *
   * La quantité proposée est 1, indépendamment de celle qui est surveillée :
   * on peut n'en suivre qu'une et en acheter plusieurs.
   */
  function openBuyModal(card) {
    setBuyingCard(card);
    setBuyData({
      quantity: "1",
      purchasePrice: "0",
      currentPrice: card.currentPrice != null ? card.currentPrice.toString() : "",
      purchaseDate: new Date().toISOString().split("T")[0],
    });
  }

  /** Fait passer la carte dans la collection : elle quitte le suivi. */
  async function handleBuy(e) {
    e.preventDefault();
    if (!buyingCard) return;

    const previous = cards;
    setCards((prev) => prev.filter((c) => c.id !== buyingCard.id));
    const bought = buyingCard;
    setBuyingCard(null);

    try {
      const res = await fetch(`/api/watchlist/${bought.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: parseInt(buyData.quantity) || 1,
          purchasePrice: parseFloat(buyData.purchasePrice) || 0,
          currentPrice: buyData.currentPrice,
          purchaseDate: buyData.purchaseDate,
        }),
      });

      if (!res.ok) setCards(previous);
    } catch (error) {
      console.error("Error buying watched card:", error);
      setCards(previous);
    }
  }

  const filteredCards = cards.filter((card) => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(card.category))
      return false;
    if (selectedLanguages.length > 0 && !selectedLanguages.includes(card.language))
      return false;
    if (selectedConditions.length > 0 && !selectedConditions.includes(card.condition))
      return false;
    return true;
  });

  // Le glisser-déposer ne porte que sur l'ordre personnalisé, et seulement
  // quand rien n'est filtré : sinon la position dans la liste affichée ne
  // correspondrait plus à la position réelle parmi toutes les cartes.
  const canReorder = sort === "custom" && !debouncedSearch && activeFilterCount === 0;

  /** Repère si la souris survole la moitié gauche ou droite de la carte. */
  function handleDragOver(e, card) {
    if (!canReorder || draggedId === card.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientX - rect.left > rect.width / 2;
    setDropTarget((prev) =>
      prev && prev.id === card.id && prev.after === after
        ? prev
        : { id: card.id, after }
    );
  }

  /** Déplace la carte glissée juste avant/après la carte survolée. */
  function handleDrop() {
    const dragId = draggedId;
    const target = dropTarget;
    setDraggedId(null);
    setDropTarget(null);
    if (!canReorder || !dragId || !target || dragId === target.id) return;

    const dragIndex = cards.findIndex((c) => c.id === dragId);
    if (dragIndex === -1) return;

    const reordered = [...cards];
    const [moved] = reordered.splice(dragIndex, 1);
    const targetIndex = reordered.findIndex((c) => c.id === target.id);
    if (targetIndex === -1) return;
    const insertIndex = target.after ? targetIndex + 1 : targetIndex;
    reordered.splice(insertIndex, 0, moved);

    const prev = reordered[insertIndex - 1];
    const next = reordered[insertIndex + 1];
    let sortOrder;
    if (prev && next) sortOrder = (prev.sortOrder + next.sortOrder) / 2;
    else if (prev) sortOrder = prev.sortOrder + 1;
    else if (next) sortOrder = next.sortOrder - 1;
    else sortOrder = 0;

    reordered[insertIndex] = { ...moved, sortOrder };

    const previous = cards;
    setCards(reordered);

    fetch(`/api/watchlist/${dragId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder }),
    })
      .then((res) => {
        if (!res.ok) setCards(previous);
      })
      .catch(() => setCards(previous));
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark-50">Cartes à suivre</h1>
            <p className="text-dark-400 mt-1">
              {filteredCards.length} carte{filteredCards.length > 1 ? "s" : ""}
              {filteredCards.length !== cards.length && ` sur ${cards.length}`} sous surveillance
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-semibold hover:shadow-lg transition"
          >
            <Plus size={20} />
            Suivre une carte
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="surface rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-dark-50 mb-4">
              Suivre une nouvelle carte
            </h2>
            <p className="text-sm text-dark-400 -mt-3">
              Sans prix d'achat : ces cartes n'entrent pas dans vos
              investissements.
            </p>

            {/* Recherche par nom : le chemin ordinaire, sans quitter l'app. */}
            <div className="bg-linear-to-br from-brand-primary/10 to-brand-secondary/10 border border-dark-600 rounded-xl p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-dark-100">
                <Search size={16} className="text-brand-primary" />
                Rechercher une carte par son nom
              </label>

              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchByName();
                    }
                  }}
                  placeholder="Lugia, Dracaufeu, Pikachu..."
                  className="flex-1 min-w-64 px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 text-sm"
                />
                <button
                  type="button"
                  onClick={searchByName}
                  disabled={nameLoading || nameQuery.trim().length < 2}
                  className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {nameLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Recherche...
                    </>
                  ) : (
                    "Chercher"
                  )}
                </button>
              </div>

              {nameError && <p className="text-sm text-red-400">{nameError}</p>}

              {nameResults.length > 0 && (
                <>
                  <p className="text-xs text-dark-400">
                    {nameTotal} carte{nameTotal > 1 ? "s" : ""} trouvée
                    {nameTotal > 1 ? "s" : ""}
                    {nameTotal > nameResults.length &&
                      ` · ${nameResults.length} affichées, précisez le nom pour affiner`}
                    . Cliquez sur la vôtre.
                  </p>

                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 max-h-96 overflow-y-auto">
                    {nameResults.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => pickSearchResult(card)}
                        title={`${card.name} · ${card.setName} · n°${card.number}`}
                        className="surface surface-hover rounded-lg overflow-hidden text-left transition"
                      >
                        <span className="block aspect-3/4 bg-dark-950">
                          {card.imageUrl ? (
                            <img
                              src={getImageSrc(card.imageUrl)}
                              alt={card.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="flex items-center justify-center w-full h-full text-dark-600">
                              <ImageOff size={20} />
                            </span>
                          )}
                        </span>
                        <span className="block px-1.5 py-1">
                          <span className="block text-[11px] font-semibold text-dark-100 truncate">
                            {card.name}
                          </span>
                          <span className="block text-[10px] text-dark-500 truncate">
                            {card.setName} · {card.number}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Remplissage automatique depuis un lien Cardmarket */}
            <div className="bg-linear-to-br from-brand-primary/10 to-brand-secondary/10 border border-dark-600 rounded-xl p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-dark-100">
                <Link2 size={16} className="text-brand-primary" />
                Remplissage automatique depuis Cardmarket
              </label>

              <div className="flex gap-2 flex-wrap">
                <input
                  type="url"
                  value={lookupUrl}
                  onChange={(e) => setLookupUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  placeholder="https://www.cardmarket.com/fr/Pokemon/Products/Singles/..."
                  className="flex-1 min-w-64 px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 text-sm"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookupLoading || !lookupUrl.trim()}
                  className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-semibold text-sm  transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {lookupLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Recherche...
                    </>
                  ) : (
                    "Récupérer"
                  )}
                </button>
              </div>

              {lookupError && (
                <p className="text-sm text-red-400">{lookupError}</p>
              )}
              {lookupInfo && (
                <p className="text-sm text-green-400">{lookupInfo}</p>
              )}

              {/* Un seul résultat : aperçu détaillé de la carte récupérée. */}
              {lookupCandidates.length === 1 && (
                <div className="flex items-center gap-4 pt-1">
                  <div className="w-24 aspect-3/4 rounded-lg overflow-hidden bg-dark-900 shrink-0">
                    {lookupCandidates[0].imageUrl ? (
                      <img
                        src={lookupCandidates[0].imageUrl}
                        alt={lookupCandidates[0].name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-dark-600">
                        <ImageOff size={24} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-dark-50">
                      {lookupCandidates[0].name}
                    </p>
                    <p className="text-sm text-dark-400">
                      {lookupCandidates[0].extension} · n°{lookupCandidates[0].number}
                    </p>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {lookupCandidates[0].rarity || "Rareté inconnue"}
                    </p>
                    {lookupCandidates[0].suggestedPrice != null && (
                      <p className="text-sm text-brand-primary font-semibold mt-1">
                        {lookupCandidates[0].suggestedPrice.toFixed(2)} €
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Plusieurs versions : grille de sélection. */}
              {lookupCandidates.length > 1 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                  {lookupCandidates.map((c) => {
                    const selected = formData.number === c.number;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => applyCandidate(c)}
                        className={`rounded-lg overflow-hidden border-2 transition text-left ${
                          selected
                            ? "border-brand-primary"
                            : "border-transparent hover:border-dark-500"
                        }`}
                      >
                        <div className="aspect-3/4 bg-dark-900">
                          {c.imageUrl && (
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="px-1 py-1 bg-dark-900/80">
                          <p className="text-[10px] font-semibold text-dark-100">
                            n°{c.number}
                          </p>
                          <p className="text-[9px] text-dark-400 line-clamp-1">
                            {c.rarity || "—"}
                          </p>
                          {c.suggestedPrice != null && (
                            <p className="text-[10px] text-brand-primary font-medium">
                              {c.suggestedPrice.toFixed(2)} €
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Extension
                </label>
                <input
                  type="text"
                  value={formData.extension}
                  onChange={(e) =>
                    setFormData({ ...formData, extension: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                  placeholder="ex: Base Set"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Catégorie
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                >
                  <option value="">Choisir...</option>
                  {CARD_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Numéro
                </label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) =>
                    setFormData({ ...formData, number: e.target.value })
                  }
                  placeholder="ex: 186"
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Langue
                </label>
                <select
                  value={formData.language}
                  onChange={(e) =>
                    setFormData({ ...formData, language: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                >
                  <option value="">Non précisée</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.flag} {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  État
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) =>
                    setFormData({ ...formData, condition: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                >
                  <option value="">Non précisé</option>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Quantité
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Prix actuel (€)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.currentPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, currentPrice: e.target.value })
                    }
                    placeholder="= prix d'achat si vide"
                    className="flex-1 min-w-0 px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                  />
                  {formData.cardmarketUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPriceHelper({
                          url: formData.cardmarketUrl,
                          language: formData.language,
                          target: "form",
                        })
                      }
                      title="Relever le prix français sur Cardmarket"
                      className="flex items-center gap-1.5 px-3 bg-dark-700 text-dark-200 rounded-lg hover:bg-dark-600 transition shrink-0 text-sm whitespace-nowrap"
                    >
                      <ExternalLink size={15} /> Relever
                    </button>
                  )}
                </div>
                {formData.priceSource && (
                  <p className="text-[11px] text-dark-500 mt-1">
                    {formData.priceSource}
                    {formData.priceUpdatedAt && ` · maj ${formData.priceUpdatedAt}`}
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  URL de l'image
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Lien Cardmarket
                </label>
                <input
                  type="url"
                  value={formData.cardmarketUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, cardmarketUrl: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                  placeholder="https://www.cardmarket.com/..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="px-4 py-2 btn-gold rounded-lg font-semibold  transition"
              >
                Suivre cette carte
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-dark-700 text-dark-200 rounded-lg font-semibold hover:bg-dark-600 transition"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="text"
                placeholder="Rechercher une carte..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-50"
              />
            </div>
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-50"
          >
            <option value="custom">Ordre personnalisé</option>
            <option value="recent">Récent</option>
            <option value="name-asc">Nom A → Z</option>
            <option value="name-desc">Nom Z → A</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
              activeFilterCount > 0
                ? "bg-brand-primary/20 border-brand-primary text-brand-primary"
                : "bg-dark-800 border-dark-700 text-dark-300 hover:border-dark-600"
            }`}
          >
            <SlidersHorizontal size={18} />
            Filtres
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
        </div>

        {showFilters && (
          <div className="surface rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
                Catégorie
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {CARD_CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.value)}
                      onChange={() => toggleCategory(cat.value)}
                      className="w-4 h-4 accent-brand-primary cursor-pointer"
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
                Langue
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {LANGUAGES.map((lang) => (
                  <label
                    key={lang.value}
                    className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(lang.value)}
                      onChange={() => toggleLanguage(lang.value)}
                      className="w-4 h-4 accent-brand-primary cursor-pointer"
                    />
                    {lang.flag} {lang.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
                État
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {CONDITIONS.map((c) => (
                  <label
                    key={c.value}
                    className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedConditions.includes(c.value)}
                      onChange={() => toggleCondition(c.value)}
                      className="w-4 h-4 accent-brand-secondary cursor-pointer"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setSelectedCategories([]);
                  setSelectedLanguages([]);
                  setSelectedConditions([]);
                }}
                className="text-sm text-dark-400 hover:text-dark-200 transition"
              >
                Réinitialiser
              </button>
            )}
          </div>
        )}

        {sort === "custom" && (
          <p className="text-xs text-dark-500 -mt-2">
            {canReorder
              ? "Glissez-déposez une carte pour la replacer où vous voulez."
              : "Videz la recherche et les filtres pour pouvoir réorganiser les cartes."}
          </p>
        )}

        {/* Cards List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-dark-400">Chargement...</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-12 surface rounded-2xl">
            <p className="text-dark-400 mb-4">
              {cards.length === 0 ? "Aucune carte suivie pour le moment" : "Aucune carte ne correspond aux filtres"}
            </p>
            {cards.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 btn-gold rounded-lg font-semibold  transition"
              >
                Ajouter votre première carte
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {filteredCards.map((card) => {
              return (
                <div
                  key={card.id}
                  draggable={canReorder}
                  onDragStart={(e) => {
                    setDraggedId(card.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => handleDragOver(e, card)}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop();
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDropTarget(null);
                  }}
                  className={`surface rounded-xl overflow-hidden surface-hover transition group ${
                    canReorder ? "cursor-grab active:cursor-grabbing" : ""
                  } ${draggedId === card.id ? "opacity-40" : ""} ${
                    dropTarget?.id === card.id && draggedId && draggedId !== card.id
                      ? dropTarget.after
                        ? "border-r-4 border-brand-primary"
                        : "border-l-4 border-brand-primary"
                      : ""
                  }`}
                >
                  <div
                    onClick={() => setDetailCard(card)}
                    className="relative aspect-3/4 bg-dark-900 overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {card.quantity > 1 && (
                      <span className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-dark-950/90 border border-dark-600 rounded text-[10px] font-semibold text-dark-50">
                        ×{card.quantity}
                      </span>
                    )}
                    <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
                      {card.language && getLanguage(card.language) && (
                        <span
                          title={getLanguage(card.language).label}
                          className="px-1 py-0.5 bg-dark-950/90 border border-dark-600 rounded text-[10px] leading-none"
                        >
                          {getLanguage(card.language).flag}
                        </span>
                      )}
                    </div>
                    {card.imageUrl ? (
                      <img
                        src={getImageSrc(card.imageUrl)}
                        alt={card.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-full items-center justify-center text-dark-600"
                      style={{ display: card.imageUrl ? "none" : "flex" }}
                    >
                      <ImageOff size={22} />
                    </div>
                  </div>

                  <div className="p-1.5 space-y-1">
                    <div
                      onClick={() => setDetailCard(card)}
                      className="flex items-center justify-between gap-1 cursor-pointer"
                    >
                      <h3 className="font-semibold text-dark-50 text-xs line-clamp-1" title={card.name}>
                        {card.name}
                      </h3>
                      <span className="shrink-0 text-[10px] font-semibold text-dark-400">
                        ×{card.quantity}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {card.extension && (
                        <span className="text-[10px] text-brand-primary line-clamp-1">
                          {card.extension}
                        </span>
                      )}
                      {card.category && (
                        <span className="text-[9px] px-1 py-0.5 bg-brand-primary/10 text-brand-primary rounded font-medium line-clamp-1">
                          {card.category}
                        </span>
                      )}
                    </div>

                    {/* Une seule valeur : la carte n'a pas été achetée,
                        il n'y a ni coût ni gain à afficher. */}
                    <div className="text-[10px]">
                      <p className="text-dark-500">Cote suivie</p>
                      <p className="text-brand-primary font-semibold">
                        {card.currentPrice != null
                          ? `€${card.currentPrice.toFixed(2)}`
                          : "à renseigner"}
                      </p>
                    </div>

                    <div className="flex gap-1 pt-1 border-t border-dark-700">
                      <button
                        onClick={() => setLotPickerCard(card)}
                        title="Ajouter à un lot (Futur achat)"
                        className={`px-1.5 py-1 rounded transition ${
                          lots.some((l) => l.cards.some((c) => c.id === card.id))
                            ? "bg-brand-secondary/20 text-brand-secondary"
                            : "bg-dark-700 text-dark-300 hover:bg-dark-600"
                        }`}
                      >
                        <ShoppingCart
                          size={11}
                          fill={
                            lots.some((l) => l.cards.some((c) => c.id === card.id))
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                      <button
                        onClick={() => openBuyModal(card)}
                        title="Ajouter à ma collection"
                        className="flex-1 py-1 bg-green-500/10 text-green-400 rounded text-[10px] font-medium hover:bg-green-500/20 transition"
                      >
                        Acheter
                      </button>
                      <button
                        onClick={() => openEditModal(card)}
                        title="Modifier"
                        className="px-1.5 py-1 bg-brand-primary/10 text-brand-primary rounded hover:bg-brand-primary/20 transition"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => deleteCard(card.id)}
                        title="Supprimer"
                        className="px-1.5 py-1 bg-red-500/10 text-red-400 rounded text-[10px] font-medium hover:bg-red-500/20 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Achat : la carte quitte le suivi pour rejoindre la collection. */}
        {buyingCard && (
          <Modal
            onClose={() => setBuyingCard(null)}
            panelClassName="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark-900 flex items-center justify-center shrink-0">
                {buyingCard.imageUrl ? (
                  <img
                    src={getImageSrc(buyingCard.imageUrl)}
                    alt={buyingCard.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageOff size={24} className="text-dark-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-dark-400 uppercase tracking-wide">
                  Ajouter à ma collection
                </p>
                <h2 className="text-lg font-semibold text-dark-50 truncate">
                  {buyingCard.name}
                </h2>
              </div>
            </div>

            <form onSubmit={handleBuy} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Quantité achetée *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={buyData.quantity}
                  onChange={(e) =>
                    setBuyData({ ...buyData, quantity: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Indépendante de la quantité suivie : vous pouvez n'en suivre
                  qu'une et en acheter plusieurs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Prix d'achat (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={buyData.purchasePrice}
                    onChange={(e) =>
                      setBuyData({ ...buyData, purchasePrice: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Prix actuel (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={buyData.currentPrice}
                    onChange={(e) =>
                      setBuyData({ ...buyData, currentPrice: e.target.value })
                    }
                    placeholder="= prix d'achat si vide"
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Date d'achat
                </label>
                <input
                  type="date"
                  value={buyData.purchaseDate}
                  onChange={(e) =>
                    setBuyData({ ...buyData, purchaseDate: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <p className="text-xs text-dark-500">
                La carte rejoindra vos cartes et sortira du suivi.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition"
                >
                  Ajouter à ma collection
                </button>
                <button
                  type="button"
                  onClick={() => setBuyingCard(null)}
                  className="px-4 py-2.5 bg-dark-700 text-dark-200 rounded-lg font-semibold hover:bg-dark-600 transition"
                >
                  Annuler
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Modal */}
        {editingCard && (
          <Modal
            onClose={() => setEditingCard(null)}
            panelClassName="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-4 p-6 pb-4 shrink-0">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark-900 flex items-center justify-center shrink-0">
                {editData.imageUrl ? (
                  <img
                    src={getImageSrc(editData.imageUrl)}
                    alt={editData.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageOff size={24} className="text-dark-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-dark-400 uppercase tracking-wide flex items-center gap-1">
                  <Pencil size={12} /> Modifier
                </p>
                <h2 className="text-lg font-semibold text-dark-50 truncate">
                  {editingCard.name}
                </h2>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 overflow-y-auto px-6 pb-6">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Extension
                  </label>
                  <input
                    type="text"
                    value={editData.extension}
                    onChange={(e) => setEditData({ ...editData, extension: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Numéro
                  </label>
                  <input
                    type="text"
                    value={editData.number}
                    onChange={(e) => setEditData({ ...editData, number: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Catégorie
                  </label>
                  <select
                    value={editData.category}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  >
                    <option value="">Choisir...</option>
                    {CARD_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Langue
                  </label>
                  <select
                    value={editData.language}
                    onChange={(e) => setEditData({ ...editData, language: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  >
                    <option value="">Non précisée</option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.flag} {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    État
                  </label>
                  <select
                    value={editData.condition}
                    onChange={(e) => setEditData({ ...editData, condition: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  >
                    <option value="">Non précisé</option>
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editData.quantity}
                    onChange={(e) => setEditData({ ...editData, quantity: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Prix actuel (€)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editData.currentPrice}
                      onChange={(e) => setEditData({ ...editData, currentPrice: e.target.value })}
                      className="flex-1 min-w-0 px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                    />
                    {editData.cardmarketUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPriceHelper({
                            url: editData.cardmarketUrl,
                            language: editData.language,
                            target: "edit",
                          })
                        }
                        title="Relever le prix français sur Cardmarket"
                        className="flex items-center gap-1.5 px-3 bg-dark-700 text-dark-200 rounded-lg hover:bg-dark-600 transition shrink-0 text-sm whitespace-nowrap"
                      >
                        <ExternalLink size={15} /> Relever
                      </button>
                    )}
                  </div>
                </div>
                {editData.currentPrice !== "" && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Date de ce prix *
                    </label>
                    <input
                      type="date"
                      required
                      value={editData.priceDate}
                      onChange={(e) => setEditData({ ...editData, priceDate: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                    />
                    <p className="text-xs text-dark-500 mt-1.5">
                      Ajoute un point à la courbe d'évolution ; une même date
                      remplace le point déjà enregistré ce jour-là.
                    </p>
                  </div>
                )}
              </div>

              {editData.priceSource && (
                <p className="text-xs text-dark-500 -mt-1">
                  Prix indicatif : {editData.priceSource}
                  {editData.priceUpdatedAt && ` · maj ${editData.priceUpdatedAt}`}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Lien Cardmarket
                </label>
                <input
                  type="url"
                  value={editData.cardmarketUrl}
                  onChange={(e) => setEditData({ ...editData, cardmarketUrl: e.target.value })}
                  placeholder="https://www.cardmarket.com/..."
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  URL de l'image
                </label>
                <input
                  type="url"
                  value={editData.imageUrl}
                  onChange={(e) => setEditData({ ...editData, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 btn-gold rounded-lg font-semibold hover:shadow-lg transition"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2.5 bg-dark-700 text-dark-200 rounded-lg font-semibold hover:bg-dark-600 transition"
                >
                  Annuler
                </button>
              </div>
            </form>
          </Modal>
        )}


        {priceHelper && (
          <CardmarketPriceModal
            cardmarketUrl={priceHelper.url}
            language={priceHelper.language}
            onApply={(price) => {
              const value = price.toFixed(2);
              if (priceHelper.target === "edit") {
                setEditData((prev) => ({
                  ...prev,
                  currentPrice: value,
                  priceSource: "Relevé Cardmarket (vendeurs FR)",
                  priceUpdatedAt: new Date().toISOString().slice(0, 10),
                }));
              } else {
                setFormData((prev) => ({
                  ...prev,
                  currentPrice: value,
                  priceSource: "Relevé Cardmarket (vendeurs FR)",
                  priceUpdatedAt: new Date().toISOString().slice(0, 10),
                }));
              }
            }}
            onClose={() => setPriceHelper(null)}
          />
        )}

        <ItemDetailModal
          watched
          kind="card"
          priceHistoryEndpoint={detailCard ? `/api/watchlist/${detailCard.id}/price-history` : undefined}
          onClose={() => setDetailCard(null)}
          item={
            detailCard && {
              ...detailCard,
              // La fiche affiche une date d'acquisition ; pour une carte
              // suivie, c'est la date où le suivi a commencé.
              purchaseDate: detailCard.createdAt,
            }
          }
        />
      </div>

      {/* Sélecteur de lots : choisir dans quel(s) « Futur achat » ranger
          cette carte, ou en créer un nouveau à la volée. */}
      {lotPickerCard && (
        <Modal
          onClose={() => {
            setLotPickerCard(null);
            setNewLotName("");
          }}
          panelClassName="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-16 rounded-lg overflow-hidden bg-dark-900 flex items-center justify-center shrink-0">
              {lotPickerCard.imageUrl ? (
                <img
                  src={getImageSrc(lotPickerCard.imageUrl)}
                  alt={lotPickerCard.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageOff size={20} className="text-dark-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-dark-400 uppercase tracking-wide">Ajouter au lot</p>
              <h2 className="text-base font-semibold text-dark-50 truncate">
                {lotPickerCard.name}
              </h2>
            </div>
          </div>

          {lots.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {lots.map((lot) => {
                const inLot = lot.cards.some((c) => c.id === lotPickerCard.id);
                return (
                  <button
                    key={lot.id}
                    onClick={() => toggleCardInLot(lot, lotPickerCard)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition text-left ${
                      inLot
                        ? "bg-brand-secondary/15 border-brand-secondary"
                        : "bg-dark-900 border-dark-700 hover:border-dark-600"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center ${
                        inLot
                          ? "bg-brand-secondary border-brand-secondary"
                          : "border-dark-600"
                      }`}
                    >
                      {inLot && <span className="w-1.5 h-1.5 bg-dark-950 rounded-sm" />}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-dark-100 truncate">
                      {lot.name}
                    </span>
                    <span className="text-xs text-dark-500 shrink-0">
                      {lot.cards.length} carte{lot.cards.length > 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newLotName}
              onChange={(e) => setNewLotName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createLotWithCard(lotPickerCard);
                }
              }}
              placeholder="Nouveau lot (ex: Alt 30 ans)"
              className="flex-1 min-w-0 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50 text-sm"
            />
            <button
              onClick={() => createLotWithCard(lotPickerCard)}
              disabled={!newLotName.trim()}
              className="px-3 py-2 btn-gold rounded-lg font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Créer
            </button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
