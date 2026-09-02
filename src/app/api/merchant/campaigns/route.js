import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import { requireMerchant } from "@/lib/auth/merchant";
import { recordAgentAction } from "@/lib/audit/auditLog";

export async function GET() {
  try {
    const { merchant } = await requireMerchant();

    const campaigns = await prisma.campaign.findMany({
      where: {
        merchantId: merchant.id,
      },
      include: {
        targets: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
                currency: true,
                inventory: true,
                active: true,
              },
            },
          },
        },
        _count: {
          select: {
            exposures: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      campaigns,
    });
  } catch (error) {
    console.error("Campaign listing error:", error);

    if (error.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    if (
      error.message === "FORBIDDEN" ||
      error.message === "MERCHANT_NOT_FOUND"
    ) {
      return NextResponse.json(
        { success: false, error: "Merchant access required" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to load campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { session, merchant } = await requireMerchant();
    const body = await request.json();

    const name = body?.name?.trim();
    const type = body?.type?.trim();
    const description = body?.description?.trim() || "";
    const targetAudience = body?.targetAudience?.trim() || "";
    const discountPercent = Number(body?.discountPercent);
    const budget = Number(body?.budget);
    const expectedRevenue = Number(body?.expectedRevenue);
    const sourceProductId = body?.sourceProductId || null;
    const targetProductId = body?.targetProductId || null;
    const targetProductIds = Array.isArray(body?.targetProductIds)
      ? body.targetProductIds.filter(Boolean)
      : [];

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Campaign name is required" },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { success: false, error: "Campaign type is required" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 15) {
      return NextResponse.json(
        { success: false, error: "Discount must be an integer between 0% and 15%" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(budget) || budget < 0) {
      return NextResponse.json(
        { success: false, error: "Budget must be a non-negative integer" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(expectedRevenue) || expectedRevenue < 0) {
      return NextResponse.json(
        { success: false, error: "Expected revenue must be a non-negative integer" },
        { status: 400 }
      );
    }

    if (!description || !targetAudience) {
      return NextResponse.json(
        { success: false, error: "Description and target audience are required" },
        { status: 400 }
      );
    }

    const normalizedTargetIds = [
      ...new Set([
        ...targetProductIds,
        ...(targetProductId ? [targetProductId] : []),
      ]),
    ];

    if (sourceProductId && normalizedTargetIds.includes(sourceProductId)) {
      return NextResponse.json(
        { success: false, error: "Source and target products must be different" },
        { status: 400 }
      );
    }

    const requestedProductIds = [
      ...new Set([
        ...(sourceProductId ? [sourceProductId] : []),
        ...normalizedTargetIds,
      ]),
    ];

    let products = [];

    if (requestedProductIds.length > 0) {
      products = await prisma.product.findMany({
        where: {
          id: { in: requestedProductIds },
          merchantId: merchant.id,
          active: true,
        },
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          currency: true,
          inventory: true,
        },
      });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const productId of requestedProductIds) {
      if (!productMap.has(productId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Product ${productId} was not found in your active catalog`,
          },
          { status: 400 }
        );
      }
    }

    const targets = [];

    if (sourceProductId) {
      targets.push({
        productId: sourceProductId,
        role: "SOURCE",
      });
    }

    for (const productId of normalizedTargetIds) {
      targets.push({
        productId,
        role: "TARGET",
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        merchantId: merchant.id,
        name,
        type,
        description,
        targetAudience,
        discountPercent,
        budget,
        expectedRevenue,
        status: "DRAFT",
        targets: {
          create: targets,
        },
      },
      include: {
        targets: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                price: true,
                currency: true,
                inventory: true,
              },
            },
          },
        },
      },
    });

    await recordAgentAction({
      agentType: "MERCHANT_AGENT",
      action: "CAMPAIGN_PROPOSED",
      entityType: "Campaign",
      entityId: campaign.id,
      input: {
        merchantId: merchant.id,
        merchantUserId: session.user.id,
        name,
        type,
        sourceProductId,
        targetProductIds: normalizedTargetIds,
        discountPercent,
        budget,
        expectedRevenue,
      },
      output: {
        campaignId: campaign.id,
        status: campaign.status,
        targets: campaign.targets.map((target) => ({
          productId: target.productId,
          role: target.role,
          productName: target.product.name,
        })),
      },
      status: "SUCCESS",
      reason: "Authenticated merchant created a campaign draft from a revenue opportunity",
    });

    return NextResponse.json(
      {
        success: true,
        campaign,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Campaign creation error:", error);

    if (error.message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    if (
      error.message === "FORBIDDEN" ||
      error.message === "MERCHANT_NOT_FOUND"
    ) {
      return NextResponse.json(
        { success: false, error: "Merchant access required" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unable to create campaign",
      },
      { status: 500 }
    );
  }
}
