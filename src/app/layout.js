import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "Pokémon Collection",
  description: "Gestion de collection Pokémon - Suivi des cartes et produits scellés",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
