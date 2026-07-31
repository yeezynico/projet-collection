import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cards = await prisma.card.findMany({
      where: { userId: session.user.id },
    });

    const sealed = await prisma.sealedProduct.findMany({
      where: { userId: session.user.id },
    });

    const sales = await prisma.sale.findMany({
      where: { userId: session.user.id },
    });

    const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);
    const totalSealed = sealed.reduce((sum, s) => sum + s.quantity, 0);
    const totalItems = totalCards + totalSealed;

    const totalInvested = cards.reduce(
      (sum, card) => sum + card.purchasePrice * card.quantity,
      0
    ) +
      sealed.reduce(
        (sum, s) => sum + s.purchasePrice * s.quantity,
        0
      );

    const currentValue = cards.reduce(
      (sum, card) => sum + (card.currentPrice || card.purchasePrice) * card.quantity,
      0
    ) +
      sealed.reduce(
        (sum, s) => sum + (s.currentPrice || s.purchasePrice) * s.quantity,
        0
      );

    const potentialGain = currentValue - totalInvested;
    const potentialPercentage =
      totalInvested > 0 ? (potentialGain / totalInvested) * 100 : 0;

    const totalRealized = sales.reduce((sum, sale) => sum + sale.gain, 0);
    const totalSalePrice = sales.reduce(
      (sum, sale) => sum + sale.salePrice * sale.quantity,
      0
    );
    const totalSaleCost = sales.reduce(
      (sum, sale) => sum + sale.purchasePrice * sale.quantity,
      0
    );
    const realizedPercentage =
      totalSaleCost > 0 ? (totalRealized / totalSaleCost) * 100 : 0;

    return NextResponse.json({
      totalCards,
      totalSealed,
      totalItems,
      totalInvested,
      currentValue,
      potentialGain,
      potentialPercentage,
      totalRealized,
      realizedPercentage,
      totalSales: sales.length,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
