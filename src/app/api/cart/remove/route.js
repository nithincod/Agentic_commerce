import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import {
  requireBuyer,
  requireOwnedCart,
} from "@/lib/auth/authorization";

export async function DELETE(request) {
  try {
    const session = await requireBuyer();
    const body = await request.json();
    const cartId = body?.cartId?.trim();
    const cartItemId = body?.cartItemId?.trim();

    if (!cartId || !cartItemId) {
      return NextResponse.json(
        { success: false, error: "cartId and cartItemId are required" },
        { status: 400 }
      );
    }

    await requireOwnedCart(cartId, session.user.id);

    const result = await prisma.cartItem.deleteMany({
      where: {
        id: cartItemId,
        cartId,
      },
    });

    if (result.count !== 1) {
      return NextResponse.json(
        { success: false, error: "Cart item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove cart API error:", error);

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
                : error.message || "Unable to remove cart item",
      },
      { status }
    );
  }
}
