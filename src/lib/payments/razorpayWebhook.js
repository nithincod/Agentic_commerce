import prisma from "@/lib/db/prisma";

import {
  fulfillPaidCheckout,
} from "@/lib/payments/orderFulfillment";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

/**
 * Process a verified Razorpay webhook event.
 *
 * The webhook route is responsible for signature
 * verification and event deduplication.
 *
 * This service is responsible for business processing.
 */
export async function processRazorpayWebhook(
  event
) {
  const eventName =
    event?.event;

  const payload =
    event?.payload;

  if (!eventName) {
    throw new Error(
      "Webhook event name is missing"
    );
  }

  /*
   * --------------------------------------------------
   * PAYMENT CAPTURED
   * --------------------------------------------------
   */
  if (
    eventName ===
    "payment.captured"
  ) {
    const paymentEntity =
      payload?.payment?.entity;

    const razorpayPaymentId =
      paymentEntity?.id;

    const razorpayOrderId =
      paymentEntity?.order_id;

    const razorpayAmount =
      Number(paymentEntity?.amount);

    if (
      !razorpayPaymentId ||
      !razorpayOrderId
    ) {
      throw new Error(
        "payment.captured payload is missing payment/order ID"
      );
    }

    /*
     * Find our internal payment record.
     */
    const payment =
      await prisma.payment.findUnique({
        where: {
          razorpayOrderId,
        },

        include: {
          checkout: true,
        },
      });

    if (!payment) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "WEBHOOK_PAYMENT_NOT_FOUND",

        entityType:
          "Payment",

        input: {
          razorpayPaymentId,
          razorpayOrderId,
        },

        status:
          "FAILED",

        reason:
          "Razorpay payment.captured references an unknown internal payment",
      });

      /*
       * Returning an error causes the webhook route
       * to return non-2xx so the event can be retried.
       */
      throw new Error(
        "INTERNAL_PAYMENT_NOT_FOUND"
      );
    }

    /*
     * Verify amount.
     *
     * Razorpay amount is in subunits.
     * Our database stores INR in rupees.
     */
    if (
      razorpayAmount !==
      payment.amount * 100
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "WEBHOOK_AMOUNT_MISMATCH",

        entityType:
          "Payment",

        entityId:
          payment.id,

        input: {
          razorpayPaymentId,
          razorpayOrderId,
          razorpayAmount,
          internalAmount:
            payment.amount,
        },

        status:
          "BLOCKED",

        reason:
          "Razorpay captured amount does not match internal payment amount",
      });

      throw new Error(
        "PAYMENT_AMOUNT_MISMATCH"
      );
    }

    /*
     * If this payment has already been captured,
     * don't perform fulfillment twice.
     */
    if (
      [
        "CAPTURED",
        "VERIFIED",
      ].includes(
        payment.status
      )
    ) {
      const fulfillment =
        await fulfillPaidCheckout({
          checkoutId:
            payment.checkoutId,

          razorpayPaymentId,
        });

      return {
        handled: true,

        alreadyProcessed:
          true,

        event:
          eventName,

        paymentId:
          payment.id,

        checkoutId:
          payment.checkoutId,

        orderId:
          fulfillment.order?.id ||
          payment.orderId ||
          null,
      };
    }

    /*
     * Persist the Razorpay payment ID and captured state.
     *
     * Order fulfillment happens immediately afterward
     * through the shared service.
     */
    const updatedPayment =
      await prisma.payment.update({
        where: {
          id:
            payment.id,
        },

        data: {
          razorpayPaymentId,

          status:
            "CAPTURED",
        },
      });

    const fulfillment =
      await fulfillPaidCheckout({
        checkoutId:
          payment.checkoutId,

        razorpayPaymentId,
      });

    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "WEBHOOK_PAYMENT_CAPTURED",

      entityType:
        "Payment",

      entityId:
        updatedPayment.id,

      input: {
        razorpayPaymentId,

        razorpayOrderId,

        checkoutId:
          payment.checkoutId,
      },

      output: {
        paymentStatus:
          updatedPayment.status,

        orderId:
          fulfillment.order?.id ||
          payment.orderId ||
          null,

        alreadyCreated:
          fulfillment.alreadyCreated,

        campaignAttribution:
          fulfillment.campaignAttribution ||
          null,
      },

      status:
        "SUCCESS",

      reason:
        "Razorpay payment.captured processed and shared fulfillment service executed",
    });

    return {
      handled: true,

      alreadyProcessed:
        false,

      event:
        eventName,

      paymentId:
        updatedPayment.id,

      checkoutId:
        payment.checkoutId,

      orderId:
        fulfillment.order?.id ||
        payment.orderId ||
        null,

      campaignAttribution:
        fulfillment.campaignAttribution ||
        null,
    };
  }

  /*
   * --------------------------------------------------
   * ORDER PAID
   * --------------------------------------------------
   */
  if (
    eventName ===
    "order.paid"
  ) {
    const orderEntity =
      payload?.order?.entity;

    const razorpayOrderId =
      orderEntity?.id;

    if (!razorpayOrderId) {
      throw new Error(
        "order.paid payload is missing order ID"
      );
    }

    const payment =
      await prisma.payment.findUnique({
        where: {
          razorpayOrderId,
        },

        include: {
          checkout: true,
        },
      });

    if (!payment) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "WEBHOOK_ORDER_NOT_FOUND",

        entityType:
          "Payment",

        input: {
          razorpayOrderId,
        },

        status:
          "FAILED",

        reason:
          "Razorpay order.paid references an unknown internal payment",
      });

      throw new Error(
        "INTERNAL_PAYMENT_NOT_FOUND"
      );
    }

    /*
     * If payment.captured has already processed this,
     * fulfillment is idempotent and will simply return
     * the existing order.
     */
    const fulfillment =
      await fulfillPaidCheckout({
        checkoutId:
          payment.checkoutId,

        razorpayPaymentId:
          payment.razorpayPaymentId,
      });

    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "WEBHOOK_ORDER_PAID",

      entityType:
        "Checkout",

      entityId:
        payment.checkoutId,

      input: {
        razorpayOrderId,

        checkoutId:
          payment.checkoutId,
      },

      output: {
        orderId:
          fulfillment.order?.id ||
          payment.orderId ||
          null,

        alreadyCreated:
          fulfillment.alreadyCreated,
      },

      status:
        "SUCCESS",

      reason:
        "Razorpay order.paid processed through shared fulfillment service",
    });

    return {
      handled: true,

      event:
        eventName,

      checkoutId:
        payment.checkoutId,

      orderId:
        fulfillment.order?.id ||
        payment.orderId ||
        null,

      alreadyProcessed:
        fulfillment.alreadyCreated,
    };
  }

  /*
   * --------------------------------------------------
   * PAYMENT FAILED
   * --------------------------------------------------
   */
  if (
    eventName ===
    "payment.failed"
  ) {
    const paymentEntity =
      payload?.payment?.entity;

    const razorpayPaymentId =
      paymentEntity?.id;

    const razorpayOrderId =
      paymentEntity?.order_id;

    if (
      !razorpayPaymentId &&
      !razorpayOrderId
    ) {
      throw new Error(
        "payment.failed payload is missing payment/order ID"
      );
    }

    let payment = null;

    /*
     * Prefer Razorpay order ID because our Payment
     * model guarantees it is unique.
     */
    if (razorpayOrderId) {
      payment =
        await prisma.payment.findUnique({
          where: {
            razorpayOrderId,
          },

          include: {
            checkout: true,
          },
        });
    }

    if (
      !payment &&
      razorpayPaymentId
    ) {
      payment =
        await prisma.payment.findFirst({
          where: {
            razorpayPaymentId,
          },

          include: {
            checkout: true,
          },
        });
    }

    if (!payment) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "WEBHOOK_FAILED_PAYMENT_NOT_FOUND",

        entityType:
          "Payment",

        input: {
          razorpayPaymentId,
          razorpayOrderId,
        },

        status:
          "FAILED",

        reason:
          "Razorpay payment.failed references an unknown internal payment",
      });

      throw new Error(
        "INTERNAL_PAYMENT_NOT_FOUND"
      );
    }

    /*
     * Never move an already captured payment backward
     * to FAILED because webhook ordering is not guaranteed.
     */
    if (
      [
        "CAPTURED",
        "VERIFIED",
      ].includes(
        payment.status
      )
    ) {
      return {
        handled: true,

        alreadyProcessed:
          true,

        event:
          eventName,

        paymentId:
          payment.id,

        checkoutId:
          payment.checkoutId,

        status:
          payment.status,
      };
    }

    const updatedPayment =
      await prisma.payment.update({
        where: {
          id:
            payment.id,
        },

        data: {
          status:
            "FAILED",

          ...(razorpayPaymentId
            ? {
                razorpayPaymentId,
              }
            : {}),
        },
      });

    /*
     * A failed payment should leave the checkout
     * retryable rather than completed.
     */
    await prisma.checkout.updateMany({
      where: {
        id:
          payment.checkoutId,

        status: {
          in: [
            "PAYMENT_PENDING",
            "APPROVED",
            "READY",
          ],
        },
      },

      data: {
        status:
          "APPROVED",
      },
    });

    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "WEBHOOK_PAYMENT_FAILED",

      entityType:
        "Payment",

      entityId:
        updatedPayment.id,

      input: {
        razorpayPaymentId,

        razorpayOrderId,

        checkoutId:
          payment.checkoutId,
      },

      output: {
        status:
          updatedPayment.status,
      },

      status:
        "SUCCESS",

      reason:
        "Razorpay payment.failed processed; checkout remains retryable",
    });

    return {
      handled: true,

      alreadyProcessed:
        false,

      event:
        eventName,

      paymentId:
        updatedPayment.id,

      checkoutId:
        payment.checkoutId,

      status:
        updatedPayment.status,
    };
  }

  /*
   * --------------------------------------------------
   * Other valid Razorpay events
   * --------------------------------------------------
   */
  await recordAgentAction({
    agentType:
      "PAYMENT_AGENT",

    action:
      "WEBHOOK_IGNORED",

    entityType:
      "RazorpayWebhook",

    input: {
      event:
        eventName,
    },

    status:
      "SUCCESS",

    reason:
      "Valid Razorpay webhook received but event is not required by current payment workflow",
  });

  return {
    handled: false,

    event:
      eventName,
  };
}