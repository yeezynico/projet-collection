import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Connexion | Pokémon Collection",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const registered = params?.registered;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-dark-800/50 backdrop-blur border border-dark-700 rounded-2xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-dark-50 mb-2">
              Pokémon Collection
            </h1>
            <p className="text-dark-400">Connectez-vous à votre collection</p>
          </div>

          {registered && (
            <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
              Inscription réussie ! Connectez-vous maintenant.
            </div>
          )}

          <LoginForm />
        </div>

        <p className="text-center text-dark-500 text-sm mt-6">
          Votre collection Pokémon, organisée et sécurisée.
        </p>
      </div>
    </main>
  );
}
