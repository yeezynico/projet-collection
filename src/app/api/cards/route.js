import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { upsertPricePoint } from "@/lib/priceHistory";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "custom";

    let where = { userId: session.user.id };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    // "custom" respecte l'ordre glissé-déposé à la main (sortOrder), les
    // cartes jamais déplacées restant départagées par date d'ajout.
    let orderBy = [{ sortOrder: "asc" }, { createdAt: "desc" }];
    if (sort === "recent") orderBy = { createdAt: "desc" };
    if (sort === "name-asc") orderBy = { name: "asc" };
    if (sort === "name-desc") orderBy = { name: "desc" };
    if (sort === "price-asc") orderBy = { purchasePrice: "asc" };
    if (sort === "price-desc") orderBy = { purchasePrice: "desc" };

    const cards = await prisma.card.findMany({
      where,
      orderBy,
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error("Cards GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

        const card = await prisma.card.create({
      data: {
        userId: session.user.id,
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
          data.currentPrice !== undefined && data.currentPrice !== null
            ? parseFloat(data.currentPrice)
            : parseFloat(data.purchasePrice),
        imageUrl: data.imageUrl,
        cardmarketUrl: data.cardmarketUrl,
        purchaseDate: new Date(data.purchaseDate),
        // Valeur très négative : la carte ajoutée apparaît en tête de
        // l'ordre personnalisé, comme elle le faisait déjà en tri "récent".
        sortOrder: -Date.now(),
      },
    });

    // Premier point de la courbe d'évolution : le prix à l'entrée dans la
    // collection, daté du jour d'achat.
    if (card.currentPrice != null) {
      await upsertPricePoint("card", card.id, card.currentPrice, card.purchaseDate);
    }

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Cards POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    );
  }
}
