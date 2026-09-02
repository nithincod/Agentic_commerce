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

    if (campaign.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error:
            `Campaign cannot be approved from status ${campaign.status}`,
        },
        { status: 400 }
      );
    }

    const updatedCampaign =
      await prisma.campaign.update({
        where: {
          id: campaign.id,
        },
        data: {
          status: "APPROVED",
        },
      });

    await recordAgentAction({
      agentType: "MERCHANT",
      action: "CAMPAIGN_APPROVED",
      entityType: "Campaign",
      entityId: campaign.id,
      input: {
        campaignId: campaign.id,
        merchantUserId:
          session.user.id,
      },
      output: {
        status:
          updatedCampaign.status,
      },
      status: "SUCCESS",
      reason:
        "Authenticated merchant approved the campaign",
    });

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error(
      "Campaign approval error:",
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
          "Unable to approve campaign",
      },
      { status: 500 }
    );
  }
}