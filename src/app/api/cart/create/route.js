import { NextResponse } from "next/server";

import {
  requireBuyer,
} from "@/lib/auth/authorization";

import {
  createCartTool,
} from "@/lib/tools/cartTools";

export async function POST(request) {
  try {
    const session =
      await requireBuyer();

    const body =
      await request.json();

    const productId =
      body?.productId?.trim();

    const quantity =
      body?.quantity ?? 1;

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "productId is required",
        },
        { status: 400 }
      );
    }

    const cartTool =
      createCartTool(session.user.id);

    const result =
      await cartTool.invoke({
        productId,
        quantity,
      });

    const parsed =
      typeof result === "string"
        ? JSON.parse(result)
        : result;

    return NextResponse.json(
      parsed
    );
  } catch (error) {
    console.error(
      "Create cart API error:",
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
          "Unable to create cart",
      },
      { status: 500 }
    );
  }
}