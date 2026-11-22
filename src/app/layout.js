import "./globals.css";

export const metadata = {
  title: "Pokémon Collection",
  description: "Gestion de collection Pokémon - Suivi des cartes et produits scellés",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
