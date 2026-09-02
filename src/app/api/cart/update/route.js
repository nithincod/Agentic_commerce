import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import {
  requireBuyer,
  requireOwnedCart,
} from "@/lib/auth/authorization";

export async function PATCH(request) {
  try {
    const session = await requireBuyer();
    const body = await request.json();
    const cartId = body?.cartId?.trim();
    const cartItemId = body?.cartItemId?.trim();
    const quantity = body?.quantity;

    if (!cartId || !cartItemId) {
      return NextResponse.json(
        { success: false, error: "cartId and cartItemId are required" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json(
        { success: false, error: "quantity must be at least 1" },
        { status: 400 }
      );
    }

    await requireOwnedCart(cartId, session.user.id);

    const item = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId,
      },
      include: { product: true },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Cart item not found" },
        { status: 404 }
      );
    }

    if (!item.product?.active) {
      return NextResponse.json(
        { success: false, error: "Product is not available" },
        { status: 409 }
      );
    }

    if (quantity > item.product.inventory) {
      return NextResponse.json(
        {
          success: false,
          error: `Only ${item.product.inventory} units are available`,
        },
        { status: 409 }
      );
    }

    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update cart API error:", error);

    const status =
      error.message === "UNAUTHENTICATED"
        ? 401
        : error.message === "FORBIDDEN"
          ? 403
          : error.message === "RESOURCE_NOT_FOUND"
            ? 404
            : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          status === 401
            ? "Authentication required"
            : status === 403
              ? "Buyer access required"
              : status === 404
                ? "Cart not found"
                : error.message || "Unable to update cart",
      },
      { status }
    );
  }
}
