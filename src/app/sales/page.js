"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import { useSession } from "next-auth/react";
import { ImageOff, Search, ChevronLeft, ChevronRight, SlidersHorizontal, Pencil, Trash2, Plus, Link2, Loader2 } from "lucide-react";
import { getImageSrc } from "@/lib/image";
import Modal from "@/components/ui/Modal";
import {
  CARD_CATEGORIES,
  SEALED_TYPES,
  LANGUAGES,
  getLanguage,
} from "@/lib/categories";
import ItemDetailModal from "@/components/ItemDetailModal";

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


const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** Décalage en mois entre une date et le mois courant. */
function monthOffset(year, month) {
  const now = new Date();
  return (year - now.getFullYear()) * 12 + (month - now.getMonth());
}

/** Décalage en semaines entre une date et la semaine courante. */
function weekOffset(date) {
  const now = new Date();
  const monday = (d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() + ((c.getDay() === 0 ? -6 : 1) - c.getDay()));
    return c;
  };
  return Math.round((monday(date) - monday(now)) / (7 * 86400000));
}


/**
 * Sélecteur de période : grille de mois, liste d'années, ou semaines
 * récentes selon le mode actif. Les périodes futures sont désactivées.
 */
function PeriodPicker({ type, range, onSelect }) {
  const now = new Date();
  const current = range?.start ?? now;

  if (type === "year") {
    const years = [];
    for (let y = now.getFullYear(); y > now.getFullYear() - 8; y--) years.push(y);

    return (
      <div className="grid grid-cols-3 gap-1.5">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onSelect(y - now.getFullYear())}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              y === current.getFullYear()
                ? "pill-active"
                : "text-dark-300 hover:bg-white/5"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    );
  }

  if (type === "week") {
    const weeks = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      weeks.push(d);
    }

    return (
      <div className="max-h-64 overflow-y-auto space-y-1">
        {weeks.map((d, i) => {
          const monday = new Date(d);
          monday.setDate(d.getDate() + ((d.getDay() === 0 ? -6 : 1) - d.getDay()));
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          const opts = { day: "numeric", month: "short" };

          return (
            <button
              key={i}
              onClick={() => onSelect(weekOffset(d))}
              className={`w-full py-2 px-3 rounded-lg text-sm text-left transition ${
                i === 0 && !range
                  ? "text-dark-300 hover:bg-white/5"
                  : monday.toDateString() === current.toDateString()
                    ? "pill-active font-medium"
                    : "text-dark-300 hover:bg-white/5"
              }`}
            >
              {monday.toLocaleDateString("fr-FR", opts)} –{" "}
              {sunday.toLocaleDateString("fr-FR", opts)}
            </button>
          );
        })}
      </div>
    );
  }

  // Mois : navigation par année puis grille des douze mois
  const year = current.getFullYear();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onSelect(monthOffset(year - 1, current.getMonth()))}
          className="p-1 rounded-md text-dark-400 hover:text-dark-50 hover:bg-white/5 transition"
          aria-label="Année précédente"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-dark-100">{year}</span>
        <button
          onClick={() => onSelect(monthOffset(year + 1, current.getMonth()))}
          disabled={year >= now.getFullYear()}
          className="p-1 rounded-md text-dark-400 hover:text-dark-50 hover:bg-white/5 transition disabled:opacity-25 disabled:cursor-not-allowed"
          aria-label="Année suivante"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((label, m) => {
          const offset = monthOffset(year, m);
          const future = offset > 0;
          const active = year === current.getFullYear() && m === current.getMonth();

          return (
            <button
              key={m}
              onClick={() => onSelect(offset)}
              disabled={future}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                active
                  ? "pill-active"
                  : future
                    ? "text-dark-600 cursor-not-allowed"
                    : "text-dark-300 hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [lookupUrl, setLookupUrl] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupInfo, setLookupInfo] = useState("");
  const [lookupCandidates, setLookupCandidates] = useState([]);
  const [addData, setAddData] = useState({
    itemName: "",
    itemType: "card",
    itemCategory: "",
    language: "",
    itemNumber: "",
    extension: "",
    cardmarketUrl: "",
    quantity: "1",
    purchasePrice: "",
    salePrice: "",
    saleDate: new Date().toISOString().split("T")[0],
    imageUrl: "",
  });
  const [editingSale, setEditingSale] = useState(null);
  const [detailSale, setDetailSale] = useState(null);
  const [editData, setEditData] = useState({
    language: "",
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
      sealed: sale.itemType === "sealed",
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

  /**
   * Recopie un résultat de recherche dans le formulaire.
   * Le type est déduit du lien : `/Singles/` donne une carte, le reste un scellé.
   */
  function applyLookup(data) {
    setAddData((prev) => ({
      ...prev,
      itemName: data.name || prev.itemName,
      itemType: data.kind === "sealed" ? "sealed" : "card",
      itemCategory: data.category || data.type || prev.itemCategory,
      imageUrl: data.imageUrl || prev.imageUrl,
      // Numéro, extension et lien alimentent la fiche de l'article vendu :
      // sans eux, la recherche eBay ramènerait toutes les versions.
      itemNumber: data.number || prev.itemNumber,
      extension: data.extension || prev.extension,
      cardmarketUrl: data.cardmarketUrl || prev.cardmarketUrl,
    }));
  }

  /** Remplit le formulaire de vente depuis un lien Cardmarket. */
  async function handleLookup() {
    if (!lookupUrl.trim()) return;

    setLookupLoading(true);
    setLookupError("");
    setLookupInfo("");
    setLookupCandidates([]);

    try {
      const res = await fetch(
        `/api/lookup?url=${encodeURIComponent(lookupUrl.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setLookupError(data.error || "Récupération impossible");
        return;
      }

      applyLookup(data);
      setLookupCandidates(data.candidates || []);

      setLookupInfo(
        data.multiple
          ? `${data.candidates.length} versions trouvées pour « ${data.name} ». Sélectionnez la vôtre.`
          : `${data.name} récupéré${data.kind === "sealed" ? "" : "e"}. Complétez les prix.`
      );
    } catch {
      setLookupError("Erreur réseau lors de la récupération");
    } finally {
      setLookupLoading(false);
    }
  }

  function resetAddForm() {
    setAddData({
      itemName: "",
      itemType: "card",
      itemCategory: "",
      language: "",
      itemNumber: "",
      extension: "",
      cardmarketUrl: "",
      quantity: "1",
      purchasePrice: "",
      salePrice: "",
      saleDate: new Date().toISOString().split("T")[0],
      imageUrl: "",
    });
    setLookupUrl("");
    setLookupInfo("");
    setLookupError("");
    setLookupCandidates([]);
  }

  /** Enregistre une vente sans article lié : utile pour une vente oubliée. */
  async function handleAddSale(e) {
    e.preventDefault();

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addData,
          quantity: parseInt(addData.quantity) || 1,
          purchasePrice: parseFloat(addData.purchasePrice) || 0,
          salePrice: parseFloat(addData.salePrice) || 0,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setSales((prev) => [created, ...prev]);
        resetAddForm();
        setShowAddForm(false);
      }
    } catch (error) {
      console.error("Error adding sale:", error);
    }
  }

  function openEditModal(sale) {
    setEditingSale(sale);
    setEditData({
      language: sale.language || "",
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
          ? {
              ...s,
              quantity,
              purchasePrice,
              salePrice,
              gain,
              percentage,
              language: editData.language || null,
              saleDate: editData.saleDate,
            }
          : s
      )
    );
    setEditingSale(null);

    try {
      const res = await fetch(`/api/sales/${editingSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity,
          purchasePrice,
          salePrice,
          language: editData.language,
          saleDate: editData.saleDate,
        }),
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark-50">Historique des ventes</h1>
            <p className="text-dark-400 mt-1">
              {filteredSales.length} vente{filteredSales.length > 1 ? "s" : ""}
              {filteredSales.length !== sales.length && ` sur ${sales.length}`}
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 btn-gold rounded-lg font-semibold hover:shadow-lg transition"
          >
            <Plus size={20} />
            Ajouter une vente
          </button>
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
                    ? "btn-gold shadow"
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
              {/* Le libellé ouvre un sélecteur, pour atteindre une période
                  lointaine sans multiplier les clics sur les flèches. */}
              <div className="relative">
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  className="text-sm font-semibold text-dark-50 min-w-36 text-center px-2 py-1 rounded-lg hover:bg-white/5 transition"
                >
                  {periodLabel}
                </button>

                {pickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setPickerOpen(false)}
                    />
                    <div className="absolute z-40 top-full mt-2 left-1/2 -translate-x-1/2 w-64 surface bg-dark-900 rounded-2xl p-3 shadow-2xl">
                      <PeriodPicker
                        type={periodType}
                        range={periodRange}
                        onSelect={(offset) => {
                          setPeriodOffset(offset);
                          setPickerOpen(false);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
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
          <div className="surface rounded-2xl p-4 space-y-4">
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
            <div className="surface rounded-xl p-4">
              <p className="text-dark-400 text-sm">Total investi</p>
              <p className="text-2xl font-bold text-dark-50">€{totalInvested.toFixed(2)}</p>
            </div>
            <div className="surface rounded-xl p-4">
              <p className="text-dark-400 text-sm">Total vendu</p>
              <p className="text-2xl font-bold text-dark-50">€{totalSold.toFixed(2)}</p>
            </div>
            <div className="surface rounded-xl p-4">
              <p className="text-dark-400 text-sm">Gain total</p>
              <p className={`text-2xl font-bold ${totalGain >= 0 ? "text-green-400" : "text-red-400"}`}>€{totalGain.toFixed(2)}</p>
            </div>
            <div className="surface rounded-xl p-4">
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
          <div className="text-center py-12 surface rounded-2xl">
            <p className="text-dark-400">
              {sales.length === 0 ? "Aucune vente pour le moment" : "Aucune vente ne correspond aux filtres"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto surface rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-dark-900/50 border-b border-dark-700">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-dark-200">Nom</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-dark-200">Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-dark-200">Langue</th>
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
                      <div className="flex items-center gap-2.5">
                        {/* Miniature de l'article : le survol l'agrandit,
                            le clic ouvre la fiche et les places de marché. */}
                        <button
                          type="button"
                          onMouseEnter={(e) => showPreview(e, sale)}
                          onMouseLeave={hidePreview}
                          onClick={() => {
                            hidePreview();
                            setDetailSale(sale);
                          }}
                          title="Voir la fiche et comparer les prix"
                          className="w-9 h-12 rounded-md overflow-hidden bg-dark-950 ring-1 ring-white/8 shrink-0 hover:ring-brand-primary/50 transition cursor-pointer"
                        >
                          {sale.imageUrl ? (
                            <img
                              src={getImageSrc(sale.imageUrl)}
                              alt=""
                              className={`w-full h-full ${
                                sale.itemType === "sealed"
                                  ? "object-contain p-0.5"
                                  : "object-cover"
                              }`}
                            />
                          ) : (
                            <span className="flex items-center justify-center w-full h-full text-dark-600">
                              <ImageOff size={14} />
                            </span>
                          )}
                        </button>
                        <span className="line-clamp-2">{sale.itemName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-dark-400">
                      {TYPE_LABELS[sale.itemType] || sale.itemType}
                      {sale.itemCategory && (
                        <span className="text-dark-500"> · {sale.itemCategory}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {getLanguage(sale.language) ? (
                        <span
                          title={getLanguage(sale.language).label}
                          className="flex items-center gap-1.5 text-dark-300 whitespace-nowrap"
                        >
                          <span className="text-base leading-none">
                            {getLanguage(sale.language).flag}
                          </span>
                          {getLanguage(sale.language).value}
                        </span>
                      ) : (
                        <span className="text-dark-600">—</span>
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
            <div
              className={`w-44 ${
                preview.sealed ? "aspect-square p-2" : "aspect-3/4"
              } rounded-2xl overflow-hidden shadow-2xl bg-dark-900 ring-1 ring-white/10`}
            >
              <img
                src={getImageSrc(preview.url)}
                alt={preview.name}
                className={`w-full h-full ${preview.sealed ? "object-contain" : "object-cover"}`}
              />
            </div>
          </div>
        )}

        {/* Ajout d'une vente non rattachée à la collection */}
        {showAddForm && (
          <Modal
            onClose={() => {
              resetAddForm();
              setShowAddForm(false);
            }}
            panelClassName="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-dark-50">
                Ajouter une vente
              </h2>
              <p className="text-sm text-dark-400 mt-1">
                Pour une vente réalisée sans que l'article soit dans votre
                collection. Rien ne sera retiré des cartes ou scellés.
              </p>
            </div>

            {/* Remplissage automatique : le même champ accepte une carte
                comme un produit scellé, le type étant déduit du lien. */}
            <div className="bg-linear-to-br from-brand-primary/10 to-brand-secondary/10 border border-dark-600 rounded-xl p-4 space-y-3 mb-4">
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
                  placeholder="Lien d'une carte ou d'un produit scellé"
                  className="flex-1 min-w-56 px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 text-sm"
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

              {lookupError && <p className="text-sm text-red-400">{lookupError}</p>}
              {lookupInfo && <p className="text-sm text-green-400">{lookupInfo}</p>}

              {lookupCandidates.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {lookupCandidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyLookup(c)}
                      className={`rounded-lg overflow-hidden border-2 transition ${
                        addData.itemName === c.name && addData.imageUrl === c.imageUrl
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
                      <p className="text-[10px] text-dark-300 py-0.5 bg-dark-900/80">
                        n°{c.number}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddSale} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Nom de l'article *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={addData.itemName}
                  onChange={(e) => setAddData({ ...addData, itemName: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Type *
                  </label>
                  <select
                    required
                    value={addData.itemType}
                    onChange={(e) =>
                      setAddData({ ...addData, itemType: e.target.value, itemCategory: "" })
                    }
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Catégorie
                  </label>
                  <select
                    value={addData.itemCategory}
                    onChange={(e) =>
                      setAddData({ ...addData, itemCategory: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                  >
                    <option value="">Non précisée</option>
                    {(addData.itemType === "card" ? CARD_CATEGORIES : SEALED_TYPES).map(
                      (c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Langue
                </label>
                <select
                  value={addData.language}
                  onChange={(e) => setAddData({ ...addData, language: e.target.value })}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-2">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={addData.quantity}
                    onChange={(e) => setAddData({ ...addData, quantity: e.target.value })}
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
                    value={addData.purchasePrice}
                    onChange={(e) =>
                      setAddData({ ...addData, purchasePrice: e.target.value })
                    }
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
                    value={addData.salePrice}
                    onChange={(e) => setAddData({ ...addData, salePrice: e.target.value })}
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
                  value={addData.saleDate}
                  onChange={(e) => setAddData({ ...addData, saleDate: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  URL de l'image
                </label>
                <input
                  type="url"
                  value={addData.imageUrl}
                  onChange={(e) => setAddData({ ...addData, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-50 focus:border-brand-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:shadow-lg transition"
                >
                  Enregistrer la vente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAddForm();
                    setShowAddForm(false);
                  }}
                  className="px-4 py-2.5 bg-dark-700 text-dark-200 rounded-lg font-semibold hover:bg-dark-600 transition"
                >
                  Annuler
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Modal */}
        {editingSale && (
          <Modal
            onClose={() => setEditingSale(null)}
            panelClassName="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
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
                  className="flex-1 px-4 py-2.5 btn-gold rounded-lg font-semibold hover:shadow-lg transition"
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
          </Modal>
        )}

        {/* Fiche de l'article vendu : les caractéristiques recopiées lors de
            la vente permettent d'interroger les places de marché. */}
        {detailSale && (
          <ItemDetailModal
            sale
            kind={detailSale.itemType}
            onClose={() => setDetailSale(null)}
            item={{
              name: detailSale.itemName,
              number: detailSale.itemNumber,
              extension: detailSale.extension,
              category: detailSale.itemCategory,
              type: detailSale.itemCategory,
              language: detailSale.language,
              condition: detailSale.condition,
              cardmarketUrl: detailSale.cardmarketUrl,
              imageUrl: detailSale.imageUrl,
              quantity: detailSale.quantity,
              purchasePrice: detailSale.purchasePrice,
              // La fiche met en avant « currentPrice » : pour une vente,
              // c'est le montant auquel l'article est parti.
              currentPrice: detailSale.salePrice,
              purchaseDate: detailSale.saleDate,
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
