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

    const { sale, remainingQuantity } = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          userId: session.user.id,
          itemType: data.itemType,
          itemCategory: data.itemCategory || null,
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

      let remaining = null;

      if (data.cardId) {
        const card = await tx.card.findFirst({
          where: { id: data.cardId, userId: session.user.id },
        });
        if (card) {
          if (quantity >= card.quantity) {
            await tx.card.delete({ where: { id: card.id } });
            remaining = 0;
          } else {
            remaining = card.quantity - quantity;
            await tx.card.update({
              where: { id: card.id },
              data: { quantity: remaining },
            });
          }
        }
      } else if (data.sealedId) {
        const sealedItem = await tx.sealedProduct.findFirst({
          where: { id: data.sealedId, userId: session.user.id },
        });
        if (sealedItem) {
          if (quantity >= sealedItem.quantity) {
            await tx.sealedProduct.delete({ where: { id: sealedItem.id } });
            remaining = 0;
          } else {
            remaining = sealedItem.quantity - quantity;
            await tx.sealedProduct.update({
              where: { id: sealedItem.id },
              data: { quantity: remaining },
            });
          }
        }
      }

      return { sale: created, remainingQuantity: remaining };
    });

    return NextResponse.json({ ...sale, remainingQuantity }, { status: 201 });
  } catch (error) {
    console.error("Sales POST error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
