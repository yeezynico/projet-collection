import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Dashboard Pokémon</h1>

      <p>Connecté avec : {session.user.email}</p>

      <p>ID utilisateur : {session.user.id}</p>
      <LogoutButton />
    </main>
  );
}
