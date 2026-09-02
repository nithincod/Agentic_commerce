import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function requireMerchant() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }

  if (session.user.role !== "MERCHANT") {
    throw new Error("FORBIDDEN");
  }

  const merchant =
    await prisma.merchant.findUnique({
      where: {
        ownerId: session.user.id,
      },
    });

  if (!merchant) {
    throw new Error("MERCHANT_NOT_FOUND");
  }

  return {
    session,
    merchant,
  };
}