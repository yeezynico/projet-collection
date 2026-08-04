import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  parseCardmarketUrl,
  splitSuffix,
  mapRarityToCategory,
  mapProductKindToType,
  findSetForProduct,
  setLogoUrl,
  pickSuggestedPrice,
} from "@/lib/cardmarket";
import { SET_CODE_TO_IDS, SET_NAME_TO_IDS } from "@/lib/pokemonSets";
import { findSealedProduct } from "@/lib/tcgcsv";

const API_BASE = "https://api.pokemontcg.io/v2";

function apiHeaders() {
  const headers = { Accept: "application/json" };
  // Clé optionnelle : sans elle l'API reste utilisable mais plus limitée.
  if (process.env.POKEMONTCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  return headers;
}

/**
 * L'API publique renvoie fréquemment des 500/502 transitoires :
 * on réessaie quelques fois avant d'abandonner.
 */
async function apiGet(path, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: apiHeaders(),
        next: { revalidate: 3600 },
      });
      if (res.ok) return await res.json();
    } catch {
      // réseau indisponible : on retente
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

async function findSetIds({ setCode, setName }) {
  // Les tables statiques évitent des allers-retours sur une API souvent en erreur.
  if (setCode && SET_CODE_TO_IDS[setCode]) {
    return SET_CODE_TO_IDS[setCode];
  }
  if (setName && SET_NAME_TO_IDS[setName.toLowerCase()]) {
    return SET_NAME_TO_IDS[setName.toLowerCase()];
  }

  const ids = [];

  if (setCode) {
    const data = await apiGet(`/sets?q=${encodeURIComponent(`ptcgoCode:${setCode}`)}`);
    for (const set of data?.data || []) ids.push(set.id);
  }

  if (ids.length === 0 && setName) {
    const data = await apiGet(`/sets?q=${encodeURIComponent(`name:"${setName}"`)}`);
    for (const set of data?.data || []) ids.push(set.id);
  }

  return ids;
}

/** Recherche par numéro (précis) puis, à défaut, par nom (peut renvoyer plusieurs cartes). */
async function findCards(setIds, { number, cardName }) {
  for (const setId of setIds) {
    if (number) {
      const data = await apiGet(
        `/cards?q=${encodeURIComponent(`set.id:${setId} number:${number}`)}&pageSize=10`
      );
      if (data?.data?.length) return data.data;
    }
  }

  if (!cardName) return [];

  const results = [];
  for (const setId of setIds) {
    const data = await apiGet(
      `/cards?q=${encodeURIComponent(`set.id:${setId} name:"${cardName}"`)}&pageSize=25`
    );
    if (data?.data?.length) results.push(...data.data);
  }

  // Les variantes rares (alt art, secrètes) portent les numéros les plus élevés :
  // on les remonte en premier, ce sont celles que l'on cherche le plus souvent.
  return results.sort(
    (a, b) => (parseInt(b.number, 10) || 0) - (parseInt(a.number, 10) || 0)
  );
}

function serializeCard(card, rawUrl) {
  const suggested = pickSuggestedPrice(card.cardmarket);
  return {
    id: card.id,
    name: card.name,
    extension: card.set?.name || null,
    number: card.number,
    category: mapRarityToCategory(card.rarity, card.subtypes),
    rarity: card.rarity || null,
    imageUrl: card.images?.large || card.images?.small || null,
    cardmarketUrl: rawUrl,
    suggestedPrice: suggested?.price ?? null,
    priceSource: suggested?.label ?? null,
    priceUpdatedAt: suggested?.updatedAt ?? null,
  };
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

    // Les produits scellés ne sont pas référencés par l'API Pokémon TCG :
    // on renvoie ce que l'URL contient déjà.
    if (!parsed.isSingle) {
      const type = mapProductKindToType(parsed.kind);

      // Les scellés ne sont pas dans la base de cartes Pokémon TCG :
      // on récupère la photo produit depuis le catalogue TCGplayer.
      let product = null;
      try {
        product = await findSealedProduct(parsed.productName);
      } catch (e) {
        console.error("Sealed product lookup failed:", e);
      }

      // Repli : le logo de l'extension, à défaut de photo du produit.
      const set = product ? null : findSetForProduct(parsed.productName, SET_NAME_TO_IDS);
      const imageUrl = product?.imageUrl || (set ? setLogoUrl(set.ids[0]) : null);

      let message;
      if (product) {
        message = `« ${product.name} » identifié comme ${type}, photo récupérée. Prix à saisir manuellement.`;
      } else if (imageUrl) {
        message = `Identifié comme « ${type} ». Photo du produit introuvable, logo de l'extension proposé à la place.`;
      } else {
        message = `Identifié comme « ${type} ». Photo et prix à compléter manuellement.`;
      }

      return NextResponse.json({
        kind: "sealed",
        name: product?.name || parsed.productName,
        type,
        imageUrl,
        cardmarketUrl: rawUrl,
        partial: true,
        message,
      });
    }

    // Le découpage du suffixe est levé grâce à la table des codes connus.
    const { setCode, number: rawNumber } = splitSuffix(parsed.suffix, SET_CODE_TO_IDS);

    // Sans numéro ni nom exploitable, on ne peut rien chercher.
    if (!rawNumber && !parsed.cardName) {
      return NextResponse.json(
        { error: "Impossible d'identifier la carte depuis ce lien" },
        { status: 422 }
      );
    }

    const setIds = await findSetIds({ setCode, setName: parsed.setName });
    if (setIds.length === 0) {
      return NextResponse.json(
        {
          error: `Extension « ${setCode || parsed.setName} » introuvable. Saisie manuelle nécessaire.`,
        },
        { status: 404 }
      );
    }

    // Les numéros de l'API n'ont pas de zéro initial (PAR038 -> 38).
    const number = rawNumber
      ? rawNumber.replace(/^0+/, "") || rawNumber
      : null;

    const cards = await findCards(setIds, { number, cardName: parsed.cardName });

    if (cards.length === 0) {
      return NextResponse.json(
        {
          error: `« ${parsed.cardName || rawNumber} » introuvable dans ${parsed.setName}, ou service momentanément indisponible. Réessayez ou saisissez manuellement.`,
        },
        { status: 404 }
      );
    }

    const results = cards.map((c) => serializeCard(c, rawUrl));

    // On renvoie toujours les candidats : avec un seul résultat cela permet
    // d'afficher l'aperçu de la carte récupérée, avec plusieurs de choisir.
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
