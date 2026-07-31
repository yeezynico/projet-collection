"use client";

import { Menu } from "lucide-react";

export default function Header({ onMenuClick }) {
  return (
    <header className="bg-dark-800/50 backdrop-blur border-b border-dark-700 px-4 lg:px-6 py-4 flex items-center justify-between">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-dark-700 rounded-lg transition"
      >
        <Menu size={24} className="text-dark-50" />
      </button>

      <h1 className="text-lg font-semibold text-dark-50 hidden sm:block">
        Gestion de Collection Pokémon
      </h1>

      <div className="flex-1 lg:flex-none" />
    </header>
  );
}
