import {
  StateGraph,
  StateSchema,
  START,
  END,
  interrupt,
  MemorySaver,
} from "@langchain/langgraph";

import { z } from "zod";

import prisma from "@/lib/db/prisma";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

/*
 * ------------------------------------------------------
 * Checkout graph state
 * ------------------------------------------------------
 *
 * "policy" cannot be used as a state field because
 * "policy" is also our graph node name.
 *
 * We therefore call the persisted decision:
 * "policySnapshot".
 */
const CheckoutState =
  new StateSchema({
    checkoutId: z.string(),

    amount: z.number(),

    currency: z
      .string()
      .default("INR"),

    approvalStatus: z
      .string()
      .default("PENDING"),

    paymentStatus: z
      .string()
      .default("NOT_STARTED"),

    message: z
      .string()
      .default(""),

    policySnapshot: z
      .any()
      .nullable()
      .default(null),
  });

/*
 * ------------------------------------------------------
 * Policy node
 * ------------------------------------------------------
 *
 * IMPORTANT:
 * This node does NOT calculate policy.
 *
 * The policy was already calculated by
 * createCheckoutTool() and persisted on Checkout.
 *
 * The graph simply consumes that authoritative snapshot.
 */
async function policyNode(state) {
  const checkout =
    await prisma.checkout.findUnique({
      where: {
        id: state.checkoutId,
      },

      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        policy: true,
      },
    });

  if (!checkout) {
    return {
      approvalStatus: "REJECTED",

      paymentStatus:
        "NOT_STARTED",

      message:
        "Checkout not found.",

      policySnapshot: null,
    };
  }

  /*
   * Verify graph state matches the persisted checkout.
   */
  if (
    checkout.amount !== state.amount ||
    checkout.currency !== state.currency
  ) {
    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "CHECKOUT_STATE_MISMATCH",

      entityType:
        "Checkout",

      entityId:
        checkout.id,

      input: {
        graphAmount:
          state.amount,

        databaseAmount:
          checkout.amount,

        graphCurrency:
          state.currency,

        databaseCurrency:
          checkout.currency,
      },

      status:
        "FAILED",

      reason:
        "Graph state does not match persisted checkout state",
    });

    return {
      approvalStatus:
        "REJECTED",

      paymentStatus:
        "NOT_STARTED",

      message:
        "Checkout state mismatch.",

      policySnapshot:
        checkout.policy,
    };
  }

  /*
   * Every checkout must have a persisted policy
   * decision before payment can continue.
   */
  if (!checkout.policy) {
    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "CHECKOUT_POLICY_MISSING",

      entityType:
        "Checkout",

      entityId:
        checkout.id,

      input: {
        checkoutId:
          checkout.id,
      },

      status:
        "FAILED",

      reason:
        "Checkout has no persisted policy decision",
    });

    return {
      approvalStatus:
        "REJECTED",

      paymentStatus:
        "NOT_STARTED",

      message:
        "Checkout policy is missing.",

      policySnapshot: null,
    };
  }

  const policy =
    checkout.policy;

  /*
   * Only these policy states are accepted.
   */
  if (
    policy.status !== "APPROVED" &&
    policy.status !== "APPROVAL_REQUIRED" &&
    policy.status !== "BLOCKED"
  ) {
    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "INVALID_POLICY_STATE",

      entityType:
        "Checkout",

      entityId:
        checkout.id,

      input: {
        policy,
      },

      status:
        "FAILED",

      reason:
        "Persisted checkout policy contains an invalid status",
    });

    return {
      approvalStatus:
        "REJECTED",

      paymentStatus:
        "NOT_STARTED",

      message:
        "Invalid checkout policy.",

      policySnapshot:
        policy,
    };
  }

  /*
   * BLOCKED
   */
  if (
    policy.status === "BLOCKED"
  ) {
    return {
      approvalStatus:
        "REJECTED",

      paymentStatus:
        "NOT_STARTED",

      message:
        policy.reason ||
        "Transaction blocked by policy.",

      policySnapshot:
        policy,
    };
  }

  /*
   * HUMAN APPROVAL REQUIRED
   */
  if (
    policy.status ===
    "APPROVAL_REQUIRED"
  ) {
    return {
      approvalStatus:
        "REQUIRED",

      paymentStatus:
        "NOT_STARTED",

      message:
        policy.reason ||
        "Human approval is required.",

      policySnapshot:
        policy,
    };
  }

  /*
   * POLICY ALREADY APPROVED
   */
  return {
    approvalStatus:
      "APPROVED",

    paymentStatus:
      "NOT_STARTED",

    message:
      policy.reason ||
      "Transaction approved by policy.",

    policySnapshot:
      policy,
  };
}

/*
 * ------------------------------------------------------
 * Approval node
 * ------------------------------------------------------
 */
async function approvalNode(state) {
  if (
    state.approvalStatus !==
    "REQUIRED"
  ) {
    return {};
  }

  const decision =
    interrupt({
      type:
        "PAYMENT_APPROVAL",

      checkoutId:
        state.checkoutId,

      amount:
        state.amount,

      currency:
        state.currency,

      policy:
        state.policySnapshot,

      message:
        `Approve payment of ₹${state.amount.toLocaleString(
          "en-IN"
        )}?`,
    });

  /*
   * Explicit approval only.
   */
  if (
    decision === "approve"
  ) {
    await recordAgentAction({
      agentType:
        "BUYER_AGENT",

      action:
        "PAYMENT_APPROVAL_GRANTED",

      entityType:
        "Checkout",

      entityId:
        state.checkoutId,

      input: {
        checkoutId:
          state.checkoutId,

        amount:
          state.amount,
      },

      output: {
        decision:
          "approve",
      },

      status:
        "SUCCESS",

      reason:
        "Authenticated buyer approved the transaction",
    });

    return {
      approvalStatus:
        "APPROVED",

      paymentStatus:
        "NOT_STARTED",

      message:
        "Payment approved by user.",
    };
  }

  await recordAgentAction({
    agentType:
      "BUYER_AGENT",

    action:
      "PAYMENT_APPROVAL_REJECTED",

    entityType:
      "Checkout",

    entityId:
      state.checkoutId,

    input: {
      checkoutId:
        state.checkoutId,

      amount:
        state.amount,
    },

    output: {
      decision:
        "reject",
    },

    status:
      "SUCCESS",

    reason:
      "Authenticated buyer rejected the transaction",
  });

  return {
    approvalStatus:
      "REJECTED",

    paymentStatus:
      "NOT_STARTED",

    message:
      "Payment rejected by user.",
  };
}

/*
 * ------------------------------------------------------
 * Payment node
 * ------------------------------------------------------
 *
 * This does NOT charge the customer.
 *
 * It only confirms that the checkout is ready
 * for the Razorpay payment API.
 */
async function paymentNode(state) {
  /*
   * ------------------------------------------------------
   * 1. Graph approval must be APPROVED
   * ------------------------------------------------------
   *
   * This is important:
   *
   * When this node executes immediately after the
   * human approval interrupt, the database checkout
   * can still be AWAITING_APPROVAL.
   *
   * The graph itself has already established:
   *
   *     approvalStatus = APPROVED
   *
   * The approve API will persist APPROVED to the
   * database after this graph completes.
   */

  if (
    state.approvalStatus !==
    "APPROVED"
  ) {
    return {
      paymentStatus:
        "NOT_STARTED",

      message:
        state.message,
    };
  }

  /*
   * ------------------------------------------------------
   * 2. Re-read authoritative checkout state
   * ------------------------------------------------------
   */

  const checkout =
    await prisma.checkout.findUnique({
      where: {
        id:
          state.checkoutId,
      },

      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        policy: true,
      },
    });

  if (!checkout) {
    return {
      paymentStatus:
        "FAILED",

      message:
        "Checkout no longer exists.",
    };
  }

  /*
   * ------------------------------------------------------
   * 3. Check amount integrity
   * ------------------------------------------------------
   */

  if (
    checkout.amount !==
      state.amount ||
    checkout.currency !==
      state.currency
  ) {
    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "PAYMENT_PREPARATION_BLOCKED",

      entityType:
        "Checkout",

      entityId:
        checkout.id,

      input: {
        graphAmount:
          state.amount,

        databaseAmount:
          checkout.amount,

        graphCurrency:
          state.currency,

        databaseCurrency:
          checkout.currency,
      },

      status:
        "BLOCKED",

      reason:
        "Checkout amount or currency changed unexpectedly",
    });

    return {
      paymentStatus:
        "FAILED",

      message:
        "Checkout amount changed unexpectedly.",
    };
  }

  /*
   * ------------------------------------------------------
   * 4. Validate persisted policy
   * ------------------------------------------------------
   */

  if (
    !checkout.policy
  ) {
    return {
      paymentStatus:
        "FAILED",

      message:
        "Checkout policy is missing.",
    };
  }

  /*
   * ------------------------------------------------------
   * 5. Blocked policy can never reach payment
   * ------------------------------------------------------
   */

  if (
    checkout.policy.status ===
    "BLOCKED"
  ) {
    return {
      paymentStatus:
        "FAILED",

      message:
        checkout.policy.reason ||
        "Transaction blocked by policy.",
    };
  }

  /*
   * ------------------------------------------------------
   * 6. IMPORTANT:
   *
   * Do NOT require checkout.status === APPROVED here.
   *
   * The approval route updates the database AFTER
   * the graph returns.
   *
   * At this point the graph has just established:
   *
   *     state.approvalStatus === APPROVED
   *
   * Therefore AWAITING_APPROVAL is valid here when
   * the current graph execution is the approval flow.
   *
   * We still require the persisted policy to be either:
   *
   *     APPROVAL_REQUIRED
   *     APPROVED
   *
   * ------------------------------------------------------
   */

  if (
    ![
      "APPROVAL_REQUIRED",
      "APPROVED",
    ].includes(
      checkout.policy.status
    )
  ) {
    return {
      paymentStatus:
        "FAILED",

      message:
        `Checkout cannot enter payment with policy status ${checkout.policy.status}.`,
    };
  }

  /*
   * ------------------------------------------------------
   * 7. Payment is ready
   * ------------------------------------------------------
   *
   * The actual Razorpay order is NOT created here.
   *
   * This node only tells the checkout API that the
   * graph has completed its policy + approval workflow.
   *
   * approve/route.js will then persist:
   *
   *     checkout.status = APPROVED
   *
   * and the frontend can continue to Razorpay.
   */

  await recordAgentAction({
    agentType:
      "PAYMENT_AGENT",

    action:
      "PAYMENT_READY",

    entityType:
      "Checkout",

    entityId:
      checkout.id,

    input: {
      checkoutId:
        checkout.id,

      amount:
        checkout.amount,

      policyStatus:
        checkout.policy.status,

      graphApprovalStatus:
        state.approvalStatus,
    },

    output: {
      currency:
        checkout.currency,

      previousCheckoutStatus:
        checkout.status,

      paymentStatus:
        "READY",
    },

    status:
      "SUCCESS",

    reason:
      "Checkout graph completed policy and human approval successfully and is ready for Razorpay payment",
  });

  return {
    paymentStatus:
      "READY",

    message:
      "Transaction is ready for Razorpay payment.",
  };
}

/*
 * ------------------------------------------------------
 * Routing after policy
 * ------------------------------------------------------
 */
function routeAfterPolicy(state) {
  if (
    state.approvalStatus ===
    "REJECTED"
  ) {
    return END;
  }

  if (
    state.approvalStatus ===
    "REQUIRED"
  ) {
    return "approval";
  }

  return "payment";
}

/*
 * ------------------------------------------------------
 * Routing after approval
 * ------------------------------------------------------
 */
function routeAfterApproval(state) {
  if (
    state.approvalStatus ===
    "APPROVED"
  ) {
    return "payment";
  }

  return END;
}

/*
 * ------------------------------------------------------
 * Checkpointer
 * ------------------------------------------------------
 */
const checkpointer =
  new MemorySaver();

/*
 * ------------------------------------------------------
 * Build graph
 * ------------------------------------------------------
 */
const checkoutGraph =
  new StateGraph(
    CheckoutState
  )
    .addNode(
      "policy",
      policyNode
    )

    .addNode(
      "approval",
      approvalNode
    )

    .addNode(
      "payment",
      paymentNode
    )

    .addEdge(
      START,
      "policy"
    )

    .addConditionalEdges(
      "policy",
      routeAfterPolicy,
      [
        "approval",
        "payment",
        END,
      ]
    )

    .addConditionalEdges(
      "approval",
      routeAfterApproval,
      [
        "payment",
        END,
      ]
    )

    .addEdge(
      "payment",
      END
    )

    .compile({
      checkpointer,
    });

export default checkoutGraph;