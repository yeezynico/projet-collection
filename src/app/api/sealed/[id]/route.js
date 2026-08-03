import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sealed = await prisma.sealedProduct.findUnique({
      where: { id },
    });

    if (!sealed || sealed.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(sealed);
  } catch (error) {
    console.error("Sealed GET error:", error);
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

    const sealed = await prisma.sealedProduct.findUnique({
      where: { id },
    });

    if (!sealed || sealed.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await req.json();

    const updated = await prisma.sealedProduct.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Sealed PUT error:", error);
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

    const { count } = await prisma.sealedProduct.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sealed DELETE error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
