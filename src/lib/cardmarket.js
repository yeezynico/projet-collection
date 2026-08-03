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

  const match = slug.match(/([A-Z]{2,4})(\d+)$/);

  return {
    isSingle: kind === "Singles",
    kind,
    slug,
    setName: setSlug.replace(/-/g, " "),
    productName: slug.replace(/-/g, " "),
    setCode: match ? match[1] : null,
    number: match ? match[2] : null,
  };
}

/**
 * Traduit la rareté / les sous-types de l'API Pokémon TCG vers nos catégories.
 * Les arts spéciaux priment sur le sous-type (un Alt Art reste un Alt Art).
 */
export function mapRarityToCategory(rarity = "", subtypes = []) {
  const r = (rarity || "").toLowerCase();
  const subs = (subtypes || []).map((s) => s.toLowerCase());

  if (r.includes("promo")) return "Promo";
  if (r.includes("special illustration")) return "Alt Art";
  if (r.includes("illustration")) return "Rare";
  if (r.includes("rainbow")) return "Rainbow";
  if (r.includes("secret") || r.includes("hyper")) return "Gold";

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
