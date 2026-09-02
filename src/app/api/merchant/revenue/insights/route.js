import { NextResponse } from "next/server";

import {
  requireMerchant,
} from "@/lib/auth/merchant";

import {
  createRevenueTools,
  getMerchantRevenueSummary,
} from "@/lib/tools/revenueTools";

export async function GET() {
  try {
    const {
      merchant,
    } = await requireMerchant();

    const revenue =
      await getMerchantRevenueSummary(
        merchant.id
      );

    const tools =
      createRevenueTools(
        merchant.id
      );

    const [
      crossSellTool,
      upsellTool,
      abandonedTool,
      inventoryTool,
    ] = tools;

    const [
      crossSellRaw,
      upsellRaw,
      abandonedRaw,
      inventoryRaw,
    ] = await Promise.all([
      crossSellTool.invoke({}),
      upsellTool.invoke({}),
      abandonedTool.invoke({}),
      inventoryTool.invoke({}),
    ]);

    return NextResponse.json({
      success: true,

      merchant: {
        id:
          merchant.id,

        name:
          merchant.name,
      },

      revenue,

      crossSell:
        JSON.parse(
          crossSellRaw
        ),

      upsell:
        JSON.parse(
          upsellRaw
        ),

      abandonedCart:
        JSON.parse(
          abandonedRaw
        ),

      inventory:
        JSON.parse(
          inventoryRaw
        ),
    });
  } catch (error) {
    console.error(
      "Merchant revenue insights error:",
      error
    );

    if (
      error?.message ===
      "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required",
        },
        {
          status: 401,
        }
      );
    }

    if (
      error?.message ===
      "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Merchant access required",
        },
        {
          status: 403,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Unable to generate merchant insights",
      },
      {
        status: 500,
      }
    );
  }
}