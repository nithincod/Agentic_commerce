import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";

import {
  requireBuyer,
} from "@/lib/auth/authorization";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

export async function POST(
  request,
  { params }
) {
  try {
    const session =
      await requireBuyer();

    const { id: campaignId } =
      await params;

    /*
     * Campaign must be active.
     */
    const campaign =
      await prisma.campaign.findFirst({
        where: {
          id: campaignId,

          status: "ACTIVE",
        },
      });

    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Active campaign not found",
        },
        { status: 404 }
      );
    }


    /*
     * The customer is always the authenticated user.
     *
     * The browser does NOT supply userId.
     */
    const userId =
      session.user.id;

    /*
     * Prevent duplicate exposure for the
     * same campaign/customer interaction.
     */
    const existing =
      await prisma.campaignExposure.findFirst({
        where: {
          campaignId,
          userId,

          convertedAt: null,

          orderId: null,
        },

        orderBy: {
          exposedAt: "desc",
        },
      });

    if (existing) {
      return NextResponse.json({
        success: true,

        alreadyRecorded: true,

        exposure: existing,
      });
    }

    const exposure =
      await prisma.campaignExposure.create({
        data: {
          campaignId,

          userId,
        },
      });

    await recordAgentAction({
      agentType:
        "MERCHANT_AGENT",

      action:
        "CAMPAIGN_EXPOSURE_RECORDED",

      entityType:
        "Campaign",

      entityId:
        campaignId,

      input: {
        campaignId,

        userId,
      },

      output: {
        exposureId:
          exposure.id,

        exposedAt:
          exposure.exposedAt,
      },

      status:
        "SUCCESS",

      reason:
        "Authenticated buyer was exposed to an active campaign",
    });

    return NextResponse.json({
      success: true,

      alreadyRecorded: false,

      exposure,
    });
  } catch (error) {
    console.error(
      "Campaign exposure error:",
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

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Unable to record campaign exposure",
      },
      { status: 500 }
    );
  }
}