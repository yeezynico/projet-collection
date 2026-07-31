import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sales = await prisma.sale.findMany({
      where: { userId: session.user.id },
      orderBy: { saleDate: "desc" },
    });

    return NextResponse.json(sales);
  } catch (error) {
    console.error("Sales GET error:", error);
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

    const purchasePrice = parseFloat(data.purchasePrice);
    const salePrice = parseFloat(data.salePrice);
    const quantity = parseInt(data.quantity) || 1;

    const gain = salePrice * quantity - purchasePrice * quantity;
    const percentage =
      purchasePrice > 0 ? (gain / (purchasePrice * quantity)) * 100 : null;

    const sale = await prisma.sale.create({
      data: {
        userId: session.user.id,
        itemType: data.itemType,
        itemName: data.itemName,
        quantity,
        purchasePrice,
        salePrice,
        gain,
        percentage,
        imageUrl: data.imageUrl,
        saleDate: new Date(data.saleDate),
      },
    });

    if (data.cardId) {
      await prisma.card.delete({
        where: { id: data.cardId },
      });
    } else if (data.sealedId) {
      await prisma.sealedProduct.delete({
        where: { id: data.sealedId },
      });
    }

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("Sales POST error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
