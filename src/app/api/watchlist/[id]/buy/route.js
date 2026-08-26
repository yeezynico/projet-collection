import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Fait passer une carte suivie dans la collection.
 *
 * La carte quitte la liste de suivi : elle est désormais possédée, la suivre
 * n'a plus d'objet. La quantité achetée est indépendante de celle qui était
 * surveillée — on peut n'en suivre qu'une et en acheter dix.
 *
 * Les deux écritures forment une transaction : sans elle, un incident entre
 * les deux laisserait la carte à la fois suivie et possédée, ou perdue.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const watched = await prisma.watchedCard.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!watched) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await req.json();
    const quantity = Math.max(parseInt(data.quantity) || 1, 1);
    const purchasePrice = parseFloat(data.purchasePrice) || 0;

    // Le prix suivi devient l'estimation de la carte acquise, à défaut de
    // valeur saisie : c'est la cotation la plus récente dont on dispose.
    const currentPrice =
      data.currentPrice === "" || data.currentPrice == null
        ? (watched.currentPrice ?? purchasePrice)
        : parseFloat(data.currentPrice);

    const card = await prisma.$transaction(async (tx) => {
      const created = await tx.card.create({
        data: {
          userId: session.user.id,
          externalId: watched.externalId,
          name: watched.name,
          extension: watched.extension,
          number: watched.number,
          category: watched.category,
          language: watched.language,
          condition: watched.condition,
          quantity,
          purchasePrice,
          currentPrice,
          priceSource: watched.priceSource,
          priceUpdatedAt: watched.priceUpdatedAt,
          imageUrl: watched.imageUrl,
          cardmarketUrl: watched.cardmarketUrl,
          purchaseDate: data.purchaseDate
            ? new Date(data.purchaseDate)
            : new Date(),
        },
      });

      await tx.watchedCard.delete({ where: { id } });

      return created;
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Watchlist buy error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout à la collection" },
      { status: 500 }
    );
  }
}
