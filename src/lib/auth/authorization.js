import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";

export async function requireSession() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }

  return session;
}

/*
 * Buyer-capable means:
 * BUYER or MERCHANT.
 *
 * A merchant can still shop and purchase.
 */
export async function requireBuyer() {
  const session = await requireSession();

  if (
    !["BUYER", "MERCHANT"].includes(
      session.user.role
    )
  ) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

/*
 * Exact-role check for places that genuinely
 * require one specific role.
 */
export async function requireRole(role) {
  const session = await requireSession();

  if (session.user.role !== role) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

export async function requireOwnedCart(
  cartId,
  userId
) {
  const cart =
    await prisma.cart.findFirst({
      where: {
        id: cartId,
        userId,
      },
    });

  if (!cart) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  return cart;
}

export async function requireOwnedCheckout(
  checkoutId,
  userId
) {
  const checkout =
    await prisma.checkout.findFirst({
      where: {
        id: checkoutId,
        cart: {
          userId,
        },
      },
    });

  if (!checkout) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  return checkout;
}

export async function requireOwnedPayment(
  paymentId,
  userId
) {
  const payment =
    await prisma.payment.findFirst({
      where: {
        id: paymentId,
        checkout: {
          cart: {
            userId,
          },
        },
      },
    });

  if (!payment) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  return payment;
}