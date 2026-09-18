import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "recent";

    let where = { userId: session.user.id };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    // "custom" respecte l'ordre glissé-déposé à la main (sortOrder), les
    // produits jamais déplacés restant départagés par date d'ajout.
    let orderBy = [{ sortOrder: "asc" }, { createdAt: "desc" }];
    if (sort === "recent") orderBy = { createdAt: "desc" };
    if (sort === "name-asc") orderBy = { name: "asc" };
    if (sort === "name-desc") orderBy = { name: "desc" };
    if (sort === "price-asc") orderBy = { purchasePrice: "asc" };
    if (sort === "price-desc") orderBy = { purchasePrice: "desc" };

    const sealed = await prisma.sealedProduct.findMany({
      where,
      orderBy,
    });

    return NextResponse.json(sealed);
  } catch (error) {
    console.error("Sealed GET error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

        const sealed = await prisma.sealedProduct.create({
      data: {
        userId: session.user.id,
        externalId: data.externalId || null,
        name: data.name,
        type: data.type,
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
        // Valeur très négative : le produit ajouté apparaît en tête de
        // l'ordre personnalisé, comme il le faisait déjà en tri "récent".
        sortOrder: -Date.now(),
      },
    });

    return NextResponse.json(sealed, { status: 201 });
  } catch (error) {
    console.error("Sealed POST error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
