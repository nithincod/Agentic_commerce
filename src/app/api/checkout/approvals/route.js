import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import { requireBuyer } from "@/lib/auth/authorization";

export async function GET() {
  try {
    const session = await requireBuyer();

    const checkouts = await prisma.checkout.findMany({
      where: {
        status: "AWAITING_APPROVAL",
        cart: {
          userId: session.user.id,
        },
      },
      include: {
        cart: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      approvals: checkouts.map((checkout) => ({
        id: checkout.id,
        amount: checkout.amount,
        currency: checkout.currency,
        status: checkout.status,
        policy: checkout.policy,
        createdAt: checkout.createdAt,
        items: checkout.cart.items.map((item) => ({
          productId: item.productId,
          name: item.product?.name || "Unknown product",
          quantity: item.quantity,
          price: item.product?.price || 0,
        })),
      })),
    });
  } catch (error) {
    console.error("Approval list API error:", error);

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
          status === 401
            ? "Authentication required"
            : status === 403
              ? "Buyer access required"
              : "Unable to load approvals",
      },
      { status }
    );
  }
}
