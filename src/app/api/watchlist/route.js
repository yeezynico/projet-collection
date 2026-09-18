import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Champs modifiables d'une carte suivie, sans prix ni date d'achat. */
function payload(data) {
  return {
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
    priceUpdatedAt: data.priceUpdatedAt ? new Date(data.priceUpdatedAt) : null,
    imageUrl: data.imageUrl || null,
    cardmarketUrl: data.cardmarketUrl || null,
    notes: data.notes || null,
  };
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "recent";

    const where = { userId: session.user.id };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    // Le tri par prix porte sur la cote suivie : c'est le seul montant
    // qu'une carte non achetée possède.
    // "custom" respecte l'ordre glissé-déposé à la main (sortOrder), les
    // cartes jamais déplacées restant départagées par date d'ajout.
    let orderBy = [{ sortOrder: "asc" }, { createdAt: "desc" }];
    if (sort === "recent") orderBy = { createdAt: "desc" };
    if (sort === "name-asc") orderBy = { name: "asc" };
    if (sort === "name-desc") orderBy = { name: "desc" };
    if (sort === "price-asc") orderBy = { currentPrice: "asc" };
    if (sort === "price-desc") orderBy = { currentPrice: "desc" };

    const watched = await prisma.watchedCard.findMany({ where, orderBy });

    return NextResponse.json(watched);
  } catch (error) {
    console.error("Watchlist GET error:", error);
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

    const created = await prisma.watchedCard.create({
      data: {
        userId: session.user.id,
        ...payload(data),
        // Valeur très négative : la carte ajoutée apparaît en tête de
        // l'ordre personnalisé, comme elle le faisait déjà en tri "récent".
        sortOrder: -Date.now(),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Watchlist POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    );
  }
}
