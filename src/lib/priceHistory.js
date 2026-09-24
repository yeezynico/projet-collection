import { prisma } from "@/lib/prisma";

/**
 * Historique des prix : partagé entre cartes, produits scellés et cartes
 * suivies via trois colonnes optionnelles (`cardId`/`sealedId`/`watchedId`)
 * plutôt qu'une vraie relation polymorphe, que Prisma ne modélise pas.
 */
const FIELD = { card: "cardId", sealed: "sealedId", watched: "watchedId" };
const MODEL = { card: "card", sealed: "sealedProduct", watched: "watchedCard" };

/** Ramène une date à minuit UTC : seul le jour compte pour l'historique. */
export function toDateOnly(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Ajoute un point de prix à une date donnée, ou met à jour le point déjà
 * présent à cette même date (un seul point par jour et par article : évite
 * d'empiler des lignes si le prix est corrigé plusieurs fois le même jour).
 *
 * `currentPrice` sur l'article est ensuite resynchronisé sur le point le
 * plus récent de l'historique, pas forcément celui qu'on vient d'écrire :
 * saisir une date passée ne doit pas écraser une cote plus récente.
 */
export async function upsertPricePoint(type, itemId, price, date) {
  const field = FIELD[type];
  const day = toDateOnly(date);

  await prisma.priceHistory.upsert({
    where: { [`${field}_date`]: { [field]: itemId, date: day } },
    create: { [field]: itemId, price, date: day },
    update: { price },
  });

  const latest = await prisma.priceHistory.findFirst({
    where: { [field]: itemId },
    orderBy: { date: "desc" },
  });

  await prisma[MODEL[type]].update({
    where: { id: itemId },
    data: { currentPrice: latest.price },
  });

  return latest;
}

export async function listPriceHistory(type, itemId) {
  const field = FIELD[type];
  return prisma.priceHistory.findMany({
    where: { [field]: itemId },
    orderBy: { date: "asc" },
  });
}
