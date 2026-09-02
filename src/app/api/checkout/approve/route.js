import { NextResponse } from "next/server";
import { Command } from "@langchain/langgraph";

import prisma from "@/lib/db/prisma";

import checkoutGraph from "@/lib/graphs/checkoutGraph";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

import {
  requireBuyer,
  requireOwnedCheckout,
} from "@/lib/auth/authorization";

export async function POST(request) {
  try {
    /*
     * --------------------------------------------------
     * 1. Authenticate buyer
     * --------------------------------------------------
     */
    const session =
      await requireBuyer();

    /*
     * --------------------------------------------------
     * 2. Parse request
     * --------------------------------------------------
     */
    const body =
      await request.json();

    const threadId =
      body?.threadId?.trim();

    const decision =
      body?.decision;

    if (!threadId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "threadId is required",
        },
        { status: 400 }
      );
    }

    if (
      ![
        "approve",
        "reject",
      ].includes(decision)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "decision must be approve or reject",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * 3. Verify checkout ownership
     * --------------------------------------------------
     */
    const checkout =
      await requireOwnedCheckout(
        threadId,
        session.user.id
      );

    /*
     * --------------------------------------------------
     * 4. Re-read authoritative checkout state
     * --------------------------------------------------
     *
     * Do not trust the graph thread alone.
     */
    const currentCheckout =
      await prisma.checkout.findUnique({
        where: {
          id: checkout.id,
        },

        select: {
          id: true,
          cartId: true,
          amount: true,
          currency: true,
          status: true,
          policy: true,
        },
      });

    if (!currentCheckout) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Checkout not found",
        },
        { status: 404 }
      );
    }

    /*
     * --------------------------------------------------
     * 5. The checkout must actually require approval.
     * --------------------------------------------------
     */
    if (
      currentCheckout.status !==
      "AWAITING_APPROVAL"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Checkout cannot be approved from status ${currentCheckout.status}`,
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 6. The persisted policy must require approval.
     * --------------------------------------------------
     */
    const policy =
      currentCheckout.policy;

    if (!policy) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Checkout does not contain a persisted policy decision",
        },
        { status: 409 }
      );
    }

    if (
      policy.status !==
      "APPROVAL_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Checkout policy does not require approval. Current policy status: ${policy.status}`,
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 7. Resume LangGraph.
     *
     * The graph is the authority for the resulting
     * approval state.
     * --------------------------------------------------
     */
    const result =
  await checkoutGraph.invoke(
    new Command({
      resume: decision,
    }),
    {
      configurable: {
        thread_id: threadId,
      },
    }
  );

console.log(
  "========== CHECKOUT APPROVAL GRAPH RESULT =========="
);

console.log(
  JSON.stringify(
    {
      threadId,
      decision,

      approvalStatus:
        result?.approvalStatus,

      paymentStatus:
        result?.paymentStatus,

      message:
        result?.message,

      checkoutId:
        result?.checkoutId,

      fullResult:
        result,
    },
    null,
    2
  )
);

console.log(
  "===================================================="
);

    /*
     * --------------------------------------------------
     * 8. Read actual graph state.
     * --------------------------------------------------
     */
    const graphApprovalStatus =
      result?.approvalStatus;

    const graphPaymentStatus =
      result?.paymentStatus;

    const graphMessage =
      result?.message || "";

    /*
     * --------------------------------------------------
     * 9. Validate graph transition.
     * --------------------------------------------------
     */
    if (
      decision === "approve" &&
      graphApprovalStatus !==
        "APPROVED"
    ) {
      await recordAgentAction({
        agentType:
          "BUYER_AGENT",

        action:
          "APPROVAL_STATE_MISMATCH",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          threadId,
          requestedDecision:
            decision,

          userId:
            session.user.id,
        },

        output: {
          graphApprovalStatus,
          graphPaymentStatus,
        },

        status:
          "FAILED",

        reason:
          "Buyer requested approval but checkout graph did not reach APPROVED state",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            "Approval workflow did not complete successfully",

          result,
        },
        { status: 409 }
      );
    }

    if (
      decision === "reject" &&
      graphApprovalStatus ===
        "APPROVED"
    ) {
      await recordAgentAction({
        agentType:
          "BUYER_AGENT",

        action:
          "APPROVAL_STATE_MISMATCH",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          threadId,
          requestedDecision:
            decision,

          userId:
            session.user.id,
        },

        output: {
          graphApprovalStatus,
          graphPaymentStatus,
        },

        status:
          "FAILED",

        reason:
          "Buyer rejected transaction but checkout graph returned APPROVED",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            "Approval workflow returned an unexpected state",

          result,
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 10. Determine authoritative checkout status.
     *
     * Approved + payment READY means the checkout is
     * approved and ready for the Razorpay order flow.
     * --------------------------------------------------
     */
    let nextCheckoutStatus;

    if (
      graphApprovalStatus ===
        "APPROVED" &&
      graphPaymentStatus ===
        "READY"
    ) {
      nextCheckoutStatus =
        "APPROVED";
    } else if (
      graphApprovalStatus ===
      "REJECTED"
    ) {
      nextCheckoutStatus =
        "REJECTED";
    } else {
      /*
       * Anything else is an unexpected workflow state.
       */
      await recordAgentAction({
        agentType:
          "BUYER_AGENT",

        action:
          "APPROVAL_WORKFLOW_INVALID",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          threadId,
          decision,
          userId:
            session.user.id,
        },

        output: {
          graphApprovalStatus,
          graphPaymentStatus,
          graphMessage,
        },

        status:
          "FAILED",

        reason:
          "Checkout graph returned an unexpected state after approval",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            "Unexpected checkout workflow state",

          result,
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 11. Persist only the state actually produced by
     * the graph.
     * --------------------------------------------------
     */
    const updatedCheckout =
      await prisma.checkout.update({
        where: {
          id:
            checkout.id,
        },

        data: {
          status:
            nextCheckoutStatus,
        },
      });

    /*
     * --------------------------------------------------
     * 12. Audit successful approval/rejection.
     * --------------------------------------------------
     */
    await recordAgentAction({
      agentType:
        "BUYER_AGENT",

      action:
        decision ===
        "approve"
          ? "APPROVAL_GRANTED"
          : "APPROVAL_REJECTED",

      entityType:
        "Checkout",

      entityId:
        checkout.id,

      input: {
        threadId,

        decision,

        userId:
          session.user.id,

        policyStatus:
          policy.status,
      },

      output: {
        checkoutStatus:
          updatedCheckout.status,

        graphApprovalStatus,

        graphPaymentStatus,

        message:
          graphMessage,
      },

      status:
        "SUCCESS",

      reason:
        decision ===
        "approve"
          ? "Authenticated buyer approval was accepted by the checkout graph"
          : "Authenticated buyer rejected the checkout",
    });

    /*
     * --------------------------------------------------
     * 13. Return final state.
     * --------------------------------------------------
     */
    return NextResponse.json({
      success: true,

      threadId,

      decision,

      checkout: {
        id:
          updatedCheckout.id,

        amount:
          updatedCheckout.amount,

        currency:
          updatedCheckout.currency,

        status:
          updatedCheckout.status,

        policy:
          updatedCheckout.policy,
      },

      result,

      paymentReady:
        graphPaymentStatus ===
        "READY",
    });
  } catch (error) {
    console.error(
      "Approval error:",
      error
    );

    if (
      error.message ===
      "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required",
        },
        { status: 401 }
      );
    }

    if (
      error.message ===
      "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Buyer access required",
        },
        { status: 403 }
      );
    }

    if (
      error.message ===
      "RESOURCE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Checkout not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,

        error:
          error.message ||
          "Approval failed",
      },
      { status: 500 }
    );
  }
}