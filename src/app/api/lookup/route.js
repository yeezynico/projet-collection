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
import {
  findSealedProduct,
  fetchCardImageIndex,
  normalizeCardNumber,
  findImageByName,
} from "@/lib/tcgcsv";
import { usdToEur } from "@/lib/currency";
import {
  apiGet,
  setIdOf,
  setCodeFor,
  fetchEnglishNames,
} from "@/lib/tcgdex";
import {
  resolveCardmarketUrl,
  buildCardmarketUrl,
} from "@/lib/cardmarketLink";


function findSetIds({ setCode, setName }) {
  if (setCode && SET_CODE_TO_IDS[setCode]) return SET_CODE_TO_IDS[setCode];
  if (!setName) return [];

  const key = setName.toLowerCase();
  if (SET_NAME_TO_IDS[key]) return SET_NAME_TO_IDS[key];

  // Quelques extensions — Célébrations en tête — ont une adresse Cardmarket
  // dépourvue de code : « /Singles/Celebrations/Lugia ». Le nom anglais du
  // lien est alors le seul repère, et la table est indexée en français.
  const french = SET_EN_TO_FR[key];
  return (french && SET_NAME_TO_IDS[french.toLowerCase()]) || [];
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

  // Le nom du lien Cardmarket est en anglais : on interroge donc les deux
  // langues. « Charizard » ne ressemble en rien à « Dracaufeu », et sans le
  // catalogue anglais aucun rapprochement ne serait possible.
  const found = [];
  const needle = cardName.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const setId of setIds) {
    const [fr, en] = await Promise.all([
      apiGet(`/sets/${setId}`),
      apiGet(`/sets/${setId}`, { locale: "en" }),
    ]);

    const catalogue = [...(fr?.cards || []), ...(en?.cards || [])];
    if (!catalogue.length) continue;

    const seen = new Set();
    const matches = catalogue.filter((c) => {
      const n = (c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!n.includes(needle) && !needle.includes(n)) return false;
      // Les deux catalogues partagent les identifiants : on ne retient
      // chaque carte qu'une fois, quelle que soit la langue qui l'a trouvée.
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
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

/**
 * Complète les fiches dépourvues d'illustration.
 * TCGdex publie parfois la carte avant son visuel : le catalogue TCGplayer
 * prend alors le relais.
 */
async function fillMissingImages(results, { setId, setCode, setName }) {
  if (!results.some((r) => !r.imageUrl)) return;

  let index = null;
  try {
    index = await fetchCardImageIndex(setId, { setCode, setName });
  } catch (e) {
    console.error("Card image fallback failed:", e);
  }
  if (!index) return;

  // Le rapprochement par nom exige la forme anglaise, seule comparable au
  // catalogue TCGplayer : on ne la charge que si le numéro a échoué.
  let englishNames = null;

  for (const result of results) {
    if (result.imageUrl) continue;

    const byNumber =
      result.number && index.byNumber.get(normalizeCardNumber(result.number));
    if (byNumber) {
      result.imageUrl = byNumber;
      continue;
    }

    if (!englishNames && setId) {
      englishNames = await fetchEnglishNames(setId).catch(() => new Map());
    }

    const english = englishNames?.get(result.id);
    result.imageUrl = (english && findImageByName(index, english)) || null;
  }
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get("id");
    const rawUrl = searchParams.get("url");

    // Carte choisie dans la recherche intégrée : elle est déjà identifiée,
    // il ne reste qu'à charger sa fiche complète.
    if (cardId) {
      const card = await apiGet(`/cards/${encodeURIComponent(cardId)}`);

      if (!card?.id) {
        return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
      }

      const result = serializeCard(card, null);

      // Photo et lien Cardmarket sont indépendants : on les cherche ensemble.
      const [, known] = await Promise.all([
        fillMissingImages([result], {
          setId: setIdOf(card.id),
          setCode: setCodeFor(setIdOf(card.id)),
          setName: card.set?.name,
        }),
        resolveCardmarketUrl(card.id, card.localId),
      ]);

      // Sans correspondance connue, l'adresse est composée à partir des noms
      // anglais. Elle est juste dans la plupart des cas et l'alternative est
      // de n'avoir aucun lien — mais elle est annoncée comme approximative.
      let cardmarketUrl = known;
      let cardmarketUrlGuessed = false;

      if (!cardmarketUrl) {
        const en = await apiGet(`/cards/${encodeURIComponent(cardId)}`, {
          locale: "en",
        });

        if (en?.name) {
          // Les cartes de l'extension servent à situer les homonymes, dont
          // dépend le marqueur de variante.
          const enSet = await apiGet(`/sets/${en.set?.id}`, { locale: "en" });

          cardmarketUrl = buildCardmarketUrl({
            cardName: en.name,
            setName: en.set?.name,
            setId: en.set?.id,
            localId: en.localId,
            setCards: enSet?.cards,
          });
          cardmarketUrlGuessed = Boolean(cardmarketUrl);
        }
      }

      return NextResponse.json({
        kind: "card",
        multiple: false,
        ...result,
        cardmarketUrl,
        cardmarketUrlGuessed,
      });
    }

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

    await fillMissingImages(results, {
      setId: setIdOf(cards[0]?.id),
      setCode,
      setName: parsed.setName,
    });

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
