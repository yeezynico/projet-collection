import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const name = (data.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }

    const existing = await prisma.shoppingLot.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const lot = await prisma.shoppingLot.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(lot);
  } catch (error) {
    console.error("Shopping lot PUT error:", error);
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

    const { count } = await prisma.shoppingLot.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shopping lot DELETE error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
