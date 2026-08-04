/**
 * Accès au catalogue TCGplayer exposé publiquement par TCGCSV.
 * Sert uniquement à retrouver la photo des produits scellés, absents
 * de la base de cartes Pokémon TCG.
 */

const BASE = "https://tcgcsv.com/tcgplayer";
const POKEMON_CATEGORY = 3;

/**
 * TCGCSV impose un User-Agent identifiable et une actualisation quotidienne
 * au maximum : le cache de 24 h respecte leurs recommandations d'usage.
 */
const CACHE = {
  headers: { "User-Agent": "PokemonCollection/1.0" },
  next: { revalidate: 86400 },
};

/** Retire le préfixe d'édition : « SV04: Paradox Rift » -> « Paradox Rift ». */
export function cleanGroupName(name = "") {
  return name.replace(/^[A-Z]{1,6}\d{0,2}:\s*/, "").trim();
}

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(text) {
  return normalize(text).split(" ").filter(Boolean);
}

/**
 * Score de proximité entre deux noms de produit.
 * Les mots communs comptent double, les mots surnuméraires pénalisent,
 * ce qui départage « Booster Box » de « Enhanced Booster Box ».
 */
export function similarity(query, candidate) {
  const a = tokens(query);
  const b = tokens(candidate);
  if (!a.length || !b.length) return -Infinity;

  const setB = new Set(b);
  const common = a.filter((t) => setB.has(t)).length;

  return common * 2 - (a.length - common) - (b.length - common);
}

export async function fetchGroups() {
  const res = await fetch(`${BASE}/${POKEMON_CATEGORY}/groups`, CACHE);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.results || [];
}

export async function fetchProducts(groupId) {
  const res = await fetch(`${BASE}/${POKEMON_CATEGORY}/${groupId}/products`, CACHE);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.results || [];
}

export async function fetchPrices(groupId) {
  const res = await fetch(`${BASE}/${POKEMON_CATEGORY}/${groupId}/prices`, CACHE);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.results || [];
}

/**
 * Trouve l'extension dont le nom ouvre celui du produit.
 * On retient la correspondance la plus longue : « Crown Zenith: Galarian
 * Gallery » l'emporte sur « Crown Zenith » quand les deux conviennent.
 */
export function findGroup(productName, groups) {
  const target = normalize(productName);
  let best = null;

  for (const group of groups) {
    const clean = normalize(cleanGroupName(group.name));
    if (!clean) continue;
    if (target === clean || target.startsWith(`${clean} `)) {
      if (!best || clean.length > normalize(cleanGroupName(best.name)).length) {
        best = group;
      }
    }
  }

  return best;
}

/** Image de la meilleure définition proposée par le CDN TCGplayer. */
export function highResImage(imageUrl) {
  if (!imageUrl) return null;
  return imageUrl.replace(/_\d+w\.jpg$/, "_in_1000x1000.jpg");
}

/**
 * Retrouve la photo d'un produit scellé à partir de son nom Cardmarket.
 * Renvoie null si aucune correspondance convaincante n'est trouvée.
 */
export async function findSealedProduct(productName) {
  if (!productName) return null;

  const groups = await fetchGroups();
  const group = findGroup(productName, groups);
  if (!group) return null;

  const products = await fetchProducts(group.groupId);
  if (!products.length) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const product of products) {
    const score = similarity(productName, product.name);
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }

  // En dessous de ce seuil, la correspondance relève du hasard.
  if (!best || bestScore < 2) return null;

  // Prix TCGplayer, seule cotation accessible pour les scellés (en dollars).
  let priceUsd = null;
  try {
    const prices = await fetchPrices(group.groupId);
    const match = prices.find((p) => p.productId === best.productId);
    const value = match?.marketPrice ?? match?.midPrice ?? match?.lowPrice;
    if (typeof value === "number" && value > 0) priceUsd = value;
  } catch {
    // sans prix, le reste de la fiche demeure exploitable
  }

  return {
    name: best.name,
    imageUrl: highResImage(best.imageUrl),
    productId: best.productId,
    groupName: cleanGroupName(group.name),
    priceUsd,
    score: bestScore,
  };
}
