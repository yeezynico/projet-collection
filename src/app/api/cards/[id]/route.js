import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { upsertPricePoint } from "@/lib/priceHistory";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const card = await prisma.card.findUnique({
      where: { id },
    });

    if (!card || card.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error("Card GET error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const card = await prisma.card.findUnique({
      where: { id },
    });

    if (!card || card.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await req.json();

        const updated = await prisma.card.update({
      where: { id },
      data: {
        externalId: data.externalId || null,
        name: data.name,
        extension: data.extension,
        number: data.number || null,
        category: data.category,
        language: data.language || null,
        condition: data.condition || null,
        priceSource: data.priceSource || null,
        priceUpdatedAt: data.priceUpdatedAt ? new Date(data.priceUpdatedAt) : null,
        quantity: parseInt(data.quantity) || 1,
        purchasePrice: parseFloat(data.purchasePrice),
        currentPrice:
          data.currentPrice !== undefined &&
          data.currentPrice !== null &&
          data.currentPrice !== ""
            ? parseFloat(data.currentPrice)
            : parseFloat(data.purchasePrice),
        imageUrl: data.imageUrl,
        cardmarketUrl: data.cardmarketUrl,
        purchaseDate: data.purchaseDate
          ? new Date(data.purchaseDate)
          : undefined,
      },
    });

    // La date accompagnant le prix ouvre (ou met à jour) un point dans la
    // courbe d'évolution ; `currentPrice` est ensuite resynchronisé sur le
    // point le plus récent, qui n'est pas forcément celui qu'on vient de
    // saisir si la date entrée est dans le passé.
    if (data.priceDate && updated.currentPrice != null) {
      const latest = await upsertPricePoint(
        "card",
        id,
        updated.currentPrice,
        data.priceDate
      );
      updated.currentPrice = latest.price;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Card PUT error:", error);
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

    const { count } = await prisma.card.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Card DELETE error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
