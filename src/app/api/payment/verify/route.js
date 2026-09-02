import { NextResponse } from "next/server";
import crypto from "crypto";

import prisma from "@/lib/db/prisma";
import { recordAgentAction } from "@/lib/audit/auditLog";
import {
  requireBuyer,
  requireOwnedCheckout,
} from "@/lib/auth/authorization";

export async function POST(request) {
  try {
    const session = await requireBuyer();
    const body = await request.json();

    const checkoutId = body?.checkoutId?.trim();
    const razorpayPaymentId =
      body?.razorpayPaymentId?.trim();
    const razorpayOrderId =
      body?.razorpayOrderId?.trim();
    const razorpaySignature =
      body?.razorpaySignature?.trim();

    if (
      !checkoutId ||
      !razorpayPaymentId ||
      !razorpayOrderId ||
      !razorpaySignature
    ) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "Missing payment verification fields",
        },
        { status: 400 }
      );
    }

    // Verify checkout belongs to authenticated buyer.
    const checkout = await requireOwnedCheckout(
      checkoutId,
      session.user.id
    );

    const payment = await prisma.payment.findFirst({
      where: {
        checkoutId: checkout.id,
        razorpayOrderId,
      },
    });

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "Payment record not found",
        },
        { status: 404 }
      );
    }

    if (
      payment.status === "VERIFIED" ||
      payment.status === "CAPTURED"
    ) {
      return NextResponse.json({
        success: true,
        verified: true,
        alreadyProcessed: true,
        checkoutId: checkout.id,
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayOrderId: payment.razorpayOrderId,
      });
    }

    if (
      payment.razorpayOrderId !== razorpayOrderId
    ) {
      await recordAgentAction({
        agentType: "PAYMENT_AGENT",
        action: "PAYMENT_VERIFICATION_FAILED",
        entityType: "Payment",
        entityId: payment.id,
        input: {
          checkoutId,
          userId: session.user.id,
          razorpayOrderId,
        },
        status: "FAILED",
        reason: "Razorpay order mismatch",
      });

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "Razorpay order mismatch",
        },
        { status: 400 }
      );
    }

    const payload =
      `${payment.razorpayOrderId}|${razorpayPaymentId}`;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(payload)
        .digest("hex");

    const expectedBuffer =
      Buffer.from(expectedSignature, "utf8");

    const receivedBuffer =
      Buffer.from(razorpaySignature, "utf8");

    const signatureValid =
      expectedBuffer.length ===
        receivedBuffer.length &&
      crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      );

    if (!signatureValid) {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "FAILED_VERIFICATION",
        },
      });

      await recordAgentAction({
        agentType: "PAYMENT_AGENT",
        action: "PAYMENT_VERIFICATION_FAILED",
        entityType: "Payment",
        entityId: payment.id,
        input: {
          checkoutId,
          userId: session.user.id,
          razorpayPaymentId,
        },
        status: "FAILED",
        reason: "Invalid Razorpay signature",
      });

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "Invalid payment signature",
        },
        { status: 400 }
      );
    }

    const updatedPayment =
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          razorpayPaymentId,
          razorpaySignature,
          status: "VERIFIED",
        },
      });

    await prisma.checkout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status: "PAYMENT_VERIFIED",
      },
    });

    await recordAgentAction({
      agentType: "PAYMENT_AGENT",
      action: "PAYMENT_VERIFIED",
      entityType: "Payment",
      entityId: payment.id,
      input: {
        checkoutId,
        userId: session.user.id,
      },
      output: {
        paymentId: payment.id,
        razorpayPaymentId,
        razorpayOrderId,
        amount: payment.amount,
      },
      status: "SUCCESS",
      reason:
        "Payment signature verified for authenticated buyer",
    });

    return NextResponse.json({
      success: true,
      verified: true,
      alreadyProcessed: false,
      checkoutId: checkout.id,
      paymentId: updatedPayment.id,
      razorpayPaymentId,
      razorpayOrderId,
      amount: updatedPayment.amount,
      currency: checkout.currency,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

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
          error: "Checkout not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Payment verification failed",
      },
      { status: 500 }
    );
  }
}