import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import checkoutGraph from "@/lib/graphs/checkoutGraph";
import { recordAgentAction } from "@/lib/audit/auditLog";

import {
  requireBuyer,
  requireOwnedCheckout,
} from "@/lib/auth/authorization";

export async function POST(request) {
  try {
    const session =
      await requireBuyer();

    const body =
      await request.json();

    const checkoutId =
      body?.checkoutId?.trim();

    if (!checkoutId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "checkoutId is required",
        },
        { status: 400 }
      );
    }

    const checkout =
      await requireOwnedCheckout(
        checkoutId,
        session.user.id
      );

    if (
      ![
        "READY",
        "AWAITING_APPROVAL",
      ].includes(checkout.status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Checkout cannot be started from status ${checkout.status}`,
        },
        { status: 400 }
      );
    }

    const threadId =
      checkout.id;

    const result =
      await checkoutGraph.invoke(
        {
          checkoutId:
            checkout.id,

          amount:
            checkout.amount,

          currency:
            checkout.currency,

          approvalStatus:
            "PENDING",

          paymentStatus:
            "NOT_STARTED",
        },
        {
          configurable: {
            thread_id:
              threadId,
          },
        }
      );

    const interrupted =
      Boolean(
        result?.__interrupt__?.length
      );

    await recordAgentAction({
      agentType:
        "BUYER_AGENT",

      action:
        interrupted
          ? "APPROVAL_REQUESTED"
          : "CHECKOUT_STARTED",

      entityType:
        "Checkout",

      entityId:
        checkout.id,

      input: {
        checkoutId:
          checkout.id,
        userId:
          session.user.id,
      },

      output: {
        amount:
          checkout.amount,

        currency:
          checkout.currency,

        approvalStatus:
          result.approvalStatus,

        interrupted,
      },

      status:
        interrupted
          ? "WAITING"
          : "SUCCESS",

      reason:
        result.message ||
        "Checkout workflow started",
    });

    return NextResponse.json({
      success: true,
      threadId,
      result,
    });
  } catch (error) {
    console.error(
      "Checkout start error:",
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
          "Unable to start checkout",
      },
      { status: 500 }
    );
  }
}