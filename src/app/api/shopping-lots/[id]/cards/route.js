import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Ajoute une carte suivie à un lot (les deux doivent appartenir à l'utilisateur). */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const cardId = data.cardId;
    if (!cardId) {
      return NextResponse.json({ error: "cardId requis" }, { status: 400 });
    }

    const [lot, card] = await Promise.all([
      prisma.shoppingLot.findFirst({ where: { id, userId: session.user.id } }),
      prisma.watchedCard.findFirst({ where: { id: cardId, userId: session.user.id } }),
    ]);
    if (!lot || !card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.shoppingLot.update({
      where: { id },
      data: { cards: { connect: { id: cardId } } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shopping lot add card error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
