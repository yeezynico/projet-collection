import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  apiGet,
  fetchSetIndex,
  fetchDigitalSetIds,
  fetchEnglishNames,
  setIdOf,
  setCodeFor,
} from "@/lib/tcgdex";
import {
  fetchCardImageIndex,
  normalizeCardNumber,
  findImageByName,
} from "@/lib/tcgcsv";

// Au-delà, la grille devient illisible et la recherche perd son intérêt :
// mieux vaut inviter à préciser le nom.
const MAX_RESULTS = 60;

// Chaque extension à compléter coûte le téléchargement d'un catalogue de
// plusieurs mégaoctets. Trois suffisent à couvrir les premières lignes de la
// grille, celles que l'œil parcourt d'abord.
const MAX_IMAGE_FALLBACK_SETS = 3;

// Les vignettes sont un agrément, pas le résultat : passé ce délai on rend
// la grille telle quelle plutôt que de faire attendre davantage.
const IMAGE_BUDGET = 6000;

/**
 * Récupère les illustrations que TCGdex n'a pas encore publiées.
 * C'est le cas de séries entières à leur sortie — précisément celles qui
 * arrivent en tête des résultats.
 */
async function fillMissingImages(results) {
  const bySet = new Map();

  for (const card of results) {
    if (card.imageUrl) continue;
    const setId = setIdOf(card.id);
    if (!setId) continue;
    if (!bySet.has(setId)) bySet.set(setId, []);
    bySet.get(setId).push(card);
  }
  if (!bySet.size) return;

  const targets = [...bySet.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_IMAGE_FALLBACK_SETS);

  const work = Promise.all(
    targets.map(async ([setId, cards]) => {
      try {
        const index = await fetchCardImageIndex(setId, {
          setCode: setCodeFor(setId),
        });
        if (!index) return;

        let englishNames = null;

        for (const card of cards) {
          const byNumber = index.byNumber.get(normalizeCardNumber(card.number));
          if (byNumber) {
            card.imageUrl = byNumber;
            continue;
          }

          // Rééditions : les numéros divergent, seul le nom anglais relie
          // les deux catalogues.
          if (!englishNames) {
            englishNames = await fetchEnglishNames(setId).catch(() => new Map());
          }

          const english = englishNames.get(card.id);
          card.imageUrl = (english && findImageByName(index, english)) || null;
        }
      } catch (e) {
        console.error(`Image fallback failed for ${setId}:`, e);
      }
    })
  );

  // Les cartes déjà complétées le restent : la course n'annule rien, elle
  // cesse seulement d'attendre.
  await Promise.race([
    work,
    new Promise((resolve) => setTimeout(resolve, IMAGE_BUDGET)),
  ]);
}

/**
 * Recherche de cartes par nom, en français.
 *
 * Renvoie de quoi remplir une grille de choix — photo, nom, extension,
 * numéro — sans le détail de la carte : celui-ci n'est chargé qu'une fois
 * la carte choisie, ce qui évite une requête par résultat.
 */
export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = (new URL(req.url).searchParams.get("q") || "").trim();

    if (query.length < 2) {
      return NextResponse.json({ results: [], truncated: false });
    }

    const [cards, setIndex, digitalSets] = await Promise.all([
      apiGet(`/cards?name=like:${encodeURIComponent(query)}`),
      fetchSetIndex(),
      fetchDigitalSetIds(),
    ]);

    if (!Array.isArray(cards)) {
      return NextResponse.json(
        { error: "Service de recherche momentanément indisponible" },
        { status: 503 }
      );
    }

    // Les sorties récentes d'abord : ce sont celles qu'on cherche le plus
    // souvent, et l'ordre brut de l'API n'a aucune utilité pour l'œil.
    const results = cards
      .filter((card) => !digitalSets.has(setIdOf(card.id)))
      .map((card) => {
        const setId = setIdOf(card.id);
        const set = setIndex.get(setId);
        return {
          id: card.id,
          name: card.name,
          number: card.localId,
          setName: set?.name || setId,
          order: set?.order ?? -1,
          // La recherche renvoie l'illustration sans définition ni extension.
          imageUrl: card.image ? `${card.image}/high.png` : null,
        };
      })
      .sort((a, b) => b.order - a.order)
      .slice(0, MAX_RESULTS)
      .map(({ order, ...card }) => card);

    await fillMissingImages(results);

    // Le total annoncé exclut les cartes écartées : compter des résultats
    // que l'on n'affiche pas induirait en erreur.
    const matched = cards.filter((c) => !digitalSets.has(setIdOf(c.id))).length;

    return NextResponse.json({
      results,
      truncated: matched > MAX_RESULTS,
      total: matched,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Erreur lors de la recherche" }, { status: 500 });
  }
}
