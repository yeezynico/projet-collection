import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  parseCardmarketUrl,
  mapRarityToCategory,
  pickSuggestedPrice,
} from "@/lib/cardmarket";
import { SET_CODE_TO_IDS } from "@/lib/pokemonSets";

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
  // La table statique évite un aller-retour sur une API souvent en erreur.
  if (setCode && SET_CODE_TO_IDS[setCode]) {
    return SET_CODE_TO_IDS[setCode];
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

async function findCard(setIds, number) {
  for (const setId of setIds) {
    const query = `set.id:${setId} number:${number}`;
    const data = await apiGet(`/cards?q=${encodeURIComponent(query)}&pageSize=10`);
    const cards = data?.data || [];
    if (cards.length > 0) return cards;
  }
  return [];
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
      return NextResponse.json({
        kind: "sealed",
        name: parsed.productName,
        cardmarketUrl: rawUrl,
        partial: true,
        message:
          "Produit scellé : seul le nom a pu être déduit du lien, complétez le reste manuellement.",
      });
    }

    if (!parsed.setCode || !parsed.number) {
      return NextResponse.json(
        { error: "Impossible d'extraire l'extension et le numéro depuis ce lien" },
        { status: 422 }
      );
    }

    const setIds = await findSetIds(parsed);
    if (setIds.length === 0) {
      return NextResponse.json(
        { error: `Extension « ${parsed.setCode} » introuvable. Saisie manuelle nécessaire.` },
        { status: 404 }
      );
    }

    // Les numéros de l'API n'ont pas de zéro initial (PAR038 -> 38).
    const number = parsed.number.replace(/^0+/, "") || parsed.number;
    const cards = await findCard(setIds, number);

    if (cards.length === 0) {
      return NextResponse.json(
        {
          error: `Carte ${parsed.setCode} n°${number} introuvable, ou service momentanément indisponible. Réessayez ou saisissez manuellement.`,
        },
        { status: 404 }
      );
    }

    const card = cards[0];
    const suggested = pickSuggestedPrice(card.cardmarket);

    return NextResponse.json({
      kind: "card",
      name: card.name,
      extension: card.set?.name || parsed.setName,
      number: card.number,
      category: mapRarityToCategory(card.rarity, card.subtypes),
      rarity: card.rarity || null,
      imageUrl: card.images?.large || card.images?.small || null,
      cardmarketUrl: rawUrl,
      suggestedPrice: suggested?.price ?? null,
      priceSource: suggested?.label ?? null,
      priceUpdatedAt: suggested?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données" },
      { status: 500 }
    );
  }
}
