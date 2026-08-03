"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import { Plus, Search, ImageOff, Tag, SlidersHorizontal, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { getImageSrc } from "@/lib/image";
import { SEALED_TYPES } from "@/lib/categories";

const emptyForm = {
  name: "",
  type: "",
  quantity: "1",
  purchasePrice: "",
  currentPrice: "",
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
  const [showFilters, setShowFilters] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editData, setEditData] = useState(emptyForm);

  function toggleTypeFilter(type) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
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
      quantity: item.quantity.toString(),
      purchasePrice: item.purchasePrice.toString(),
      currentPrice: (item.currentPrice ?? item.purchasePrice).toString(),
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

  const filteredSealed =
    selectedTypes.length === 0
      ? sealed
      : sealed.filter((item) => selectedTypes.includes(item.type));

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
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentPrice}
                  onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                  placeholder="= prix d'achat si vide"
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
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
              selectedTypes.length > 0
                ? "bg-brand-primary/20 border-brand-primary text-brand-primary"
                : "bg-dark-800 border-dark-700 text-dark-300 hover:border-dark-600"
            }`}
          >
            <SlidersHorizontal size={18} />
            Types
            {selectedTypes.length > 0 && ` (${selectedTypes.length})`}
          </button>
        </div>

        {showFilters && (
          <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4">
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
            {selectedTypes.length > 0 && (
              <button
                onClick={() => setSelectedTypes([])}
                className="text-sm text-dark-400 hover:text-dark-200 transition mt-3"
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
                  <div className="relative aspect-square bg-dark-900 overflow-hidden flex items-center justify-center">
                    {item.quantity > 1 && (
                      <span className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-dark-950/90 border border-dark-600 rounded text-[10px] font-semibold text-dark-50">
                        ×{item.quantity}
                      </span>
                    )}
                    {item.imageUrl ? (
                      <img
                        src={getImageSrc(item.imageUrl)}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
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
                    <div className="flex items-center justify-between gap-1">
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
                    <input
                      type="number"
                      step="0.01"
                      value={editData.currentPrice}
                      onChange={(e) => setEditData({ ...editData, currentPrice: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                    />
                  </div>
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
      </div>
    </DashboardLayout>
  );
}
