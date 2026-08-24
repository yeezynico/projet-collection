import { LANGUAGES, CONDITIONS } from "@/lib/categories";
import { POKEMON_EN_TO_FR } from "@/lib/pokemonNames";

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
 * Analyse une URL en tolérant l'absence de protocole : un lien copié
 * depuis la barre d'adresse arrive souvent sous la forme
 * « cardmarket.com/fr/... », que `new URL()` refuse.
 */
function toUrl(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/**
 * Construit l'URL Cardmarket pré-filtrée (pays vendeur / langue / état minimum).
 * Les paramètres existants de l'URL d'origine sont remplacés.
 */
export function buildFilteredUrl(baseUrl, filters = DEFAULT_CM_FILTERS) {
  const url = toUrl(baseUrl);
  if (!url) return null;

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
  const url = toUrl(rawUrl);
  if (!url) return null;

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
    // URL complète : le lien collé peut être dépourvu de protocole.
    href: url.toString(),
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


/**
 * Vocabulaire produit courant. Le nom d'une extension est traduit par la
 * table officielle, mais les qualificatifs qui l'entourent restent anglais :
 * ce glossaire les rend au français, du plus long au plus court pour que
 * « Premium Collection » l'emporte sur « Collection » seul.
 */
const PRODUCT_GLOSSARY = [
  [/\bFirst Partner Illustration Collection\b/gi, "Collection Illustration Premiers Partenaires"],
  [/\bFirst Partner\b/gi, "Premiers Partenaires"],
  [/\bPok[eé] ?Ball Tin\b/gi, "Pokébox"],
  [/\bPremium Figure Collection\b/gi, "Collection Figurine Premium"],
  [/\bSpecial Illustration Collection\b/gi, "Collection Illustration Spéciale"],
  [/\bIllustration Collection\b/gi, "Collection Illustration"],
  [/\bPremium Collection\b/gi, "Collection Premium"],
  [/\bSpecial Collection\b/gi, "Collection Spéciale"],
  [/\bBuild ?&? ?Battle Stadium\b/gi, "Stade de Tournoi"],
  [/\bBuild ?&? ?Battle Box\b/gi, "Kit de Tournoi"],
  [/\bEnhanced Booster Box\b/gi, "Display Renforcé"],
  [/\bHalf Booster Box\b/gi, "Demi-Display"],
  [/\bSleeved Booster\b/gi, "Booster sous Blister"],
  [/\bCheck ?lane\b/gi, "Blister Caisse"],
  [/\bMini Tin\b/gi, "Mini Pokébox"],
  [/\bGift Box\b/gi, "Coffret Cadeau"],
  [/\bBinder Collection\b/gi, "Collection Classeur"],
  [/\bPin Collection\b/gi, "Collection Pin's"],
  [/\bFigure Collection\b/gi, "Collection Figurine"],
  [/\bSeries\b/gi, "Série"],
  [/\bDeck\b/gi, "Deck"],
];

/**
 * Mots décrivant le conditionnement : le type les remplace déjà.
 * Frontières explicites plutôt que \b, une lettre accentuée n'étant pas
 * un caractère de mot — « Pokébox » se ferait sinon amputer de sa fin.
 */
const PACKAGING_WORDS =
  /(^|\s)(Booster Box|Elite Trainer Box|Booster Bundle|Booster Pack|Booster|Bundle|Box|Tin|Display)(?=\s|$)/gi;

/** Glossaire, noms de Pokémon, puis retrait du conditionnement. */
function translateVocabulary(text) {
  let out = text;
  for (const [pattern, french] of PRODUCT_GLOSSARY) out = out.replace(pattern, french);

  // Un nom de Pokémon isolé : « Mega Charizard Y ex » -> « Mega Dracaufeu Y ex »
  out = out.replace(/[A-Za-z][A-Za-z'.\u2019-]+/g, (word) =>
    POKEMON_EN_TO_FR[word] ?? word
  );

  return out.replace(PACKAGING_WORDS, "$1").replace(/\s+/g, " ").trim();
}

/**
 * Compose le nom français d'un produit scellé.
 *
 * Le catalogue TCGplayer ne fournit que de l'anglais (« Mega Evolution
 * Booster Box ») : on isole l'extension pour la traduire, et on la préfixe
 * du type dans la forme usuelle des collectionneurs francophones
 * (« Display Méga-Évolution »).
 */
export function frenchSealedName(productName, type, enToFr) {
  if (!productName) return productName;

  // « Scarlet Violet » dans une URL désigne « Scarlet & Violet » au catalogue.
  const normalize = (t) =>
    t.toLowerCase().replace(/\s*&\s*/g, " ").replace(/\s+/g, " ").trim();

  const enToFrNormalized = {};
  for (const [en, fr] of Object.entries(enToFr || {})) {
    enToFrNormalized[normalize(en)] = fr;
  }

  const words = productName.trim().split(/\s+/);

  // Préfixe le plus long qui corresponde à une extension connue
  for (let len = words.length; len >= 1; len--) {
    const french = enToFrNormalized[normalize(words.slice(0, len).join(" "))];
    if (!french) continue;

    // Le glossaire agit avant le nettoyage : sans cela, retirer « Collection »
    // empêcherait de reconnaître « Premium Figure Collection ».
    const variant = translateVocabulary(words.slice(len).join(" "))
      .replace(/\s+/g, " ")
      .trim();

    return [type, french, variant].filter(Boolean).join(" ");
  }

  // Produit hors extension identifiable : on traduit au moins le vocabulaire,
  // le nom propre restant en l'état faute de source française.
  const translated = translateVocabulary(productName);

  // Préfixer « Coffret » devant « Collection… » serait redondant.
  const alreadyTyped =
    /^(coffret|collection|pokébox|mini pokébox|kit|stade|display|booster|bundle|etb|blister)\b/i.test(
      translated
    );

  return type && !alreadyTyped ? `${type} ${translated}` : translated;
}
