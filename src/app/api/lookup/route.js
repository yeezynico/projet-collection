import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  parseCardmarketUrl,
  splitSuffix,
  mapRarityToCategory,
  mapProductKindToType,
  frenchSealedName,
} from "@/lib/cardmarket";
import {
  SET_CODE_TO_IDS,
  SET_NAME_TO_IDS,
  SET_EN_TO_FR,
} from "@/lib/pokemonSets";
import { findSealedProduct } from "@/lib/tcgcsv";
import { usdToEur } from "@/lib/currency";

// TCGdex fournit les données en français et des prix Cardmarket quotidiens.
const API_BASE = "https://api.tcgdex.net/v2/fr";

/** Petite tolérance aux erreurs réseau transitoires. */
async function apiGet(path, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        next: { revalidate: 3600 },
      });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch {
      // on retente
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

function findSetIds({ setCode, setName }) {
  if (setCode && SET_CODE_TO_IDS[setCode]) return SET_CODE_TO_IDS[setCode];
  if (setName && SET_NAME_TO_IDS[setName.toLowerCase()]) {
    return SET_NAME_TO_IDS[setName.toLowerCase()];
  }
  return [];
}

/** Prix de référence, en privilégiant la tendance Cardmarket. */
function pickPrice(pricing) {
  const cm = pricing?.cardmarket;
  if (!cm) return null;

  const candidates = [
    ["trend", "Tendance Cardmarket"],
    ["avg7", "Moyenne 7 jours"],
    ["avg", "Prix moyen"],
    ["low", "Prix le plus bas"],
  ];

  for (const [key, label] of candidates) {
    const value = cm[key];
    if (typeof value === "number" && value > 0) {
      return { price: value, label, updatedAt: cm.updated || null };
    }
  }
  return null;
}

function serializeCard(card, rawUrl) {
  const price = pickPrice(card.pricing);
  return {
    id: card.id,
    // Identifiant reutilisable pour actualiser le prix plus tard.
    externalId: card.id,
    name: card.name,
    extension: card.set?.name || null,
    number: card.localId,
    category: mapRarityToCategory(card.rarity, [card.suffix, card.stage]),
    rarity: card.rarity || null,
    imageUrl: card.image ? `${card.image}/high.png` : null,
    cardmarketUrl: rawUrl,
    suggestedPrice: price?.price ?? null,
    priceSource: price?.label ?? null,
    priceUpdatedAt: price?.updatedAt ? price.updatedAt.slice(0, 10) : null,
  };
}

/** Recherche par numéro (précis), puis par nom si le lien n'en donne pas. */
async function findCards(setIds, { number, cardName }) {
  if (number) {
    // Selon les extensions, TCGdex conserve ou non les zéros initiaux
    // (« sv04-038 » mais « sv10-230 ») : on essaie les deux écritures.
    const variants = [...new Set([number, number.replace(/^0+/, "")])].filter(Boolean);

    for (const setId of setIds) {
      for (const variant of variants) {
        const card = await apiGet(`/cards/${setId}-${variant}`);
        if (card?.id) return [card];
      }
    }
  }

  if (!cardName) return [];

  // Le nom du lien Cardmarket est en anglais : on compare sur les numéros
  // du set, en récupérant la fiche complète des candidats plausibles.
  const found = [];
  for (const setId of setIds) {
    const set = await apiGet(`/sets/${setId}`);
    if (!set?.cards) continue;

    const needle = cardName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matches = set.cards.filter((c) => {
      const n = (c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return n.includes(needle) || needle.includes(n);
    });

    for (const m of matches.slice(0, 12)) {
      const full = await apiGet(`/cards/${m.id}`);
      if (full?.id) found.push(full);
    }
  }

  return found.sort(
    (a, b) => (parseInt(b.localId, 10) || 0) - (parseInt(a.localId, 10) || 0)
  );
}


/**
 * Illustration de repli : le logo de l'extension, quand le produit lui-même
 * n'est pas au catalogue TCGplayer (sorties très récentes notamment).
 */
async function setLogoFor(productName) {
  const words = productName.trim().split(/\s+/);

  for (let len = words.length; len >= 1; len--) {
    const englishKey = words.slice(0, len).join(" ").toLowerCase();
    const french = SET_EN_TO_FR[englishKey];
    const ids = french
      ? SET_NAME_TO_IDS[french.toLowerCase()]
      : SET_NAME_TO_IDS[englishKey];

    if (!ids?.length) continue;

    const set = await apiGet(`/sets/${ids[0]}`);
    if (set?.logo) return `${set.logo}.png`;
  }

  return null;
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    const parsed = parseCardmarketUrl(rawUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Lien Cardmarket non reconnu" },
        { status: 400 }
      );
    }

    // Les produits scellés viennent du catalogue TCGplayer, la base de
    // cartes ne les référençant pas.
    if (!parsed.isSingle) {
      const type = mapProductKindToType(parsed.kind);

      let product = null;
      try {
        product = await findSealedProduct(parsed.productName);
      } catch (e) {
        console.error("Sealed product lookup failed:", e);
      }

      // Le catalogue TCGplayer est anglophone : on rétablit le français,
      // qui sert aussi de requête sur eBay et Vinted.
      const name = frenchSealedName(
        product?.name || parsed.productName,
        type,
        SET_EN_TO_FR
      );

      // Produit absent du catalogue : à défaut de photo, le logo de
      // l'extension vaut mieux qu'un cadre vide.
      const imageUrl =
        product?.imageUrl || (await setLogoFor(parsed.productName));

      // Aucune cotation Cardmarket n'est accessible pour les scellés :
      // on convertit le prix TCGplayer, en l'annonçant clairement comme indicatif.
      let suggestedPrice = null;
      let priceSource = null;
      let priceUpdatedAt = null;

      if (product?.priceUsd) {
        const converted = await usdToEur(product.priceUsd);
        if (converted) {
          suggestedPrice = Math.round(converted.value * 100) / 100;
          priceSource = "TCGplayer US converti (indicatif)";
          priceUpdatedAt = converted.date;
        }
      }

      let message;
      if (product && suggestedPrice != null) {
        message = `« ${name} » identifié, photo récupérée et prix indicatif de ${suggestedPrice.toFixed(2)} € — converti du marché américain, à vérifier sur Cardmarket.`;
      } else if (product) {
        message = `« ${name} » identifié, photo récupérée. Prix à saisir manuellement.`;
      } else if (imageUrl) {
        message = `« ${name} » identifié. Produit absent du catalogue : logo de l'extension proposé, photo et prix à compléter.`;
      } else {
        message = `« ${name} » identifié. Photo et prix à compléter manuellement.`;
      }

      return NextResponse.json({
        kind: "sealed",
        name,
        externalId:
          product?.groupId && product?.productId
            ? `${product.groupId}:${product.productId}`
            : null,
        type,
        imageUrl,
        cardmarketUrl: parsed.href,
        suggestedPrice,
        priceSource,
        priceUpdatedAt,
        partial: true,
        message,
      });
    }

    const { setCode, number: rawNumber } = splitSuffix(parsed.suffix, SET_CODE_TO_IDS);

    if (!rawNumber && !parsed.cardName) {
      return NextResponse.json(
        { error: "Impossible d'identifier la carte depuis ce lien" },
        { status: 422 }
      );
    }

    const setIds = findSetIds({ setCode, setName: parsed.setName });
    if (setIds.length === 0) {
      return NextResponse.json(
        {
          error: `Extension « ${setCode || parsed.setName} » introuvable. Saisie manuelle nécessaire.`,
        },
        { status: 404 }
      );
    }

    const cards = await findCards(setIds, {
      number: rawNumber,
      cardName: parsed.cardName,
    });

    if (cards.length === 0) {
      return NextResponse.json(
        {
          error: `« ${parsed.cardName || rawNumber} » introuvable dans ${parsed.setName}, ou service momentanément indisponible. Réessayez ou saisissez manuellement.`,
        },
        { status: 404 }
      );
    }

    const results = cards.map((c) => serializeCard(c, parsed.href));

    // On renvoie toujours les candidats : avec un seul résultat cela permet
    // d'afficher l'aperçu, avec plusieurs de choisir la bonne version.
    return NextResponse.json({
      kind: "card",
      multiple: results.length > 1,
      candidates: results.slice(0, 12),
      ...results[0],
    });
  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données" },
      { status: 500 }
    );
  }
}
