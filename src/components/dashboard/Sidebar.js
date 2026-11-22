"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Eye,
  Package,
  TrendingUp,
  ShoppingBag,
  LogOut,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/cards", icon: Cpu, label: "Cartes" },
  { href: "/watchlist", icon: Eye, label: "Cartes à suivre" },
  { href: "/sealed", icon: Package, label: "Produits scellés" },
  { href: "/future-purchases", icon: ShoppingBag, label: "Futur achat" },
  { href: "/sales", icon: TrendingUp, label: "Historique des ventes" },
];

export default function Sidebar({ onClose }) {
  const pathname = usePathname();

  return (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-dark-700 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gradient-gold">PC</h1>
          <p className="text-xs text-dark-400">Pokémon Collection</p>
        </div>
        <button onClick={onClose} className="lg:hidden text-dark-400">
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                isActive
                  ? "bg-brand-primary/12 text-brand-primary border border-brand-primary/25"
                  : "text-dark-400 hover:bg-white/5 hover:text-dark-100"
              }`}
              onClick={onClose}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-6 border-t border-dark-700">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-dark-300 hover:bg-red-500/10 hover:text-red-400 transition"
        >
          <LogOut size={20} />
          <span className="font-medium">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
