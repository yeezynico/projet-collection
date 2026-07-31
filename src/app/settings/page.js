"use client";

import DashboardLayout from "@/components/dashboard/Layout";
import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <DashboardLayout user={session?.user}>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-dark-50">Paramètres</h1>
          <p className="text-dark-400 mt-1">Gérez votre compte et préférences</p>
        </div>

        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-dark-50 mb-4">Informations du compte</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-dark-400 block mb-1">Email</label>
              <p className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50">
                {session?.user?.email}
              </p>
            </div>
            <div>
              <label className="text-sm text-dark-400 block mb-1">Nom</label>
              <p className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50">
                {session?.user?.name || "Non défini"}
              </p>
            </div>
            <div>
              <label className="text-sm text-dark-400 block mb-1">ID utilisateur</label>
              <p className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-50 text-xs font-mono">
                {session?.user?.id}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-dark-50 mb-4">À propos</h2>
          <div className="space-y-4 text-dark-400">
            <p>
              <strong className="text-dark-200">Pokémon Collection v1.0</strong>
            </p>
            <p>
              Application de gestion de collection Pokémon avec suivi des cartes,
              produits scellés et historique des ventes.
            </p>
            <p className="text-sm">
              Built with Next.js, Prisma, PostgreSQL et Tailwind CSS.
            </p>
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-semibold hover:bg-red-500/30 transition"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
