"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import { Plus, Search } from "lucide-react";
import { useSession } from "next-auth/react";

export default function CardsPage() {
  const { data: session } = useSession();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    extension: "",
    category: "",
    quantity: 1,
    purchasePrice: 0,
    currentPrice: 0,
    imageUrl: "",
    cardmarketUrl: "",
    purchaseDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchCards();
  }, [search, sort]);

  async function fetchCards() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (sort) params.append("sort", sort);

      const res = await fetch(`/api/cards?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data);
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({
          name: "",
          extension: "",
          category: "",
          quantity: 1,
          purchasePrice: 0,
          currentPrice: 0,
          imageUrl: "",
          cardmarketUrl: "",
          purchaseDate: new Date().toISOString().split("T")[0],
        });
        setShowForm(false);
        fetchCards();
      }
    } catch (error) {
      console.error("Error adding card:", error);
    }
  }

  async function deleteCard(id) {
    if (!confirm("Êtes-vous sûr ?")) return;

    try {
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCards();
      }
    } catch (error) {
      console.error("Error deleting card:", error);
    }
  }

  const totalInvested = cards.reduce(
    (sum, card) => sum + card.purchasePrice * card.quantity,
    0
  );
  const totalValue = cards.reduce(
    (sum, card) => sum + (card.currentPrice || card.purchasePrice) * card.quantity,
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
              {cards.length} carte{cards.length > 1 ? "s" : ""} dans votre collection
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-lg font-semibold hover:shadow-lg transition"
          >
            <Plus size={20} />
            Ajouter une carte
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold text-dark-50 mb-4">
              Ajouter une nouvelle carte
            </h2>

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
                  <option value="Promo">Promo</option>
                  <option value="Rare">Illustration Rare</option>
                  <option value="Alt Art">Illustration Rare Spéciale / Alt Art</option>
                  <option value="Gold">Gold</option>
                  <option value="EX">EX</option>
                  <option value="GX">GX</option>
                  <option value="V">V</option>
                  <option value="VMAX">VMAX</option>
                  <option value="VSTAR">VSTAR</option>
                  <option value="Full Art">Full Art</option>
                  <option value="Rainbow">Rainbow</option>
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
                    setFormData({
                      ...formData,
                      quantity: parseInt(e.target.value),
                    })
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
                    setFormData({
                      ...formData,
                      purchasePrice: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Prix actuel (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currentPrice: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
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

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Date d'achat
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      purchaseDate: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-primary/90 transition"
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
        </div>

        {/* Stats */}
        {cards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Montant investi</p>
              <p className="text-2xl font-bold text-dark-50">
                €{totalInvested.toFixed(2)}
              </p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Valeur actuelle</p>
              <p className="text-2xl font-bold text-dark-50">
                €{totalValue.toFixed(2)}
              </p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Gain potentiel</p>
              <p
                className={`text-2xl font-bold ${
                  potentialGain >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                €{potentialGain.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Cards List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-dark-400">Chargement...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 bg-dark-800/50 rounded-xl">
            <p className="text-dark-400 mb-4">Aucune carte pour le moment</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-primary/90 transition"
            >
              Ajouter votre première carte
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => {
              const gain = (card.currentPrice || card.purchasePrice) * card.quantity - card.purchasePrice * card.quantity;
              const gainPercent = card.purchasePrice > 0 ? (gain / (card.purchasePrice * card.quantity)) * 100 : 0;

              return (
                <div
                  key={card.id}
                  className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-xl overflow-hidden hover:border-dark-600 transition group"
                >
                  {card.imageUrl && (
                    <div className="aspect-square bg-dark-900 overflow-hidden">
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    <h3 className="font-semibold text-dark-50 line-clamp-2">
                      {card.name}
                    </h3>

                    {card.extension && (
                      <p className="text-xs text-brand-primary">
                        {card.extension}
                      </p>
                    )}

                    <div className="space-y-2 text-sm">
                      {card.quantity > 1 && (
                        <div className="flex justify-between">
                          <span className="text-dark-400">Quantité:</span>
                          <span className="text-dark-50">{card.quantity}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-dark-400">Achat:</span>
                        <span className="text-dark-50">€{card.purchasePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400">Actuel:</span>
                        <span className="text-dark-50">
                          €{(card.currentPrice || card.purchasePrice).toFixed(2)}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between font-semibold ${
                          gain >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        <span>Gain:</span>
                        <span>
                          €{gain.toFixed(2)} ({gainPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-dark-700">
                      <button
                        onClick={() => deleteCard(card.id)}
                        className="flex-1 px-3 py-2 bg-red-500/10 text-red-400 rounded text-sm font-medium hover:bg-red-500/20 transition"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
