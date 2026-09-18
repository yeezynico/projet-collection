import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Retire une carte d'un lot, sans toucher à la carte suivie elle-même. */
export async function DELETE(req, { params }) {
  try {
    const { id, cardId } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lot = await prisma.shoppingLot.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!lot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.shoppingLot.update({
      where: { id },
      data: { cards: { disconnect: { id: cardId } } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shopping lot remove card error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
