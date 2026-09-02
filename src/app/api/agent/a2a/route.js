import {
  NextResponse,
} from "next/server";

import {
  requestOffersFromRevenueAgent,
} from "@/lib/agents/agentToAgent";

export async function POST(request) {
  try {
    const body = await request.json();

    const message = body?.message;

    if (
      !message ||
      typeof message !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "message is required",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await requestOffersFromRevenueAgent({
        message,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Agent-to-agent error:",
      error
    );

    if (
      error?.message ===
      "Buyer access required"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Buyer access required",
        },
        {
          status: 403,
        }
      );
    }

    if (
      error?.message === "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        {
          status: 401,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Agent-to-agent request failed",
      },
      {
        status: 500,
      }
    );
  }
}