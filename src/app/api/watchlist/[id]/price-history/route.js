import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listPriceHistory } from "@/lib/priceHistory";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
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

    const history = await listPriceHistory("watched", id);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Watchlist price-history GET error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
