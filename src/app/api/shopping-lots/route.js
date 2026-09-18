import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const cardSelect = {
  id: true,
  name: true,
  extension: true,
  number: true,
  imageUrl: true,
  currentPrice: true,
  quantity: true,
};

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lots = await prisma.shoppingLot.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { cards: { select: cardSelect } },
    });

    return NextResponse.json(lots);
  } catch (error) {
    console.error("Shopping lots GET error:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const name = (data.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }

    const lot = await prisma.shoppingLot.create({
      data: { userId: session.user.id, name },
      include: { cards: { select: cardSelect } },
    });

    return NextResponse.json(lot, { status: 201 });
  } catch (error) {
    console.error("Shopping lots POST error:", error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}
