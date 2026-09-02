import prisma from "@/lib/db/prisma";

/**
 * Get the authenticated buyer's total PAID spending
 * for the current calendar day.
 *
 * The userId is supplied by the server from Auth.js.
 * It is never taken from the LLM or request body.
 */
export async function getDailySpent(userId) {
  if (!userId) {
    throw new Error(
      "userId is required to calculate daily spending"
    );
  }

  const now = new Date();

  /*
   * Current calendar day boundaries in the server's
   * configured timezone.
   *
   * For a multi-region production system, we should
   * later make timezone an explicit account setting.
   */
  const startOfDay = new Date(now);

  startOfDay.setHours(
    0,
    0,
    0,
    0
  );

  const endOfDay = new Date(now);

  endOfDay.setHours(
    23,
    59,
    59,
    999
  );

  const result =
    await prisma.order.aggregate({
      where: {
        userId,

        status: "PAID",

        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },

      _sum: {
        totalAmount: true,
      },
    });

  return result._sum.totalAmount || 0;
}