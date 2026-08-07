"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch (err) {
      setError("Erreur lors de l'inscription");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Nom (optionnel)
        </label>
        <input
          type="text"
          placeholder="Votre nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-xl text-dark-50 placeholder-dark-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Email
        </label>
        <input
          type="email"
          placeholder="votre@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-xl text-dark-50 placeholder-dark-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Mot de passe
        </label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-xl text-dark-50 placeholder-dark-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-200 mb-2">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-xl text-dark-50 placeholder-dark-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 btn-gold font-semibold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Inscription..." : "S'inscrire"}
      </button>

      <p className="text-center text-dark-400">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-brand-primary hover:text-brand-light font-semibold">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
