import { NextResponse } from "next/server";

import {
  requireBuyer,
} from "@/lib/auth/authorization";

import {
  createCheckoutTool,
} from "@/lib/tools/checkoutTools";

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

    const cartId =
      body?.cartId?.trim();

    if (!cartId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "cartId is required",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * 3. Create a checkout tool bound to the
     * authenticated buyer.
     * --------------------------------------------------
     */
    const checkoutTool =
      createCheckoutTool(
        session.user.id
      );

    /*
     * --------------------------------------------------
     * 4. Invoke the same server-side checkout logic
     * used by the Buyer Agent.
     * --------------------------------------------------
     */
    const rawResult =
      await checkoutTool.invoke({
        cartId,
      });

    /*
     * Tool returns JSON string.
     */
    let result;

    try {
      result =
        typeof rawResult ===
        "string"
          ? JSON.parse(rawResult)
          : rawResult;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid checkout tool response",
        },
        { status: 500 }
      );
    }

    /*
     * --------------------------------------------------
     * 5. Return the result
     * --------------------------------------------------
     */
    return NextResponse.json(
      result,
      {
        status:
          result?.success
            ? 200
            : 400,
      }
    );
  } catch (error) {
    console.error(
      "Checkout API error:",
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

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to create checkout",
      },
      { status: 500 }
    );
  }
}