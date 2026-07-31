# 🎴 Pokémon Collection

Application web full-stack pour gérer une collection de cartes Pokémon à l'unité et produits scellés, avec suivi des achats, ventes et gains.

## ✨ Fonctionnalités

- ✅ **Authentification** - Inscription/Connexion sécurisée avec bcrypt
- ✅ **Dashboard** - Statistiques globales de votre collection
- ✅ **Gestion des cartes** - CRUD complet avec filtres et recherche
- ✅ **Gestion des produits scellés** - ETB, Displays, Coffrets, Bundles
- ✅ **Historique des ventes** - Suivi des gains réalisés
- ✅ **Calcul des gains** - Potentiels et réalisés en € et %
- ✅ **Design moderne** - Interface inspirée de Finary (dark mode)
- ✅ **Responsive** - Mobile, tablette, desktop

## 🛠️ Stack technique

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Supabase
- **ORM:** Prisma 7
- **Auth:** NextAuth.js v5
- **Icons:** Lucide React

## 🚀 Démarrage rapide

### 1. Configuration de la base de données

```bash
# Créer un projet Supabase (https://supabase.com) ou PostgreSQL local
# Copier le fichier d'environnement
cp .env.example .env.local

# Éditer .env.local avec vos credentials
# DATABASE_URL="postgresql://user:password@host:5432/db"
# NEXTAUTH_SECRET="votre-clé-secrète-min-32-chars"
# NEXTAUTH_URL="http://localhost:3000"
```

### 2. Installation et configuration

```bash
# Installer les dépendances
npm install

# Générer le client Prisma
npx prisma generate

# Lancer les migrations
npx prisma migrate dev

# Démarrer le serveur
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📖 Utilisation

### Pages

- `/` - Redirection vers dashboard
- `/login` - Connexion
- `/register` - Inscription
- `/dashboard` - Tableau de bord principal
- `/cards` - Gestion des cartes Pokémon
- `/sealed` - Gestion des produits scellés
- `/sales` - Historique des ventes
- `/settings` - Paramètres du compte

### Ajouter une carte

1. Cliquer sur "Ajouter une carte"
2. Remplir :
   - Nom (requis)
   - Extension (optionnel)
   - Catégorie (Promo, EX, VMAX, etc.)
   - Quantité, Prix d'achat, Prix actuel
3. Valider

## 💰 Formules

```
Gain potentiel = (prix_actuel × quantité) - (prix_achat × quantité)
Pourcentage = (gain / investissement) × 100

⚠️ Si prix_achat = 0€, pourcentage non affiché
```

## 🗄️ Modèle de données

- **User:** Authentification et data isolation
- **Card:** Cartes à l'unité
- **SealedProduct:** Produits scellés
- **Sale:** Historique des ventes

## 🎨 Design

- Dark mode par défaut
- Inspiré de Finary
- Couleurs: Bleu (#3b82f6), Violet (#8b5cf6), Vert, Rouge
- Responsive mobile-first

## 📝 Scripts

```bash
npm run dev              # Développement
npm run build            # Build
npm start               # Production
npm run lint            # Linter
npx prisma studio      # Interface Prisma
```

## 🔒 Sécurité

- Mots de passe hashés (bcrypt)
- Sessions JWT
- Isolation des données par utilisateur
- Input validation

## 📦 Déploiement

Sur Vercel :
```bash
# Connecter le repo et déployer
# Les env vars sont auto-détectées
```

Sur Supabase :
```bash
# Utiliser le DATABASE_URL de Supabase
```

## 🚀 Prochaines étapes

- [ ] Import/Export CSV
- [ ] Graphiques d'évolution
- [ ] Favoris et notes
- [ ] Intégration Cardmarket
- [ ] Scan de cartes

## 📄 Licence

MIT
