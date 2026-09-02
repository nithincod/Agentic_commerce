import { NextResponse } from "next/server";

import {
  requireMerchant,
} from "@/lib/auth/merchant";

import {
  getCampaignPerformance,
} from "@/lib/merchant/campaignAnalytics";

export async function GET(
  request,
  { params }
) {
  try {
    const {
      merchant,
    } = await requireMerchant();

    const { id } =
      await params;

    const result =
      await getCampaignPerformance(
        id,
        merchant.id
      );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Campaign performance error:",
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
            "Merchant account not found",
        },
        { status: 403 }
      );
    }

    if (
      error.message ===
      "CAMPAIGN_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Campaign not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to calculate campaign performance",
      },
      { status: 500 }
    );
  }
}