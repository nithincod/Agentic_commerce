import prisma from "@/lib/db/prisma";
import { recordAgentAction } from "@/lib/audit/auditLog";

const MAX_RETRIES = 1;

export async function handlePaymentFailure({
  checkoutId,
  paymentId,
  reason = "Payment failed",
}) {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
  });

  if (!payment) {
    return {
      success: false,
      retryAllowed: false,
      status: "UNKNOWN",
      message: "Payment record not found",
    };
  }

  /*
   * Never retry a payment that has already completed.
   */
  if (
    payment.status === "VERIFIED" ||
    payment.status === "CAPTURED"
  ) {
    return {
      success: false,
      retryAllowed: false,
      status: "ALREADY_COMPLETED",
      message:
        "Payment was already completed. Retry is not allowed.",
    };
  }

  /*
   * We allow exactly one retry.
   *
   * attempt = 1 → retry allowed
   * attempt > 1 → no more automatic retries
   */
  const retryAllowed =
    payment.attempt <= MAX_RETRIES;

  await prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      status: "FAILED",
    },
  });

  await recordAgentAction({
    agentType: "PAYMENT_AGENT",
    action: "PAYMENT_FAILED",
    entityType: "Payment",
    entityId: payment.id,
    input: {
      checkoutId,
      paymentId: payment.id,
      attempt: payment.attempt,
    },
    output: {
      retryAllowed,
    },
    status: "FAILED",
    reason,
  });

  if (!retryAllowed) {
    await recordAgentAction({
      agentType: "PAYMENT_AGENT",
      action: "PAYMENT_RETRY_BLOCKED",
      entityType: "Payment",
      entityId: payment.id,
      input: {
        checkoutId,
        paymentId: payment.id,
      },
      status: "BLOCKED",
      reason:
        "Maximum automatic retry limit has been reached",
    });

    return {
      success: true,
      retryAllowed: false,
      status: "RETRY_BLOCKED",
      message:
        "Payment failed and the automatic retry limit has been reached.",
    };
  }

  await recordAgentAction({
    agentType: "PAYMENT_AGENT",
    action: "RECOVERY_STARTED",
    entityType: "Payment",
    entityId: payment.id,
    input: {
      checkoutId,
      paymentId: payment.id,
      failedAttempt: payment.attempt,
    },
    status: "SUCCESS",
    reason:
      "Payment failure detected; one controlled retry is permitted",
  });

  return {
    success: true,
    retryAllowed: true,
    status: "RETRY_ALLOWED",
    message:
      "Payment failed. One retry is allowed.",
  };
}