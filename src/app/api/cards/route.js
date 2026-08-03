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

    let orderBy = { createdAt: "desc" };
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
      },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Cards POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création" },
      { status: 500 }
    );
  }
}
