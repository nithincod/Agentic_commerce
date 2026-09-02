import prisma from "@/lib/db/prisma";
import razorpay from "@/lib/razorpay/client";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

export async function reconcileCreatingPayment(
  payment
) {
  if (!payment) {
    return {
      reconciled: false,
      reason:
        "Payment intent not found",
    };
  }

  if (
    payment.status !==
    "CREATING"
  ) {
    return {
      reconciled: false,
      reason:
        "Payment is not in CREATING state",
    };
  }

  const receipt =
    `agentpay_${payment.checkoutId}_${payment.attempt}`;

  try {
    /*
     * Razorpay Orders API supports fetching/listing
     * orders. We use the unique receipt we supplied
     * when creating the order.
     */
    const response =
      await razorpay.orders.all({
        receipt,
        count: 10,
      });

    const orders =
      response?.items || [];

    /*
     * We expect at most one order for this receipt.
     */
    const matchingOrders =
      orders.filter(
        (order) =>
          order.receipt ===
            receipt &&
          Number(order.amount) ===
            payment.amount * 100
      );

    if (
      matchingOrders.length ===
      0
    ) {
      return {
        reconciled: false,

        reason:
          "No matching Razorpay order found",
      };
    }

    if (
      matchingOrders.length >
      1
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "RAZORPAY_RECONCILIATION_AMBIGUOUS",

        entityType:
          "Payment",

        entityId:
          payment.id,

        input: {
          paymentId:
            payment.id,

          receipt,

          attempt:
            payment.attempt,
        },

        output: {
          matchingOrderCount:
            matchingOrders.length,
        },

        status:
          "FAILED",

        reason:
          "Multiple Razorpay orders matched the payment receipt",
      });

      return {
        reconciled: false,

        ambiguous: true,

        reason:
          "Multiple Razorpay orders matched the receipt",
      };
    }

    const razorpayOrder =
      matchingOrders[0];

    const updatedPayment =
      await prisma.payment.update({
        where: {
          id:
            payment.id,
        },

        data: {
          razorpayOrderId:
            razorpayOrder.id,

          status:
            "CREATED",
        },
      });

    await prisma.checkout.updateMany({
      where: {
        id:
          payment.checkoutId,

        status: {
          in: [
            "APPROVED",
            "READY",
            "PAYMENT_PENDING",
          ],
        },
      },

      data: {
        status:
          "PAYMENT_PENDING",
      },
    });

    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "RAZORPAY_ORDER_RECONCILED",

      entityType:
        "Payment",

      entityId:
        payment.id,

      input: {
        paymentId:
          payment.id,

        checkoutId:
          payment.checkoutId,

        receipt,

        attempt:
          payment.attempt,
      },

      output: {
        razorpayOrderId:
          razorpayOrder.id,

        razorpayStatus:
          razorpayOrder.status,

        amount:
          razorpayOrder.amount,

        currency:
          razorpayOrder.currency,
      },

      status:
        "SUCCESS",

      reason:
        "Recovered previously created Razorpay order after application interruption",
    });

    return {
      reconciled: true,

      payment:
        updatedPayment,

      razorpayOrder,
    };
  } catch (error) {
    console.error(
      "Razorpay reconciliation error:",
      error
    );

    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "RAZORPAY_RECONCILIATION_FAILED",

      entityType:
        "Payment",

      entityId:
        payment.id,

      input: {
        paymentId:
          payment.id,

        checkoutId:
          payment.checkoutId,

        receipt,
      },

      status:
        "FAILED",

      reason:
        error.message ||
        "Unable to reconcile Razorpay order",
    });

    return {
      reconciled: false,

      reason:
        error.message ||
        "Razorpay reconciliation failed",
    };
  }
}