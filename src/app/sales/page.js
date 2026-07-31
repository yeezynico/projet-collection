"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import { useSession } from "next-auth/react";
import { Camera, ImageOff, Search, ChevronLeft, ChevronRight, SlidersHorizontal, Pencil, Trash2 } from "lucide-react";
import { getImageSrc } from "@/lib/image";
import { CARD_CATEGORIES, SEALED_TYPES } from "@/lib/categories";

const TYPE_LABELS = {
  card: "Carte",
  sealed: "Scellé",
};

const TYPE_OPTIONS = [
  { value: "card", label: "Carte" },
  { value: "sealed", label: "Scellé" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "Tout" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
];

function getPeriodRange(type, offset) {
  if (type === "all") return null;
  const now = new Date();

  if (type === "week") {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(now.getDate() + diffToMonday + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (type === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (type === "year") {
    const start = new Date(now.getFullYear() + offset, 0, 1);
    const end = new Date(now.getFullYear() + offset, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  return null;
}

function formatPeriodLabel(type, range) {
  if (!range) return "Tout";
  if (type === "week") {
    const opts = { day: "numeric", month: "short" };
    return `${range.start.toLocaleDateString("fr-FR", opts)} – ${range.end.toLocaleDateString("fr-FR", opts)}`;
  }
  if (type === "month") {
    const label = range.start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (type === "year") {
    return `${range.start.getFullYear()}`;
  }
  return "Tout";
}

export default function SalesPage() {
  const { data: session } = useSession();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [preview, setPreview] = useState(null);
  const [periodType, setPeriodType] = useState("all");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [editingSale, setEditingSale] = useState(null);
  const [editData, setEditData] = useState({
    quantity: "1",
    purchasePrice: "",
    salePrice: "",
    saleDate: "",
  });

  const periodRange = useMemo(
    () => getPeriodRange(periodType, periodOffset),
    [periodType, periodOffset]
  );
  const periodLabel = formatPeriodLabel(periodType, periodRange);

  function changePeriodType(type) {
    setPeriodType(type);
    setPeriodOffset(0);
  }

  function showPreview(e, sale) {
    if (!sale.imageUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const previewWidth = 160;
    const spaceOnRight = window.innerWidth - rect.right;
    const left =
      spaceOnRight > previewWidth + 24
        ? rect.right + 12
        : rect.left - previewWidth - 12;

    setPreview({
      url: sale.imageUrl,
      name: sale.itemName,
      top: Math.min(Math.max(rect.top + rect.height / 2, 120), window.innerHeight - 120),
      left,
    });
  }

  function hidePreview() {
    setPreview(null);
  }

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    try {
      const res = await fetch("/api/sales");
      if (res.ok) setSales(await res.json());
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  function toggleType(type) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleCategory(cat) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function openEditModal(sale) {
    setEditingSale(sale);
    setEditData({
      quantity: sale.quantity.toString(),
      purchasePrice: sale.purchasePrice.toString(),
      salePrice: sale.salePrice.toString(),
      saleDate: new Date(sale.saleDate).toISOString().split("T")[0],
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editingSale) return;

    const quantity = Math.max(parseInt(editData.quantity) || 1, 1);
    const purchasePrice = parseFloat(editData.purchasePrice) || 0;
    const salePrice = parseFloat(editData.salePrice) || 0;
    const gain = salePrice * quantity - purchasePrice * quantity;
    const percentage = purchasePrice > 0 ? (gain / (purchasePrice * quantity)) * 100 : null;

    const previous = sales;
    setSales((prev) =>
      prev.map((s) =>
        s.id === editingSale.id
          ? { ...s, quantity, purchasePrice, salePrice, gain, percentage, saleDate: editData.saleDate }
          : s
      )
    );
    setEditingSale(null);

    try {
      const res = await fetch(`/api/sales/${editingSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, purchasePrice, salePrice, saleDate: editData.saleDate }),
      });
      if (!res.ok) setSales(previous);
    } catch (error) {
      console.error("Error updating sale:", error);
      setSales(previous);
    }
  }

  async function deleteSale(id) {
    if (!confirm("Supprimer cette vente de l'historique ?")) return;

    const previous = sales;
    setSales((prev) => prev.filter((s) => s.id !== id));

    try {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!res.ok) setSales(previous);
    } catch (error) {
      console.error("Error deleting sale:", error);
      setSales(previous);
    }
  }

  const filteredSales = sales.filter((sale) => {
    if (search && !sale.itemName.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (selectedTypes.length > 0 && !selectedTypes.includes(sale.itemType))
      return false;
    if (
      selectedCategories.length > 0 &&
      !selectedCategories.includes(sale.itemCategory)
    )
      return false;
    if (periodRange) {
      const saleDate = new Date(sale.saleDate);
      if (saleDate < periodRange.start || saleDate > periodRange.end) return false;
    }
    return true;
  });

  const totalInvested = filteredSales.reduce((sum, s) => sum + s.purchasePrice * s.quantity, 0);
  const totalSold = filteredSales.reduce((sum, s) => sum + s.salePrice * s.quantity, 0);
  const totalGain = filteredSales.reduce((sum, s) => sum + s.gain, 0);
  const totalPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : null;

  return (
    <DashboardLayout user={session?.user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-dark-50">Historique des ventes</h1>
          <p className="text-dark-400 mt-1">
            {filteredSales.length} vente{filteredSales.length > 1 ? "s" : ""}
            {filteredSales.length !== sales.length && ` sur ${sales.length}`}
          </p>
        </div>

        {/* Sélecteur de période */}
        <div className="bg-linear-to-br from-brand-primary/10 via-dark-800/50 to-brand-secondary/10 border border-dark-700 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-dark-900/60 border border-dark-700 rounded-lg p-1">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => changePeriodType(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  periodType === p.value
                    ? "bg-brand-primary text-white shadow"
                    : "text-dark-300 hover:text-dark-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodType !== "all" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPeriodOffset((o) => o - 1)}
                className="p-1.5 rounded-lg bg-dark-900/60 border border-dark-700 text-dark-300 hover:text-dark-50 hover:border-dark-600 transition"
                aria-label="Période précédente"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-dark-50 min-w-36 text-center">
                {periodLabel}
              </span>
              <button
                onClick={() => setPeriodOffset((o) => Math.min(o + 1, 0))}
                disabled={periodOffset >= 0}
                className="p-1.5 rounded-lg bg-dark-900/60 border border-dark-700 text-dark-300 hover:text-dark-50 hover:border-dark-600 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-dark-300"
                aria-label="Période suivante"
              >
                <ChevronRight size={16} />
              </button>
              {periodOffset !== 0 && (
                <button
                  onClick={() => setPeriodOffset(0)}
                  className="text-xs text-brand-primary hover:underline ml-1"
                >
                  Aujourd'hui
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recherche + bouton filtres */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              placeholder="Rechercher une vente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-50"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
              selectedTypes.length + selectedCategories.length > 0
                ? "bg-brand-primary/20 border-brand-primary text-brand-primary"
                : "bg-dark-800 border-dark-700 text-dark-300 hover:border-dark-600"
            }`}
          >
            <SlidersHorizontal size={18} />
            Filtres
            {selectedTypes.length + selectedCategories.length > 0 &&
              ` (${selectedTypes.length + selectedCategories.length})`}
          </button>
        </div>

        {showFilters && (
          <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
                Type
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {TYPE_OPTIONS.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleType(type.value)}
                      className="w-4 h-4 accent-brand-primary cursor-pointer"
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
                Catégories — cartes
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
                Catégories — scellés
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {SEALED_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center gap-2 text-sm text-dark-200 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(type.value)}
                      onChange={() => toggleCategory(type.value)}
                      className="w-4 h-4 accent-brand-secondary cursor-pointer"
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </div>

            {(selectedTypes.length > 0 || selectedCategories.length > 0) && (
              <button
                onClick={() => {
                  setSelectedTypes([]);
                  setSelectedCategories([]);
                }}
                className="text-sm text-dark-400 hover:text-dark-200 transition"
              >
                Réinitialiser
              </button>
            )}
          </div>
        )}

        {filteredSales.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Total investi</p>
              <p className="text-2xl font-bold text-dark-50">€{totalInvested.toFixed(2)}</p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Total vendu</p>
              <p className="text-2xl font-bold text-dark-50">€{totalSold.toFixed(2)}</p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Gain total</p>
              <p className={`text-2xl font-bold ${totalGain >= 0 ? "text-green-400" : "text-red-400"}`}>€{totalGain.toFixed(2)}</p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Pourcentage global</p>
              <p className={`text-2xl font-bold ${totalPercentage == null ? "text-dark-500" : totalPercentage >= 0 ? "text-green-400" : "text-red-400"}`}>
                {totalPercentage == null ? "—" : `${totalPercentage.toFixed(1)}%`}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center py-12 text-dark-400">Chargement...</p>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12 bg-dark-800/50 rounded-xl">
            <p className="text-dark-400">
              {sales.length === 0 ? "Aucune vente pour le moment" : "Aucune vente ne correspond aux filtres"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-dark-800/50 border border-dark-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-dark-900/50 border-b border-dark-700">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-dark-200">Nom</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-dark-200">Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-dark-200">Qté</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-dark-200">Achat</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-dark-200">Vente</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-dark-200">Gain</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-dark-200">%</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-dark-200">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-dark-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-dark-700/50 transition">
                    <td className="px-4 py-2 text-dark-50">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onMouseEnter={(e) => showPreview(e, sale)}
                          onMouseLeave={hidePreview}
                          className="p-1 rounded text-dark-500 hover:text-brand-primary transition shrink-0"
                          tabIndex={-1}
                        >
                          {sale.imageUrl ? <Camera size={14} /> : <ImageOff size={14} />}
                        </button>
                        <span className="line-clamp-1">{sale.itemName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-dark-400">
                      {TYPE_LABELS[sale.itemType] || sale.itemType}
                      {sale.itemCategory && (
                        <span className="text-dark-500"> · {sale.itemCategory}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-dark-50">{sale.quantity}</td>
                    <td className="px-4 py-2 text-right text-dark-50">€{(sale.purchasePrice * sale.quantity).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-dark-50">€{(sale.salePrice * sale.quantity).toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${sale.gain >= 0 ? "text-green-400" : "text-red-400"}`}>€{sale.gain.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${sale.percentage == null ? "text-dark-500" : sale.percentage >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {sale.percentage == null ? "—" : `${sale.percentage.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2 text-dark-400">{new Date(sale.saleDate).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(sale)}
                          title="Modifier"
                          className="p-1.5 rounded text-dark-400 hover:text-brand-primary hover:bg-brand-primary/10 transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteSale(sale.id)}
                          title="Supprimer"
                          className="p-1.5 rounded text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Floating image preview, fixed to viewport so it's never clipped */}
        {preview && (
          <div
            className="fixed z-100 pointer-events-none -translate-y-1/2"
            style={{ top: preview.top, left: preview.left }}
          >
            <div className="w-40 aspect-3/4 rounded-xl overflow-hidden shadow-2xl bg-dark-900">
              <img
                src={getImageSrc(preview.url)}
                alt={preview.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingSale && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark-900 flex items-center justify-center shrink-0">
                  {editingSale.imageUrl ? (
                    <img
                      src={getImageSrc(editingSale.imageUrl)}
                      alt={editingSale.itemName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageOff size={24} className="text-dark-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wide flex items-center gap-1">
                    <Pencil size={12} /> Modifier la vente
                  </p>
                  <h2 className="text-lg font-semibold text-dark-50">
                    {editingSale.itemName}
                  </h2>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Quantité vendue *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    autoFocus
                    value={editData.quantity}
                    onChange={(e) => setEditData({ ...editData, quantity: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  />
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
                      value={editData.purchasePrice}
                      onChange={(e) => setEditData({ ...editData, purchasePrice: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-2">
                      Prix de vente (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editData.salePrice}
                      onChange={(e) => setEditData({ ...editData, salePrice: e.target.value })}
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Date de vente
                  </label>
                  <input
                    type="date"
                    value={editData.saleDate}
                    onChange={(e) => setEditData({ ...editData, saleDate: e.target.value })}
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
                    onClick={() => setEditingSale(null)}
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
