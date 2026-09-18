import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Carte suivie appartenant bien à la personne connectée. */
async function own(id, userId) {
  return prisma.watchedCard.findFirst({ where: { id, userId } });
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await own(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await req.json();

    const updated = await prisma.watchedCard.update({
      where: { id },
      data: {
        externalId: data.externalId || null,
        name: data.name,
        extension: data.extension || null,
        number: data.number || null,
        category: data.category || null,
        language: data.language || null,
        condition: data.condition || null,
        quantity: parseInt(data.quantity) || 1,
        currentPrice:
          data.currentPrice === "" || data.currentPrice == null
            ? null
            : parseFloat(data.currentPrice),
        priceSource: data.priceSource || null,
        priceUpdatedAt: data.priceUpdatedAt
          ? new Date(data.priceUpdatedAt)
          : null,
        imageUrl: data.imageUrl || null,
        cardmarketUrl: data.cardmarketUrl || null,
        notes: data.notes || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Watchlist PUT error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

/**
 * Modifications ponctuelles d'une carte suivie : sa position dans l'ordre
 * personnalisé (glisser-déposer) et/ou sa présence dans le panier simulé.
 */
export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const update = {};

    if (data.sortOrder !== undefined) {
      if (typeof data.sortOrder !== "number" || !Number.isFinite(data.sortOrder)) {
        return NextResponse.json({ error: "sortOrder invalide" }, { status: 400 });
      }
      update.sortOrder = data.sortOrder;
    }

    if (data.inBasket !== undefined) {
      if (typeof data.inBasket !== "boolean") {
        return NextResponse.json({ error: "inBasket invalide" }, { status: 400 });
      }
      update.inBasket = data.inBasket;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
    }

    const { count } = await prisma.watchedCard.updateMany({
      where: { id, userId: session.user.id },
      data: update,
    });

    if (count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Watchlist PATCH error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { count } = await prisma.watchedCard.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Watchlist DELETE error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
