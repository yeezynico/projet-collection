import { LANGUAGES, CONDITIONS } from "@/lib/categories";

// Identifiant pays Cardmarket (paramètre `sellerCountry`).
export const SELLER_COUNTRIES = [
  { value: "FR", label: "France", cmId: 12 },
  { value: "BE", label: "Belgique", cmId: 2 },
  { value: "DE", label: "Allemagne", cmId: 7 },
  { value: "ES", label: "Espagne", cmId: 21 },
  { value: "IT", label: "Italie", cmId: 14 },
];

// Filtres par défaut : vendeur français, carte française, Near Mint minimum.
export const DEFAULT_CM_FILTERS = {
  sellerCountry: "FR",
  language: "FR",
  minCondition: "NM",
};

/**
 * Construit l'URL Cardmarket pré-filtrée (pays vendeur / langue / état minimum).
 * Les paramètres existants de l'URL d'origine sont remplacés.
 */
export function buildFilteredUrl(baseUrl, filters = DEFAULT_CM_FILTERS) {
  if (!baseUrl) return null;

  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }

  if (!url.hostname.endsWith("cardmarket.com")) return baseUrl;

  const country = SELLER_COUNTRIES.find((c) => c.value === filters.sellerCountry);
  const language = LANGUAGES.find((l) => l.value === filters.language);
  const condition = CONDITIONS.find((c) => c.value === filters.minCondition);

  url.searchParams.delete("sellerCountry");
  url.searchParams.delete("language");
  url.searchParams.delete("minCondition");

  if (country) url.searchParams.set("sellerCountry", country.cmId);
  if (language) url.searchParams.set("language", language.cmId);
  if (condition) url.searchParams.set("minCondition", condition.cmId);

  return url.toString();
}

/**
 * Extrait le code d'extension et le numéro depuis une URL produit Cardmarket.
 * Ex. .../Singles/Silver-Tempest/Lugia-V-V3-SIT186 -> { setCode: "SIT", number: "186" }
 */
export function parseCardmarketUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!url.hostname.endsWith("cardmarket.com")) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const productsIndex = parts.indexOf("Products");
  if (productsIndex === -1 || parts.length < productsIndex + 3) return null;

  const kind = parts[productsIndex + 1]; // Singles, Booster-Boxes, ...
  const slug = parts[parts.length - 1];
  const setSlug = parts[parts.length - 2];

  // Suffixe optionnel identifiant la carte, ex. « -SIT186 » ou « -CRZGG01 ».
  const match = slug.match(/-([A-Z]{2,}[A-Z0-9]*\d)$/);
  const suffix = match ? match[1] : null;

  // Sans suffixe, le slug est le seul nom disponible : « Lugia-V » -> « Lugia V ».
  // On retire aussi les suffixes de variante (« -V1 », « -V3 ») propres à Cardmarket.
  const cardName = (match ? slug.slice(0, match.index) : slug)
    .replace(/-V\d+$/, "")
    .replace(/-/g, " ")
    .trim();

  return {
    isSingle: kind === "Singles",
    kind,
    slug,
    suffix,
    setName: setSlug.replace(/-/g, " "),
    productName: slug.replace(/-/g, " "),
    cardName,
  };
}

/**
 * Sépare un suffixe (« CRZGG01 ») en code d'extension et numéro.
 * Le découpage est ambigu (« CRZG|G01 » ou « CRZ|GG01 ») : on retient
 * la première longueur dont le préfixe est un code d'extension connu.
 */
export function splitSuffix(suffix, knownCodes) {
  if (!suffix) return { setCode: null, number: null };

  for (let len = 4; len >= 2; len--) {
    const code = suffix.slice(0, len);
    const rest = suffix.slice(len);
    if (rest && knownCodes?.[code]) {
      return { setCode: code, number: rest };
    }
  }

  // Aucun code connu : on retombe sur un découpage lettres / chiffres.
  const fallback = suffix.match(/^([A-Z]{2,4})([A-Z]*\d+)$/);
  return fallback
    ? { setCode: fallback[1], number: fallback[2] }
    : { setCode: null, number: null };
}

/**
 * Retrouve l'extension d'un produit scellé à partir de son nom.
 * On teste le préfixe le plus long d'abord : « Mega Evolution Booster Box »
 * échoue, puis « Mega Evolution Booster », puis « Mega Evolution » qui existe.
 */
export function findSetForProduct(productName, nameMap) {
  if (!productName || !nameMap) return null;

  const words = productName.trim().split(/\s+/);
  for (let len = words.length; len >= 1; len--) {
    const key = words.slice(0, len).join(" ").toLowerCase();
    if (nameMap[key]) return { setName: key, ids: nameMap[key] };
  }

  return null;
}

/** Logo officiel d'une extension, servant d'illustration par défaut. */
export function setLogoUrl(setId) {
  return setId ? `https://images.pokemontcg.io/${setId}/logo.png` : null;
}

/**
 * Traduit la catégorie de produit Cardmarket (segment d'URL) vers nos types de scellés.
 * Ex. « Booster-Boxes » -> « Display ».
 */
export function mapProductKindToType(kind = "") {
  const k = kind.toLowerCase();

  if (k.includes("elite-trainer")) return "ETB";
  if (k.includes("booster-box") || k.includes("display")) return "Display";
  if (k.includes("booster") || k.includes("blister")) return "Booster";
  if (k.includes("bundle")) return "Bundle";
  if (
    k.includes("tin") ||
    k.includes("box") ||
    k.includes("collection") ||
    k.includes("deck")
  ) {
    return "Coffret";
  }

  return "Autre";
}

/**
 * Traduit la rareté / les sous-types de l'API Pokémon TCG vers nos catégories.
 * Les arts spéciaux priment sur le sous-type (un Alt Art reste un Alt Art).
 */
export function mapRarityToCategory(rarity = "", subtypes = []) {
  const r = (rarity || "").toLowerCase();
  const subs = (subtypes || [])
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  // Libellés français (TCGdex) et anglais, les arts spéciaux primant sur le suffixe.
  if (r.includes("promo")) return "Promo";
  if (r.includes("illustration spéciale") || r.includes("special illustration")) {
    return "Alt Art";
  }
  if (r.includes("illustration")) return "Rare";
  if (r.includes("arc-en-ciel") || r.includes("rainbow")) return "Rainbow";
  if (r.includes("secrète") || r.includes("secret") || r.includes("hyper")) {
    return "Gold";
  }

  if (subs.includes("vmax")) return "VMAX";
  if (subs.includes("vstar")) return "VSTAR";
  if (subs.includes("v")) return "V";
  if (subs.includes("ex")) return "EX";
  if (subs.includes("gx")) return "GX";

  if (r.includes("ultra")) return "Full Art";

  return "";
}

/**
 * Choisit le prix de référence le plus pertinent parmi ceux exposés par l'API.
 * `trendPrice` est l'indicateur standard de Cardmarket.
 */
export function pickSuggestedPrice(cardmarket) {
  const prices = cardmarket?.prices;
  if (!prices) return null;

  const candidates = [
    { key: "trendPrice", label: "Tendance Cardmarket" },
    { key: "averageSellPrice", label: "Prix de vente moyen" },
    { key: "avg7", label: "Moyenne 7 jours" },
    { key: "lowPriceExPlus", label: "Prix bas (Excellent+)" },
  ];

  for (const { key, label } of candidates) {
    const value = prices[key];
    if (typeof value === "number" && value > 0) {
      return { price: value, label, key, updatedAt: cardmarket.updatedAt || null };
    }
  }

  return null;
}
