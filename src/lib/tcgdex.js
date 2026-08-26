/**
 * Accès à TCGdex, source des cartes en français et des cotations Cardmarket.
 */

import { SET_CODE_TO_IDS } from "@/lib/pokemonSets";

const API_BASE = "https://api.tcgdex.net/v2";

// Une fonction sans état ne dispose que de quelques secondes : mieux vaut
// renoncer à une source lente que se faire interrompre sans explication.
const REQUEST_TIMEOUT = 8000;

/**
 * Petite tolérance aux erreurs réseau transitoires.
 *
 * La langue par défaut est le français ; l'anglais sert à composer les
 * adresses Cardmarket, dont les segments reprennent les noms anglais.
 */
export async function apiGet(path, { locale = "fr", attempts = 3 } = {}) {
  const url = `${API_BASE}/${locale}${path}`;
  let lastReason = "aucune réponse";

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 3600 },
        // Sans délai maximal, une source qui ne répond pas immobilise la
        // fonction jusqu'à ce que l'hébergeur la tue, sans rien expliquer.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
      lastReason = `HTTP ${res.status}`;
    } catch (e) {
      lastReason = e?.name === "TimeoutError" ? "délai dépassé" : String(e?.message || e);
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }

  console.error(`TCGdex injoignable (${lastReason}) : ${url}`);
  return null;
}

/**
 * Extension d'où provient une carte, déduite de son identifiant.
 *
 * Le découpage se fait sur le dernier tiret : l'identifiant d'extension peut
 * lui-même en contenir un (« P-A-001 » vient de l'extension « P-A »).
 */
export function setIdOf(cardId) {
  const cut = String(cardId || "").lastIndexOf("-");
  return cut === -1 ? null : cardId.slice(0, cut);
}

/**
 * Table « identifiant d'extension -> { nom, ancienneté } », en un seul appel.
 *
 * La recherche ne renvoie que l'identifiant des cartes ; sans cette table,
 * afficher l'extension coûterait une requête par résultat. L'API listant les
 * extensions de la plus ancienne à la plus récente, leur rang sert à remonter
 * les sorties récentes en tête des résultats.
 */
export async function fetchSetIndex() {
  const sets = await apiGet("/sets");
  if (!Array.isArray(sets)) return new Map();

  return new Map(
    sets
      .filter((s) => s?.id && s?.name)
      .map((s, order) => [s.id, { name: s.name, order }])
  );
}

/**
 * Code d'extension Cardmarket correspondant à une extension TCGdex.
 * Sert à interroger le catalogue TCGplayer quand aucun lien Cardmarket
 * n'accompagne la carte.
 */
export function setCodeFor(setId) {
  if (!setId) return null;
  for (const [code, ids] of Object.entries(SET_CODE_TO_IDS)) {
    if (ids.includes(setId)) return code;
  }
  return null;
}

/**
 * Extensions à écarter : celles du jeu Pokémon Pocket.
 *
 * TCGdex couvre aussi ce jeu, dont les cartes n'existent qu'à l'écran. Elles
 * ne se collectionnent ni ne se cotent, et leurs sorties étant récentes elles
 * se hisseraient en tête des résultats.
 */
export async function fetchDigitalSetIds() {
  const serie = await apiGet("/series/tcgp");
  return new Set((serie?.sets || []).map((s) => s.id));
}

/**
 * Table « identifiant de carte -> nom anglais » pour une extension.
 * Le catalogue TCGplayer étant anglophone, c'est la seule forme comparable.
 */
export async function fetchEnglishNames(setId) {
  const set = await apiGet(`/sets/${setId}`, { locale: "en" });
  return new Map((set?.cards || []).map((c) => [c.id, c.name]));
}
