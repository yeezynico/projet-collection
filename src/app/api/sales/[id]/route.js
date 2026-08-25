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

    const quantity = parseInt(data.quantity) || 1;
    const purchasePrice = parseFloat(data.purchasePrice);
    const salePrice = parseFloat(data.salePrice);

    const gain = salePrice * quantity - purchasePrice * quantity;
    const percentage =
      purchasePrice > 0 ? (gain / (purchasePrice * quantity)) * 100 : null;

    const existing = await prisma.sale.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.sale.update({
      where: { id },
      data: {
        quantity,
        purchasePrice,
        salePrice,
        gain,
        percentage,
        // Les ventes enregistrées avant l'ajout de ces champs peuvent être
        // complétées ; une clé absente laisse la valeur en place.
        language: data.language === undefined ? undefined : data.language || null,
        condition: data.condition === undefined ? undefined : data.condition || null,
        saleDate: data.saleDate ? new Date(data.saleDate) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Sale PUT error:", error);
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

    const { count } = await prisma.sale.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sale DELETE error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
