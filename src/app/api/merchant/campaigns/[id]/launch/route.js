import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";

import {
  requireMerchant,
} from "@/lib/auth/merchant";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

export async function POST(
  request,
  { params }
) {
  try {
    const { session, merchant } = await requireMerchant();

    const { id } = await params;

const campaign =
  await prisma.campaign.findFirst({
    where: {
      id,
      merchantId:
        merchant.id,
    },
  });

    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          error: "Campaign not found",
        },
        { status: 404 }
      );
    }

    if (campaign.status !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Campaign must be approved before launch",
        },
        { status: 400 }
      );
    }

    const launchedCampaign =
      await prisma.campaign.update({
        where: {
          id: campaign.id,
        },
        data: {
          status: "ACTIVE",
        },
      });

    await recordAgentAction({
      agentType: "MERCHANT",
      action: "CAMPAIGN_LAUNCHED",
      entityType: "Campaign",
      entityId: campaign.id,
      input: {
        campaignId: campaign.id,
        merchantUserId:
          session.user.id,
      },
      output: {
        status:
          launchedCampaign.status,
      },
      status: "SUCCESS",
      reason:
        "Authenticated merchant launched an approved campaign",
    });

    return NextResponse.json({
      success: true,
      campaign: launchedCampaign,
    });
  } catch (error) {
    console.error(
      "Campaign launch error:",
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

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to launch campaign",
      },
      { status: 500 }
    );
  }
}