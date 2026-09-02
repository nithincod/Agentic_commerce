import crypto from "crypto";

import prisma from "@/lib/db/prisma";

export function createPaymentIdempotencyKey(
  checkoutId,
  attempt
) {
  return crypto
    .createHash("sha256")
    .update(
      `${checkoutId}:payment-attempt:${attempt}`
    )
    .digest("hex");
}

export async function findPaymentIntent(
  checkoutId,
  attempt
) {
  const idempotencyKey =
    createPaymentIdempotencyKey(
      checkoutId,
      attempt
    );

  return prisma.payment.findUnique({
    where: {
      idempotencyKey,
    },
  });
}

export async function findLatestPaymentAttempt(
  checkoutId
) {
  return prisma.payment.findFirst({
    where: {
      checkoutId,
    },

    orderBy: {
      attempt: "desc",
    },
  });
}