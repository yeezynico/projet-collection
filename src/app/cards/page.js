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
} from "lucide-react";
import { useSession } from "next-auth/react";
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
  // Une carte reçue ou échangée n'a rien coûté : zéro est la valeur juste
  // le plus souvent, et elle évite d'avoir à effacer un champ vide obligatoire.
  purchasePrice: "0",
  currentPrice: "",
  priceSource: "",
  priceUpdatedAt: "",
  imageUrl: "",
  cardmarketUrl: "",
  purchaseDate: new Date().toISOString().split("T")[0],
};

export default function CardsPage() {
  const { data: session } = useSession();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [sellingCard, setSellingCard] = useState(null);
  const [sellData, setSellData] = useState({
    quantity: "1",
    salePrice: "",
    saleDate: new Date().toISOString().split("T")[0],
  });
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
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

      const res = await fetch(`/api/cards?${params}`);
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

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity) || 1,
          purchasePrice: parseFloat(formData.purchasePrice) || 0,
          currentPrice: formData.currentPrice
            ? parseFloat(formData.currentPrice)
            : undefined,
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
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
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
      purchasePrice: card.purchasePrice.toString(),
      currentPrice: (card.currentPrice ?? card.purchasePrice).toString(),
      priceSource: card.priceSource ?? "",
      priceUpdatedAt: card.priceUpdatedAt ?? "",
      imageUrl: card.imageUrl ?? "",
      cardmarketUrl: card.cardmarketUrl ?? "",
      purchaseDate: new Date(card.purchaseDate).toISOString().split("T")[0],
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editingCard) return;

    const payload = {
      ...editData,
      quantity: parseInt(editData.quantity) || 1,
      purchasePrice: parseFloat(editData.purchasePrice) || 0,
      currentPrice:
        editData.currentPrice === ""
          ? parseFloat(editData.purchasePrice) || 0
          : parseFloat(editData.currentPrice),
    };

    const previous = cards;
    setCards((prev) =>
      prev.map((c) => (c.id === editingCard.id ? { ...c, ...payload } : c))
    );
    setEditingCard(null);

    try {
      const res = await fetch(`/api/cards/${editingCard.id}`, {
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

  function openSellModal(card) {
    setSellingCard(card);
    setSellData({
      quantity: "1",
      salePrice: (card.currentPrice ?? card.purchasePrice).toString(),
      saleDate: new Date().toISOString().split("T")[0],
    });
  }

  async function handleSell(e) {
    e.preventDefault();
    if (!sellingCard) return;

    const maxQty = sellingCard.quantity;
    const sellQty = Math.min(Math.max(parseInt(sellData.quantity) || 1, 1), maxQty);
    const remaining = maxQty - sellQty;

    const previous = cards;
    setCards((prev) =>
      remaining > 0
        ? prev.map((c) => (c.id === sellingCard.id ? { ...c, quantity: remaining } : c))
        : prev.filter((c) => c.id !== sellingCard.id)
    );
    setSellingCard(null);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "card",
          itemCategory: sellingCard.category,
          itemName: sellingCard.name,
          itemNumber: sellingCard.number,
          extension: sellingCard.extension,
          language: sellingCard.language,
          condition: sellingCard.condition,
          cardmarketUrl: sellingCard.cardmarketUrl,
          quantity: sellQty,
          purchasePrice: sellingCard.purchasePrice,
          salePrice: parseFloat(sellData.salePrice) || 0,
          saleDate: sellData.saleDate,
          imageUrl: sellingCard.imageUrl,
          cardId: sellingCard.id,
        }),
      });

      if (!res.ok) setCards(previous);
    } catch (error) {
      console.error("Error selling card:", error);
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

  const totalInvested = filteredCards.reduce(
    (sum, card) => sum + card.purchasePrice * card.quantity,
    0
  );
  const totalValue = filteredCards.reduce(
    (sum, card) =>
      sum + (card.currentPrice ?? card.purchasePrice) * card.quantity,
    0
  );
  const potentialGain = totalValue - totalInvested;

  return (
    <DashboardLayout user={session?.user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark-50">Cartes Pokémon</h1>
            <p className="text-dark-400 mt-1">
              {filteredCards.length} carte{filteredCards.length > 1 ? "s" : ""}
              {filteredCards.length !== cards.length && ` sur ${cards.length}`} dans votre collection
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-semibold hover:shadow-lg transition"
          >
            <Plus size={20} />
            Ajouter une carte
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="surface rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-dark-50 mb-4">
              Ajouter une nouvelle carte
            </h2>

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
                  Prix d'achat (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchasePrice}
                  onChange={(e) =>
                    setFormData({ ...formData, purchasePrice: e.target.value })
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

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Date d'achat
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) =>
                    setFormData({ ...formData, purchaseDate: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="px-4 py-2 btn-gold rounded-lg font-semibold  transition"
              >
                Ajouter la carte
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

        {/* Stats */}
        {filteredCards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="surface rounded-2xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-dark-500">
                Montant investi
              </p>
              <p className="text-2xl font-bold text-dark-50 mt-0.5">
                {totalInvested.toFixed(2)} €
              </p>
            </div>
            <div className="surface-gold rounded-2xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-dark-500">
                Valeur actuelle
              </p>
              <p className="text-2xl font-bold text-brand-primary mt-0.5">
                {totalValue.toFixed(2)} €
              </p>
            </div>
            <div
              className={`rounded-2xl px-4 py-3 border ${
                potentialGain > 0
                  ? "bg-green-500/8 border-green-500/25"
                  : potentialGain < 0
                    ? "bg-red-500/8 border-red-500/25"
                    : "surface"
              }`}
            >
              <p className="text-[11px] uppercase tracking-wider text-dark-500">
                Gain potentiel
              </p>
              <p
                className={`text-2xl font-bold mt-0.5 ${
                  potentialGain > 0
                    ? "text-green-400"
                    : potentialGain < 0
                      ? "text-red-400"
                      : "text-dark-300"
                }`}
              >
                {potentialGain >= 0 ? "+" : ""}
                {(potentialGain).toFixed(2)} €
              </p>
            </div>
          </div>
        )}

        {/* Cards List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-dark-400">Chargement...</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-12 surface rounded-2xl">
            <p className="text-dark-400 mb-4">
              {cards.length === 0 ? "Aucune carte pour le moment" : "Aucune carte ne correspond aux filtres"}
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
              const currentPrice = card.currentPrice ?? card.purchasePrice;
              const gain =
                currentPrice * card.quantity - card.purchasePrice * card.quantity;
              const gainPercent =
                card.purchasePrice > 0
                  ? (gain / (card.purchasePrice * card.quantity)) * 100
                  : null;

              return (
                <div
                  key={card.id}
                  className="surface rounded-xl overflow-hidden surface-hover transition group"
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

                    <div className="grid grid-cols-2 gap-x-1 text-[10px]">
                      <div>
                        <p className="text-dark-500">Achat</p>
                        <p className="text-dark-200 font-medium">€{card.purchasePrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-dark-500">Actuel</p>
                        <p className="text-dark-200 font-medium">€{currentPrice.toFixed(2)}</p>
                      </div>
                    </div>

                    <div
                      className={`text-[10px] font-semibold ${
                        gain >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {gain >= 0 ? "+" : ""}€{gain.toFixed(2)}
                      {gainPercent !== null && ` (${gainPercent >= 0 ? "+" : ""}${gainPercent.toFixed(0)}%)`}
                    </div>

                    <div className="flex gap-1 pt-1 border-t border-dark-700">
                      <button
                        onClick={() => openSellModal(card)}
                        title="Vendre"
                        className="flex-1 py-1 bg-green-500/10 text-green-400 rounded text-[10px] font-medium hover:bg-green-500/20 transition"
                      >
                        Vendre
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

        {/* Sell Modal */}
        {sellingCard && (
          <Modal
            onClose={() => setSellingCard(null)}
            panelClassName="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark-900 flex items-center justify-center shrink-0">
                {sellingCard.imageUrl ? (
                  <img
                    src={getImageSrc(sellingCard.imageUrl)}
                    alt={sellingCard.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageOff size={24} className="text-dark-600" />
                )}
              </div>
              <div>
                <p className="text-xs text-dark-400 uppercase tracking-wide flex items-center gap-1">
                  <Tag size={12} /> Vente
                </p>
                <h2 className="text-lg font-semibold text-dark-50">
                  {sellingCard.name}
                </h2>
              </div>
            </div>

            <form onSubmit={handleSell} className="space-y-4">
              {sellingCard.quantity > 1 && (
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Quantité à vendre * (max {sellingCard.quantity})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={sellingCard.quantity}
                    required
                    value={sellData.quantity}
                    onChange={(e) =>
                      setSellData({ ...sellData, quantity: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Prix de vente (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={sellData.salePrice}
                  onChange={(e) =>
                    setSellData({ ...sellData, salePrice: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Date de vente
                </label>
                <input
                  type="date"
                  value={sellData.saleDate}
                  onChange={(e) =>
                    setSellData({ ...sellData, saleDate: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition"
                >
                  Confirmer la vente
                </button>
                <button
                  type="button"
                  onClick={() => setSellingCard(null)}
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
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Prix d'achat (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editData.purchasePrice}
                    onChange={(e) => setEditData({ ...editData, purchasePrice: e.target.value })}
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

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Date d'achat
                </label>
                <input
                  type="date"
                  value={editData.purchaseDate}
                  onChange={(e) => setEditData({ ...editData, purchaseDate: e.target.value })}
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
          item={detailCard}
          kind="card"
          onClose={() => setDetailCard(null)}
        />
      </div>
    </DashboardLayout>
  );
}
