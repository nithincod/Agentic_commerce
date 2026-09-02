import { NextResponse } from "next/server";

import { requireMerchant } from "@/lib/auth/merchant";
import {
  createRevenueAgent,
} from "@/lib/agents/revenueAgent";

export async function POST(request) {
  try {
    const {
      merchant,
    } = await requireMerchant();

    const body =
      await request.json();

    const message =
      body?.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error:
            "message is required",
        },
        { status: 400 }
      );
    }

    const agent =
      createRevenueAgent(
        merchant.id
      );

    const result =
      await agent.invoke({
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      });

    const messages =
      result.messages || [];

    const lastMessage =
      messages[
        messages.length - 1
      ];

    return NextResponse.json({
      success: true,

      merchant: {
        id: merchant.id,
        name: merchant.name,
      },

      response:
        lastMessage?.content ||
        "",

      messages,
    });
  } catch (error) {
    console.error(
      "Revenue agent error:",
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
            "Merchant access required",
        },
        { status: 403 }
      );
    }

    if (
      error.message ===
      "MERCHANT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No merchant account is linked to this user",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Revenue agent failed",
      },
      { status: 500 }
    );
  }
}