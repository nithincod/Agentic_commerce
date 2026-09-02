import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import {
  requireBuyer,
  requireOwnedPayment,
} from "@/lib/auth/authorization";
import { handlePaymentFailure } from "@/lib/payments/recovery";

export async function POST(request) {
  try {
    const session = await requireBuyer();

    const body = await request.json();

    const paymentId =
      body?.paymentId?.trim();

    const reason =
      body?.reason?.trim() ||
      "Payment failed";

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          error: "paymentId is required",
        },
        { status: 400 }
      );
    }

    const payment =
      await requireOwnedPayment(
        paymentId,
        session.user.id
      );

    const recovery =
      await handlePaymentFailure({
        checkoutId:
          payment.checkoutId,
        paymentId:
          payment.id,
        reason,
      });

    return NextResponse.json({
      success: true,
      recovery,
    });
  } catch (error) {
    console.error(
      "Payment failure error:",
      error
    );

    if (error.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: "Buyer access required",
        },
        { status: 403 }
      );
    }

    if (error.message === "RESOURCE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to process payment failure",
      },
      { status: 500 }
    );
  }
}