import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Inscription | Pokémon Collection",
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="surface rounded-3xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-dark-50 mb-2">
              Créer un compte
            </h1>
            <p className="text-dark-400">
              Commencez à gérer votre collection Pokémon
            </p>
          </div>

          <RegisterForm />
        </div>

        <p className="text-center text-dark-500 text-sm mt-6">
          Votre collection Pokémon, organisée et sécurisée.
        </p>
      </div>
    </main>
  );
}
