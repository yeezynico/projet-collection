import { prisma } from "@/lib/prisma";

function breakdown(items) {
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const invested = items.reduce((sum, i) => sum + i.purchasePrice * i.quantity, 0);
  const value = items.reduce(
    (sum, i) => sum + (i.currentPrice ?? i.purchasePrice) * i.quantity,
    0
  );
  const gain = value - invested;
  const gainPercentage = invested > 0 ? (gain / invested) * 100 : null;

  return { count, invested, value, gain, gainPercentage };
}

export async function getStats(userId) {
  const [cards, sealed, sales] = await Promise.all([
    prisma.card.findMany({ where: { userId } }),
    prisma.sealedProduct.findMany({ where: { userId } }),
    prisma.sale.findMany({ where: { userId } }),
  ]);

  const cardsStats = breakdown(cards);
  const sealedStats = breakdown(sealed);

  const totalItems = cardsStats.count + sealedStats.count;
  const totalInvested = cardsStats.invested + sealedStats.invested;
  const currentValue = cardsStats.value + sealedStats.value;
  const potentialGain = currentValue - totalInvested;
  const potentialPercentage =
    totalInvested > 0 ? (potentialGain / totalInvested) * 100 : null;

  const totalRealized = sales.reduce((sum, sale) => sum + sale.gain, 0);
  const totalSaleCost = sales.reduce(
    (sum, sale) => sum + sale.purchasePrice * sale.quantity,
    0
  );
  const realizedPercentage =
    totalSaleCost > 0 ? (totalRealized / totalSaleCost) * 100 : null;

  return {
    totalCards: cardsStats.count,
    totalSealed: sealedStats.count,
    totalItems,
    totalInvested,
    currentValue,
    potentialGain,
    potentialPercentage,
    totalRealized,
    realizedPercentage,
    totalSales: sales.length,
    cards: cardsStats,
    sealed: sealedStats,
  };
}
