import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  fetchGroups,
  fetchProducts,
  fetchPrices,
  cleanGroupName,
  highResImage,
} from "@/lib/tcgcsv";
import { frenchSealedName } from "@/lib/cardmarket";
import { SET_EN_TO_FR } from "@/lib/pokemonSets";
import { POKEMON_EN_TO_FR } from "@/lib/pokemonNames";
import { usdToEur } from "@/lib/currency";

const MAX_RESULTS = 200;

// Sans extension précisée, on parcourt tout le catalogue depuis l'apparition
// des ETB (2014). Les anciens groupes republiés récemment (POP Series,
// promos…) faussent la date de publication : se limiter aux « N derniers »
// en écartait des extensions entières.
const SCAN_SINCE = Date.parse("2014-01-01");

// Requêtes simultanées vers TCGCSV : chaque liste est mise en cache 24 h,
// seule la toute première recherche paie le parcours complet.
const CONCURRENCY = 16;

// Groupes fourre-tout (coffrets hors extension, Pokémon Center…).
const CATCH_ALL_GROUPS = ["miscellaneous cards & products"];

function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Vocabulaire des collectionneurs -> type de produit. Les expressions les
 * plus longues d'abord, pour que « booster box » l'emporte sur « booster ».
 */
const TYPE_ALIASES = [
  ["coffret dresseur d elite", "ETB"],
  ["elite trainer box", "ETB"],
  ["elite trainer", "ETB"],
  ["etb", "ETB"],
  ["booster box", "Display"],
  ["display", "Display"],
  ["booster bundle", "Bundle"],
  ["bundle", "Bundle"],
  ["booster", "Booster"],
  ["blister", "Booster"],
  ["coffret", "Coffret"],
  ["tin", "Coffret"],
  ["pokebox", "Coffret"],
];

/** Vrai si les deux mots diffèrent d'au plus une lettre (ajout, retrait, faute). */
function oneEditAway(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Alias d'un seul mot assez longs pour tolérer une faute de frappe
// (« etgb », « disply ») sans capter des mots ordinaires.
const FUZZY_TYPE_WORDS = TYPE_ALIASES.filter(
  ([alias]) => !alias.includes(" ") && alias.length >= 3 && alias !== "tin"
);

/** Exécute `fn` sur chaque élément, `limit` à la fois. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Type de scellé d'un produit du catalogue, d'après son nom anglais. */
function sealedTypeOf(name) {
  const n = normalize(name);
  if (n.includes("elite trainer box")) return "ETB";
  if (/\bbooster box\b/.test(n) || n.includes("display")) return "Display";
  if (n.includes("bundle") && !n.includes("art bundle")) return "Bundle";
  if (/\b(booster pack|blister|sleeved booster|art bundle)\b/.test(n)) return "Booster";
  return "Coffret";
}

/** Noms d'extension, français et anglais (normalisés) -> nom anglais. */
const SET_ALIASES = (() => {
  const map = new Map();
  for (const [en, fr] of Object.entries(SET_EN_TO_FR)) {
    map.set(normalize(en), normalize(en));
    map.set(normalize(fr), normalize(en));
  }
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
})();

const SET_FR_BY_EN = new Map(
  Object.entries(SET_EN_TO_FR).map(([en, fr]) => [normalize(en), fr])
);

/**
 * Nom français de l'extension d'un groupe du catalogue. Les anciens groupes
 * portent un préfixe de série (« XY - Evolutions », « SM - Ultra Prism ») ou
 * un suffixe (« Sword & Shield Base Set ») absents de la table.
 */
function frenchSetName(group) {
  const clean = cleanGroupName(group.name);
  const key = normalize(clean);
  // « XY Base Set » doit donner « XY », jamais le « Set de Base » de 1999 :
  // le suffixe se retire avant le préfixe de série.
  const unsuffixed = key.replace(/ base set$/, "");
  const candidates = [
    key,
    unsuffixed,
    unsuffixed === key ? key.replace(/^(xy|sm|swsh|sv|bw|dp|hgss|me) /, "") : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const french = SET_FR_BY_EN.get(candidate);
    if (french) return french;
  }
  return clean.replace(/ Base Set$/, "");
}

const POKEMON_FR_TO_EN = (() => {
  const map = new Map();
  for (const [en, fr] of Object.entries(POKEMON_EN_TO_FR)) {
    map.set(normalize(fr), normalize(en));
  }
  return map;
})();

/** Retire une expression entière de la requête, si elle y figure. */
function extract(query, phrase) {
  const padded = ` ${query} `;
  const needle = ` ${phrase} `;
  if (!padded.includes(needle)) return null;
  return padded.replace(needle, " ").trim();
}

/**
 * Découpe la requête en type de produit, extension et mots libres :
 * « etb règne delta » -> { type: "ETB", set: "delta reign", words: [] }.
 */
function parseQuery(raw) {
  let query = normalize(raw);
  let type = null;
  let set = null;

  for (const [alias, value] of TYPE_ALIASES) {
    const rest = extract(query, alias);
    if (rest !== null) {
      type = value;
      query = rest;
      break;
    }
  }

  if (!type) {
    const words = query.split(" ");
    for (const [alias, value] of FUZZY_TYPE_WORDS) {
      const index = words.findIndex((w) => w.length >= 3 && oneEditAway(w, alias));
      if (index !== -1) {
        type = value;
        words.splice(index, 1);
        query = words.join(" ");
        break;
      }
    }
  }

  for (const [alias, english] of SET_ALIASES) {
    const rest = extract(query, alias);
    if (rest !== null) {
      set = english;
      query = rest;
      break;
    }
  }

  // Les mots restants sont cherchés dans le nom anglais du catalogue : un
  // nom de Pokémon français est traduit (« dracaufeu » -> « charizard »).
  const words = query
    .split(" ")
    .filter(Boolean)
    .map((w) => POKEMON_FR_TO_EN.get(w) || w);

  return { type, set, words };
}

const CARDMARKET_BASE = "https://www.cardmarket.com/fr/Pokemon/Products";

/** « Delta Reign Elite Trainer Box » -> « Delta-Reign-Elite-Trainer-Box ». */
function cardmarketSlug(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.:&,!]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Lien Cardmarket d'un produit du catalogue TCGplayer.
 *
 * Cardmarket refuse toute requête automatique : l'adresse ne peut pas être
 * vérifiée, seulement déduite. Pour les ETB et displays d'une extension, le
 * modèle est sûr — il reprend le nom anglais : « Elite-Trainer-Boxes/
 * Delta-Reign-Elite-Trainer-Box », et pour une variante illustrée
 * « Mega-Evolution-Mega-Lucario-Elite-Trainer-Box ». Pour le reste (Pokémon
 * Center, coffrets, bundles…) on renvoie vers la recherche Cardmarket plutôt
 * que vers une fiche peut-être inexistante.
 */
function cardmarketUrlFor(englishName) {
  const etb = englishName.match(/^([^[\]()]+?) Elite Trainer Box(?: \[([^\]]+)\])?$/);
  if (etb) {
    const name = [etb[1], etb[2], "Elite Trainer Box"].filter(Boolean).join(" ");
    return `${CARDMARKET_BASE}/Elite-Trainer-Boxes/${cardmarketSlug(name)}`;
  }

  const display = englishName.match(/^([^[\]()]+?) Booster Box$/);
  if (display && !/\bhalf$/i.test(display[1])) {
    return `${CARDMARKET_BASE}/Booster-Boxes/${cardmarketSlug(englishName)}`;
  }

  const query = englishName.replace(/[[\]()]/g, " ").replace(/\s+/g, " ").trim();
  return `${CARDMARKET_BASE}/Search?searchString=${encodeURIComponent(query)}`;
}

/** Un produit scellé, et non une carte, une carte-code ou un carton. */
function isSealedProduct(product, wantsCase) {
  if (/^code card\b/i.test(product.name)) return false;
  if ((product.extendedData || []).some((e) => e.name === "Number")) return false;
  if (!wantsCase && /\bcase\b/i.test(product.name)) return false;
  return true;
}

function publishedTime(group) {
  const t = Date.parse(group.publishedOn || "");
  return Number.isFinite(t) ? t : 0;
}

/** Prix indicatif d'un produit, converti en euros. */
async function priceFor(groupId, productId) {
  const prices = await fetchPrices(groupId);
  const match = prices.filter((p) => p.productId === productId);
  const value = match
    .map((p) => p.marketPrice ?? p.midPrice ?? p.lowPrice)
    .find((v) => typeof v === "number" && v > 0);
  if (!value) return null;

  const converted = await usdToEur(value);
  if (!converted) return null;
  return {
    suggestedPrice: Math.round(converted.value * 100) / 100,
    priceSource: "TCGplayer US converti (indicatif)",
    priceUpdatedAt: converted.date,
  };
}

/**
 * Recherche de produits scellés dans le catalogue TCGplayer.
 *
 * `?q=etb` liste les ETB des dernières extensions, `?q=display règne delta`
 * le display d'une extension précise. `?product=groupe:produit` renvoie le
 * prix indicatif du produit choisi, chargé seulement à ce moment-là.
 */
export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = new URL(req.url).searchParams;

    const picked = params.get("product");
    if (picked) {
      const [groupId, productId] = picked.split(":").map(Number);
      if (!groupId || !productId) {
        return NextResponse.json({ error: "Produit invalide" }, { status: 400 });
      }
      const price = await priceFor(groupId, productId).catch(() => null);
      return NextResponse.json(price || {});
    }

    const raw = (params.get("q") || "").trim();
    if (raw.length < 2) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const { type, set, words } = parseQuery(raw);
    const wantsCase = words.includes("case");

    const groups = (await fetchGroups()).sort(
      (a, b) => publishedTime(b) - publishedTime(a)
    );

    let targets;
    if (set) {
      targets = groups.filter((g) => {
        const clean = normalize(cleanGroupName(g.name));
        return clean === set || clean.startsWith(`${set} `);
      });
    } else {
      targets = groups.filter((g) => publishedTime(g) >= SCAN_SINCE);
    }
    for (const g of groups) {
      if (CATCH_ALL_GROUPS.includes(g.name.toLowerCase()) && !targets.includes(g)) {
        targets.push(g);
      }
    }

    const lists = await mapLimit(targets, CONCURRENCY, (g) =>
      fetchProducts(g.groupId)
        .then((products) => ({ group: g, products }))
        .catch(() => ({ group: g, products: [] }))
    );

    const matches = [];
    for (const { group, products } of lists) {
      for (const product of products) {
        if (!isSealedProduct(product, wantsCase)) continue;

        const productType = sealedTypeOf(product.name);
        if (type && productType !== type) continue;

        // Les mots libres sont cherchés dans le nom anglais comme dans le
        // nom français : « etb prismatiques » doit trouver l'ETB
        // « Prismatic Evolutions ».
        const frenchName = frenchSealedName(product.name, productType, SET_EN_TO_FR);
        const haystack = `${normalize(product.name)} ${normalize(frenchName)}`;
        if (!words.every((w) => haystack.includes(w))) continue;

        // Le fourre-tout ne sert qu'aux recherches précises : sans mot
        // libre, il noierait les résultats sous des centaines de produits.
        if (CATCH_ALL_GROUPS.includes(group.name.toLowerCase()) && !words.length) continue;

        matches.push({
          id: `${group.groupId}:${product.productId}`,
          name: frenchName,
          englishName: product.name,
          cardmarketUrl: cardmarketUrlFor(product.name),
          type: productType,
          setName: CATCH_ALL_GROUPS.includes(group.name.toLowerCase())
            ? "Hors extension"
            : frenchSetName(group),
          imageUrl: highResImage(product.imageUrl),
        });
      }
    }

    return NextResponse.json({
      results: matches.slice(0, MAX_RESULTS),
      total: matches.length,
    });
  } catch (error) {
    console.error("Sealed search error:", error);
    return NextResponse.json(
      { error: "Recherche momentanément indisponible" },
      { status: 500 }
    );
  }
}
