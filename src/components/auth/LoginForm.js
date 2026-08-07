"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
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
        {loading ? "Connexion..." : "Se connecter"}
      </button>

      <p className="text-center text-dark-400">
        Pas encore de compte ?{" "}
        <Link href="/register" className="text-brand-primary hover:text-brand-light font-semibold">
          S'inscrire
        </Link>
      </p>
    </form>
  );
}
