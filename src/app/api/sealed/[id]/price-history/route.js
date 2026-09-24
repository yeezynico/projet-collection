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

    const sealed = await prisma.sealedProduct.findUnique({ where: { id } });
    if (!sealed || sealed.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const history = await listPriceHistory("sealed", id);
    return NextResponse.json(history);
  } catch (error) {
    console.error("Sealed price-history GET error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
