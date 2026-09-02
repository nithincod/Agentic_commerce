import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import razorpay from "@/lib/razorpay/client";
import { recordAgentAction } from "@/lib/audit/auditLog";

import {
  requireBuyer,
  requireOwnedPayment,
} from "@/lib/auth/authorization";

export async function POST(request) {
  try {
    const session = await requireBuyer();

    const body = await request.json();

    const paymentId =
      body?.paymentId?.trim();

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

    if (
      payment.status === "VERIFIED" ||
      payment.status === "CAPTURED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Payment has already completed",
        },
        { status: 409 }
      );
    }

    if (payment.attempt >= 2) {
      await recordAgentAction({
        agentType: "PAYMENT_AGENT",
        action: "PAYMENT_RETRY_BLOCKED",
        entityType: "Payment",
        entityId: payment.id,
        input: {
          paymentId: payment.id,
          userId: session.user.id,
          attempt: payment.attempt,
        },
        status: "BLOCKED",
        reason:
          "Maximum automatic retry limit reached",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Maximum automatic retry limit reached",
        },
        { status: 409 }
      );
    }

    const checkout =
      await prisma.checkout.findUnique({
        where: {
          id: payment.checkoutId,
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
      });

    if (!checkout) {
      return NextResponse.json(
        {
          success: false,
          error: "Checkout not found",
        },
        { status: 404 }
      );
    }

    let totalAmount = 0;

    for (const item of checkout.cart.items) {
      if (!item.product.active) {
        return NextResponse.json(
          {
            success: false,
            error:
              `${item.product.name} is unavailable`,
          },
          { status: 400 }
        );
      }

      if (
        item.product.inventory <
        item.quantity
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Insufficient inventory for ${item.product.name}`,
          },
          { status: 400 }
        );
      }

      totalAmount +=
        item.product.price *
        item.quantity;
    }

    if (
      totalAmount !== checkout.amount
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Checkout amount no longer matches cart",
        },
        { status: 409 }
      );
    }

    const razorpayOrder =
      await razorpay.orders.create({
        amount:
          totalAmount * 100,
        currency:
          checkout.currency,
        receipt:
          `agentpay_retry_${checkout.id}`,
        notes: {
          checkoutId:
            checkout.id,
          retryForPayment:
            payment.id,
        },
      });

    const retryPayment =
      await prisma.payment.create({
        data: {
          checkoutId:
            checkout.id,
          razorpayOrderId:
            razorpayOrder.id,
          amount:
            totalAmount,
          status: "CREATED",
          attempt:
            payment.attempt + 1,
        },
      });

    await prisma.checkout.update({
      where: {
        id: checkout.id,
      },
      data: {
        status:
          "PAYMENT_PENDING",
      },
    });

    await recordAgentAction({
      agentType: "PAYMENT_AGENT",
      action: "PAYMENT_RETRY_CREATED",
      entityType: "Payment",
      entityId: retryPayment.id,
      input: {
        failedPaymentId:
          payment.id,
        checkoutId:
          checkout.id,
        userId:
          session.user.id,
        previousAttempt:
          payment.attempt,
      },
      output: {
        newPaymentId:
          retryPayment.id,
        razorpayOrderId:
          razorpayOrder.id,
        attempt:
          retryPayment.attempt,
        amount:
          totalAmount,
      },
      status: "SUCCESS",
      reason:
        "Controlled retry created for authenticated buyer",
    });

    return NextResponse.json({
      success: true,
      retry: true,
      paymentId:
        retryPayment.id,
      checkoutId:
        checkout.id,
      razorpayOrderId:
        razorpayOrder.id,
      amount:
        totalAmount,
      amountInSubunits:
        razorpayOrder.amount,
      currency:
        razorpayOrder.currency,
      keyId:
        process.env
          .RAZORPAY_KEY_ID,
      attempt:
        retryPayment.attempt,
    });
  } catch (error) {
    console.error(
      "Payment retry error:",
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
          "Unable to retry payment",
      },
      { status: 500 }
    );
  }
}