"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import { Plus, Search } from "lucide-react";
import { useSession } from "next-auth/react";

export default function SealedPage() {
  const { data: session } = useSession();
  const [sealed, setSealed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "", type: "", quantity: 1, purchasePrice: 0, currentPrice: 0,
    imageUrl: "", purchaseDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => { fetchSealed(); }, [search, sort]);

  async function fetchSealed() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (sort) params.append("sort", sort);
      const res = await fetch(`/api/sealed?${params}`);
      if (res.ok) setSealed(await res.json());
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/sealed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormData({
          name: "", type: "", quantity: 1, purchasePrice: 0, currentPrice: 0,
          imageUrl: "", purchaseDate: new Date().toISOString().split("T")[0],
        });
        setShowForm(false);
        fetchSealed();
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function deleteSealed(id) {
    if (!confirm("Êtes-vous sûr ?")) return;
    const res = await fetch(`/api/sealed/${id}`, { method: "DELETE" });
    if (res.ok) fetchSealed();
  }

  const totalInvested = sealed.reduce((sum, s) => sum + s.purchasePrice * s.quantity, 0);
  const totalValue = sealed.reduce((sum, s) => sum + (s.currentPrice || s.purchasePrice) * s.quantity, 0);

  return (
    <DashboardLayout user={session?.user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark-50">Produits scellés</h1>
            <p className="text-dark-400 mt-1">{sealed.length} produit{sealed.length > 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-lg font-semibold"
          >
            <Plus size={20} /> Ajouter
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-dark-800/50 border border-dark-700 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-dark-50 mb-4">Ajouter un produit</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" required placeholder="Nom" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50" />
              <select required value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50">
                <option value="">Type...</option>
                <option value="ETB">ETB</option>
                <option value="Display">Display</option>
                <option value="Coffret">Coffret</option>
                <option value="Bundle">Bundle</option>
              </select>
              <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50" />
              <input type="number" step="0.01" required value={formData.purchasePrice} onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) })} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50" placeholder="Prix d'achat" />
              <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold">Ajouter</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-dark-700 text-dark-200 rounded-lg">Annuler</button>
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
            <option value="name-asc">A → Z</option>
            <option value="name-desc">Z → A</option>
            <option value="price-asc">Prix ↑</option>
            <option value="price-desc">Prix ↓</option>
          </select>
        </div>

        {sealed.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Investi</p>
              <p className="text-2xl font-bold text-dark-50">€{totalInvested.toFixed(2)}</p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Valeur</p>
              <p className="text-2xl font-bold text-dark-50">€{totalValue.toFixed(2)}</p>
            </div>
            <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
              <p className="text-dark-400 text-sm">Gain</p>
              <p className={`text-2xl font-bold ${totalValue - totalInvested >= 0 ? "text-green-400" : "text-red-400"}`}>€{(totalValue - totalInvested).toFixed(2)}</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center py-12 text-dark-400">Chargement...</p>
        ) : sealed.length === 0 ? (
          <div className="text-center py-12 bg-dark-800/50 rounded-xl">
            <p className="text-dark-400 mb-4">Aucun produit</p>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-primary text-white rounded-lg">Ajouter</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sealed.map((item) => {
              const gain = (item.currentPrice || item.purchasePrice) * item.quantity - item.purchasePrice * item.quantity;
              return (
                <div key={item.id} className="bg-dark-800/50 border border-dark-700 rounded-xl overflow-hidden">
                  {item.imageUrl && <div className="aspect-square bg-dark-900 overflow-hidden"><img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /></div>}
                  <div className="p-4 space-y-3">
                    <h3 className="font-semibold text-dark-50 line-clamp-2">{item.name}</h3>
                    <p className="text-xs text-brand-secondary">{item.type}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-dark-400">Achat:</span><span>€{item.purchasePrice.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-dark-400">Actuel:</span><span>€{(item.currentPrice || item.purchasePrice).toFixed(2)}</span></div>
                      <div className={`flex justify-between font-semibold ${gain >= 0 ? "text-green-400" : "text-red-400"}`}><span>Gain:</span><span>€{gain.toFixed(2)}</span></div>
                    </div>
                    <button onClick={() => deleteSealed(item.id)} className="w-full px-3 py-2 bg-red-500/10 text-red-400 rounded text-sm font-medium hover:bg-red-500/20">Supprimer</button>
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
