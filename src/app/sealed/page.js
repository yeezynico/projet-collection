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
import {
  SEALED_TYPES,
  LANGUAGES,
  CONDITIONS,
  CONDITION_STYLES,
  getLanguage,
} from "@/lib/categories";
import { buildFilteredUrl } from "@/lib/cardmarket";
import ItemDetailModal from "@/components/ItemDetailModal";
import CardmarketPriceModal from "@/components/CardmarketPriceModal";

const emptyForm = {
  name: "",
  type: "",
  language: "FR",
  condition: "",
  quantity: "1",
  purchasePrice: "",
  currentPrice: "",
  priceSource: "",
  priceUpdatedAt: "",
  imageUrl: "",
  cardmarketUrl: "",
  purchaseDate: new Date().toISOString().split("T")[0],
};

export default function SealedPage() {
  const { data: session } = useSession();
  const [sealed, setSealed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [sellingItem, setSellingItem] = useState(null);
  const [sellData, setSellData] = useState({
    quantity: "1",
    salePrice: "",
    saleDate: new Date().toISOString().split("T")[0],
  });
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [priceHelper, setPriceHelper] = useState(null);
  const [editData, setEditData] = useState(emptyForm);
  const [lookupUrl, setLookupUrl] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupInfo, setLookupInfo] = useState("");

  function toggleIn(setter) {
    return (value) =>
      setter((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
  }

  const toggleTypeFilter = toggleIn(setSelectedTypes);
  const toggleLanguage = toggleIn(setSelectedLanguages);
  const toggleCondition = toggleIn(setSelectedConditions);

  const activeFilterCount =
    selectedTypes.length + selectedLanguages.length + selectedConditions.length;

  /** Pré-remplit le formulaire depuis un lien Cardmarket. */
  async function handleLookup() {
    if (!lookupUrl.trim()) return;

    setLookupLoading(true);
    setLookupError("");
    setLookupInfo("");

    try {
      const res = await fetch(`/api/lookup?url=${encodeURIComponent(lookupUrl.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setLookupError(data.error || "Récupération impossible");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        type: data.type || prev.type,
        imageUrl: data.imageUrl || prev.imageUrl,
        cardmarketUrl: data.cardmarketUrl || lookupUrl.trim(),
        currentPrice:
          data.suggestedPrice != null ? data.suggestedPrice.toFixed(2) : prev.currentPrice,
        priceSource: data.priceSource || "",
        priceUpdatedAt: data.priceUpdatedAt || "",
      }));

      setLookupInfo(
        data.message ||
          `${data.name || "Produit"} récupéré. Complétez le type et les prix.`
      );
    } catch {
      setLookupError("Erreur réseau lors de la récupération");
    } finally {
      setLookupLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchSealed = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (sort) params.append("sort", sort);
      const res = await fetch(`/api/sealed?${params}`);
      if (res.ok) setSealed(await res.json());
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort]);

  useEffect(() => {
    fetchSealed();
  }, [fetchSealed]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/sealed", {
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
        const newItem = await res.json();
        setSealed((prev) => [newItem, ...prev]);
        setFormData(emptyForm);
        setLookupUrl("");
        setLookupInfo("");
        setLookupError("");
        setShowForm(false);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function deleteSealed(id) {
    if (!confirm("Êtes-vous sûr ?")) return;

    const previous = sealed;
    setSealed((prev) => prev.filter((s) => s.id !== id));

    try {
      const res = await fetch(`/api/sealed/${id}`, { method: "DELETE" });
      if (!res.ok) setSealed(previous);
    } catch (error) {
      console.error("Error:", error);
      setSealed(previous);
    }
  }

  function openEditModal(item) {
    setEditingItem(item);
    setEditData({
      name: item.name ?? "",
      type: item.type ?? "",
      language: item.language ?? "",
      condition: item.condition ?? "",
      quantity: item.quantity.toString(),
      purchasePrice: item.purchasePrice.toString(),
      currentPrice: (item.currentPrice ?? item.purchasePrice).toString(),
      priceSource: item.priceSource ?? "",
      priceUpdatedAt: item.priceUpdatedAt ?? "",
      imageUrl: item.imageUrl ?? "",
      cardmarketUrl: item.cardmarketUrl ?? "",
      purchaseDate: new Date(item.purchaseDate).toISOString().split("T")[0],
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editingItem) return;

    const payload = {
      ...editData,
      quantity: parseInt(editData.quantity) || 1,
      purchasePrice: parseFloat(editData.purchasePrice) || 0,
      currentPrice:
        editData.currentPrice === ""
          ? parseFloat(editData.purchasePrice) || 0
          : parseFloat(editData.currentPrice),
    };

    const previous = sealed;
    setSealed((prev) =>
      prev.map((s) => (s.id === editingItem.id ? { ...s, ...payload } : s))
    );
    setEditingItem(null);

    try {
      const res = await fetch(`/api/sealed/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) setSealed(previous);
    } catch (error) {
      console.error("Error updating sealed item:", error);
      setSealed(previous);
    }
  }

  function openSellModal(item) {
    setSellingItem(item);
    setSellData({
      quantity: "1",
      salePrice: (item.currentPrice ?? item.purchasePrice).toString(),
      saleDate: new Date().toISOString().split("T")[0],
    });
  }

  async function handleSell(e) {
    e.preventDefault();
    if (!sellingItem) return;

    const maxQty = sellingItem.quantity;
    const sellQty = Math.min(Math.max(parseInt(sellData.quantity) || 1, 1), maxQty);
    const remaining = maxQty - sellQty;

    const previous = sealed;
    setSealed((prev) =>
      remaining > 0
        ? prev.map((s) => (s.id === sellingItem.id ? { ...s, quantity: remaining } : s))
        : prev.filter((s) => s.id !== sellingItem.id)
    );
    setSellingItem(null);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "sealed",
          itemCategory: sellingItem.type,
          itemName: sellingItem.name,
          quantity: sellQty,
          purchasePrice: sellingItem.purchasePrice,
          salePrice: parseFloat(sellData.salePrice) || 0,
          saleDate: sellData.saleDate,
          imageUrl: sellingItem.imageUrl,
          sealedId: sellingItem.id,
        }),
      });

      if (!res.ok) setSealed(previous);
    } catch (error) {
      console.error("Error selling item:", error);
      setSealed(previous);
    }
  }

  const filteredSealed = sealed.filter((item) => {
    if (selectedTypes.length > 0 && !selectedTypes.includes(item.type)) return false;
    if (selectedLanguages.length > 0 && !selectedLanguages.includes(item.language))
      return false;
    if (selectedConditions.length > 0 && !selectedConditions.includes(item.condition))
      return false;
    return true;
  });

  const totalInvested = filteredSealed.reduce((sum, s) => sum + s.purchasePrice * s.quantity, 0);
  const totalValue = filteredSealed.reduce(
    (sum, s) => sum + (s.currentPrice ?? s.purchasePrice) * s.quantity,
    0
  );

  return (
    <DashboardLayout user={session?.user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark-50">Produits scellés</h1>
            <p className="text-dark-400 mt-1">
              {filteredSealed.length} produit{filteredSealed.length > 1 ? "s" : ""}
              {filteredSealed.length !== sealed.length && ` sur ${sealed.length}`}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-brand-primary to-brand-secondary text-white rounded-lg font-semibold hover:shadow-lg transition"
          >
            <Plus size={20} /> Ajouter
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-dark-800/50 border border-dark-700 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-dark-50 mb-4">Ajouter un produit</h2>

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
                  placeholder="https://www.cardmarket.com/fr/Pokemon/Products/..."
                  className="flex-1 min-w-64 px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 text-sm"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookupLoading || !lookupUrl.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold text-sm hover:bg-brand-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
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

              {lookupError && <p className="text-sm text-red-400">{lookupError}</p>}
              {lookupInfo && <p className="text-sm text-green-400">{lookupInfo}</p>}

              {/* Aperçu du produit récupéré, l'image se met à jour dès qu'une URL est saisie. */}
              {lookupInfo && formData.name && (
                <div className="flex items-center gap-4 pt-1">
                  <div className="w-24 aspect-square rounded-lg overflow-hidden bg-dark-900 shrink-0 p-1">
                    {formData.imageUrl ? (
                      <img
                        src={getImageSrc(formData.imageUrl)}
                        alt={formData.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-dark-600">
                        <ImageOff size={24} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-dark-50">{formData.name}</p>
                    {formData.type && (
                      <p className="text-sm text-brand-secondary">{formData.type}</p>
                    )}
                    <p className="text-xs text-dark-500 mt-0.5">
                      {formData.imageUrl
                        ? "Image chargée"
                        : "Ajoutez une URL d'image ci-dessous pour l'aperçu"}
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-dark-500">
                Les produits scellés ne sont pas référencés par la base de cartes : seuls le
                nom et le lien sont déduits, à compléter manuellement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Nom *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                >
                  <option value="">Choisir...</option>
                  {SEALED_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Langue</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
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
                <label className="block text-sm font-medium text-dark-200 mb-2">État</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
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
                <label className="block text-sm font-medium text-dark-200 mb-2">Quantité</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Prix d'achat (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Prix actuel (€)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.currentPrice}
                    onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
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

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Date d'achat</label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-dark-200 mb-2">URL de l'image</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-dark-200 mb-2">Lien Cardmarket</label>
                <input
                  type="url"
                  value={formData.cardmarketUrl}
                  onChange={(e) => setFormData({ ...formData, cardmarketUrl: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                  placeholder="https://www.cardmarket.com/..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-primary/90 transition">
                Ajouter le produit
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-dark-700 text-dark-200 rounded-lg font-semibold hover:bg-dark-600 transition">
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-50" />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-50">
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
          <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
                Type
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {SEALED_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleTypeFilter(type.value)}
                      className="w-4 h-4 accent-brand-primary cursor-pointer"
                    />
                    {type.label}
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
                  setSelectedTypes([]);
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

        {filteredSealed.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Montant investi</p>
              <p className="text-2xl font-bold text-dark-50">€{totalInvested.toFixed(2)}</p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Valeur actuelle</p>
              <p className="text-2xl font-bold text-dark-50">€{totalValue.toFixed(2)}</p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Gain potentiel</p>
              <p className={`text-2xl font-bold ${totalValue - totalInvested >= 0 ? "text-green-400" : "text-red-400"}`}>
                €{(totalValue - totalInvested).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center py-12 text-dark-400">Chargement...</p>
        ) : filteredSealed.length === 0 ? (
          <div className="text-center py-12 bg-dark-800/50 rounded-xl">
            <p className="text-dark-400 mb-4">
              {sealed.length === 0 ? "Aucun produit pour le moment" : "Aucun produit ne correspond aux filtres"}
            </p>
            {sealed.length === 0 && (
              <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-primary/90 transition">
                Ajouter votre premier produit
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {filteredSealed.map((item) => {
              const currentPrice = item.currentPrice ?? item.purchasePrice;
              const gain = currentPrice * item.quantity - item.purchasePrice * item.quantity;
              const gainPercent =
                item.purchasePrice > 0
                  ? (gain / (item.purchasePrice * item.quantity)) * 100
                  : null;

              return (
                <div key={item.id} className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-lg overflow-hidden hover:border-dark-600 transition group">
                  <div
                    onClick={() => setDetailItem(item)}
                    className="relative aspect-square bg-dark-900 overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {item.quantity > 1 && (
                      <span className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-dark-950/90 border border-dark-600 rounded text-[10px] font-semibold text-dark-50">
                        ×{item.quantity}
                      </span>
                    )}
                    <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
                      {item.language && getLanguage(item.language) && (
                        <span
                          title={getLanguage(item.language).label}
                          className="px-1 py-0.5 bg-dark-950/90 border border-dark-600 rounded text-[10px] leading-none"
                        >
                          {getLanguage(item.language).flag}
                        </span>
                      )}
                      {item.condition && (
                        <span
                          className={`px-1 py-0.5 border rounded text-[9px] font-bold leading-none ${
                            CONDITION_STYLES[item.condition] || "bg-dark-950/90 text-dark-200 border-dark-600"
                          }`}
                        >
                          {item.condition}
                        </span>
                      )}
                    </div>
                    {item.imageUrl ? (
                      <img
                        src={getImageSrc(item.imageUrl)}
                        alt={item.name}
                        className="w-full h-full object-contain p-1 group-hover:scale-105 transition"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-full items-center justify-center text-dark-600"
                      style={{ display: item.imageUrl ? "none" : "flex" }}
                    >
                      <ImageOff size={22} />
                    </div>
                  </div>

                  <div className="p-1.5 space-y-1">
                    <div
                      onClick={() => setDetailItem(item)}
                      className="flex items-center justify-between gap-1 cursor-pointer"
                    >
                      <h3 className="font-semibold text-dark-50 text-xs line-clamp-1" title={item.name}>
                        {item.name}
                      </h3>
                      <span className="shrink-0 text-[10px] font-semibold text-dark-400">
                        ×{item.quantity}
                      </span>
                    </div>
                    <p className="text-[10px] text-brand-secondary line-clamp-1">{item.type}</p>

                    <div className="grid grid-cols-2 gap-x-1 text-[10px]">
                      <div>
                        <p className="text-dark-500">Achat</p>
                        <p className="text-dark-200 font-medium">€{item.purchasePrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-dark-500">Actuel</p>
                        <p className="text-dark-200 font-medium">€{currentPrice.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className={`text-[10px] font-semibold ${gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {gain >= 0 ? "+" : ""}€{gain.toFixed(2)}
                      {gainPercent !== null && ` (${gainPercent >= 0 ? "+" : ""}${gainPercent.toFixed(0)}%)`}
                    </div>

                    <div className="flex gap-1 pt-1 border-t border-dark-700">
                      <button
                        onClick={() => openSellModal(item)}
                        title="Vendre"
                        className="flex-1 py-1 bg-green-500/10 text-green-400 rounded text-[10px] font-medium hover:bg-green-500/20 transition"
                      >
                        Vendre
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        title="Modifier"
                        className="px-1.5 py-1 bg-brand-primary/10 text-brand-primary rounded hover:bg-brand-primary/20 transition"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => deleteSealed(item.id)}
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
        {sellingItem && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark-900 flex items-center justify-center shrink-0">
                  {sellingItem.imageUrl ? (
                    <img
                      src={getImageSrc(sellingItem.imageUrl)}
                      alt={sellingItem.name}
                      className="w-full h-full object-contain p-1"
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
                    {sellingItem.name}
                  </h2>
                </div>
              </div>

              <form onSubmit={handleSell} className="space-y-4">
                {sellingItem.quantity > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Quantité à vendre * (max {sellingItem.quantity})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={sellingItem.quantity}
                      required
                      value={sellData.quantity}
                      onChange={(e) => setSellData({ ...sellData, quantity: e.target.value })}
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
                    onChange={(e) => setSellData({ ...sellData, salePrice: e.target.value })}
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
                    onChange={(e) => setSellData({ ...sellData, saleDate: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 px-4 py-2.5 bg-linear-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition">
                    Confirmer la vente
                  </button>
                  <button type="button" onClick={() => setSellingItem(null)} className="px-4 py-2.5 bg-dark-700 text-dark-200 rounded-lg font-semibold hover:bg-dark-600 transition">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-lg shadow-2xl my-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark-900 flex items-center justify-center shrink-0">
                  {editData.imageUrl ? (
                    <img
                      src={getImageSrc(editData.imageUrl)}
                      alt={editData.name}
                      className="w-full h-full object-contain p-1"
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
                    {editingItem.name}
                  </h2>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">Nom *</label>
                  <input
                    type="text"
                    required
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">Type *</label>
                    <select
                      required
                      value={editData.type}
                      onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                    >
                      <option value="">Choisir...</option>
                      {SEALED_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">Langue</label>
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
                    <label className="block text-sm font-medium text-dark-200 mb-2">État</label>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">Quantité *</label>
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
                    <label className="block text-sm font-medium text-dark-200 mb-2">Prix d'achat (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editData.purchasePrice}
                      onChange={(e) => setEditData({ ...editData, purchasePrice: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">Prix actuel (€)</label>
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

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">Lien Cardmarket</label>
                  <input
                    type="url"
                    value={editData.cardmarketUrl}
                    onChange={(e) => setEditData({ ...editData, cardmarketUrl: e.target.value })}
                    placeholder="https://www.cardmarket.com/..."
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">URL de l'image</label>
                  <input
                    type="url"
                    value={editData.imageUrl}
                    onChange={(e) => setEditData({ ...editData, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">Date d'achat</label>
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
                    className="flex-1 px-4 py-2.5 bg-linear-to-r from-brand-primary to-brand-secondary text-white rounded-lg font-semibold hover:shadow-lg transition"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2.5 bg-dark-700 text-dark-200 rounded-lg font-semibold hover:bg-dark-600 transition"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
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
          item={detailItem}
          kind="sealed"
          onClose={() => setDetailItem(null)}
        />
      </div>
    </DashboardLayout>
  );
}
