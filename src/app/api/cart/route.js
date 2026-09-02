import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import { requireBuyer } from "@/lib/auth/authorization";

export async function GET() {
  try {
    const session = await requireBuyer();

    const cart = await prisma.cart.findFirst({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!cart) {
      return NextResponse.json({
        success: true,
        cart: null,
      });
    }

    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            description: item.product.description,
            category: item.product.category,
            price: item.product.price,
            currency: item.product.currency,
            inventory: item.product.inventory,
            active: item.product.active,
          }
        : null,
      subtotal: item.product
        ? item.product.price * item.quantity
        : 0,
    }));

    return NextResponse.json({
      success: true,
      cart: {
        id: cart.id,
        status: cart.status,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
        items,
        itemCount: items.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
        subtotal: items.reduce(
          (sum, item) => sum + item.subtotal,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Get cart API error:", error);

    const status =
      error.message === "UNAUTHENTICATED"
        ? 401
        : error.message === "FORBIDDEN"
          ? 403
          : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          error.message === "UNAUTHENTICATED"
            ? "Authentication required"
            : error.message === "FORBIDDEN"
              ? "Buyer access required"
              : "Unable to load cart",
      },
      { status }
    );
  }
}
