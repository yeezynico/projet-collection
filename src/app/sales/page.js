"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/Layout";
import { useSession } from "next-auth/react";

export default function SalesPage() {
  const { data: session } = useSession();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const totalInvested = sales.reduce((sum, s) => sum + s.purchasePrice * s.quantity, 0);
  const totalSold = sales.reduce((sum, s) => sum + s.salePrice * s.quantity, 0);
  const totalGain = sales.reduce((sum, s) => sum + s.gain, 0);

  return (
    <DashboardLayout user={session?.user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-dark-50">Historique des ventes</h1>
          <p className="text-dark-400 mt-1">{sales.length} vente{sales.length > 1 ? "s" : ""}</p>
        </div>

        {sales.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        )}

        {loading ? (
          <p className="text-center py-12 text-dark-400">Chargement...</p>
        ) : sales.length === 0 ? (
          <div className="text-center py-12 bg-dark-800/50 rounded-xl">
            <p className="text-dark-400">Aucune vente pour le moment</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-dark-800/50 border border-dark-700 rounded-xl">
            <table className="w-full">
              <thead className="bg-dark-900/50 border-b border-dark-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-dark-200">Nom</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-dark-200">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-dark-200">Quantité</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-dark-200">Achat</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-dark-200">Vente</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-dark-200">Gain</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-dark-200">%</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-dark-200">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-dark-700/50 transition">
                    <td className="px-6 py-3 text-dark-50">{sale.itemName}</td>
                    <td className="px-6 py-3 text-dark-400 text-sm">{sale.itemType}</td>
                    <td className="px-6 py-3 text-dark-50">{sale.quantity}</td>
                    <td className="px-6 py-3 text-right text-dark-50">€{(sale.purchasePrice * sale.quantity).toFixed(2)}</td>
                    <td className="px-6 py-3 text-right text-dark-50">€{(sale.salePrice * sale.quantity).toFixed(2)}</td>
                    <td className={`px-6 py-3 text-right font-semibold ${sale.gain >= 0 ? "text-green-400" : "text-red-400"}`}>€{sale.gain.toFixed(2)}</td>
                    <td className={`px-6 py-3 text-right font-semibold ${sale.percentage >= 0 ? "text-green-400" : "text-red-400"}`}>{sale.percentage?.toFixed(1)}%</td>
                    <td className="px-6 py-3 text-dark-400 text-sm">{new Date(sale.saleDate).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
