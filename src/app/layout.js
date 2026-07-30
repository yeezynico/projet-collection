import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "Pokemon Collection",
  description: "Gestion de collection Pokémon",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
