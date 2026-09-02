import prisma from "@/lib/db/prisma";

/**
 * Calculate performance for a merchant-owned campaign.
 *
 * Attribution model:
 * LAST_TOUCH
 *
 * All metrics originate from PostgreSQL.
 */
export async function getCampaignPerformance(
  campaignId,
  merchantId
) {
  const campaign =
    await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        merchantId,
      },

      include: {
        exposures: {
          orderBy: {
            exposedAt: "asc",
          },

          select: {
            id: true,
            userId: true,
            exposedAt: true,
            convertedAt: true,
            orderId: true,
          },
        },
      },
    });

  if (!campaign) {
    throw new Error(
      "CAMPAIGN_NOT_FOUND"
    );
  }

  /*
   * Exposure count.
   */
  const exposureCount =
    campaign.exposures.length;

  /*
   * Valid attributed conversions.
   */
  const convertedExposures =
    campaign.exposures.filter(
      (exposure) =>
        exposure.convertedAt !== null &&
        exposure.orderId !== null
    );

  /*
   * A UNIQUE(orderId) constraint guarantees that
   * an order can only appear once here.
   */
  const orderIds = [
    ...new Set(
      convertedExposures
        .map(
          (exposure) =>
            exposure.orderId
        )
        .filter(Boolean)
    ),
  ];

  let attributedOrders = [];
  let attributedRevenue = 0;

  if (orderIds.length > 0) {
    attributedOrders =
      await prisma.order.findMany({
        where: {
          id: {
            in: orderIds,
          },

          status: "PAID",

          items: {
            some: {
              product: {
                merchantId,
              },
            },
          },
        },

        select: {
          id: true,
          userId: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
        },
      });

    attributedRevenue =
      attributedOrders.reduce(
        (sum, order) =>
          sum + order.totalAmount,
        0
      );
  }

  const conversionCount =
    attributedOrders.length;

  const conversionRate =
    exposureCount > 0
      ? conversionCount /
        exposureCount
      : 0;

  const revenuePerExposure =
    exposureCount > 0
      ? attributedRevenue /
        exposureCount
      : 0;

  const revenuePerConversion =
    conversionCount > 0
      ? attributedRevenue /
        conversionCount
      : 0;

  /*
   * We call this a revenue-to-spend multiple,
   * not accounting ROI.
   */
  const revenueToSpendMultiple =
    campaign.budget > 0
      ? attributedRevenue /
        campaign.budget
      : null;

  const budgetCoveragePercent =
    campaign.budget > 0
      ? (attributedRevenue /
          campaign.budget) *
        100
      : null;

  const expectedRevenue =
    campaign.expectedRevenue ||
    0;

  const expectedRevenueAchievementPercent =
    expectedRevenue > 0
      ? (attributedRevenue /
          expectedRevenue) *
        100
      : null;

  const revenueGap =
    expectedRevenue > 0
      ? attributedRevenue -
        expectedRevenue
      : null;

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,

      budget:
        campaign.budget,

      expectedRevenue:
        campaign.expectedRevenue,

      discountPercent:
        campaign.discountPercent,

      targetAudience:
        campaign.targetAudience,
    },

    attribution: {
      model:
        "LAST_TOUCH",

      description:
        "The most recent eligible active campaign exposure before a paid order receives attribution.",

      uniqueOrderAttribution:
        true,
    },

    performance: {
      exposures:
        exposureCount,

      conversions:
        conversionCount,

      conversionRate:
        Math.round(
          conversionRate * 1000
        ) / 10,

      attributedOrders:
        attributedOrders.length,

      attributedRevenue,

      revenuePerExposure:
        Math.round(
          revenuePerExposure
        ),

      revenuePerConversion:
        Math.round(
          revenuePerConversion
        ),

      revenueToSpendMultiple:
        revenueToSpendMultiple ===
        null
          ? null
          : Math.round(
              revenueToSpendMultiple *
                100
            ) / 100,

      budgetCoveragePercent:
        budgetCoveragePercent ===
        null
          ? null
          : Math.round(
              budgetCoveragePercent *
                10
            ) / 10,

      expectedRevenueAchievementPercent:
        expectedRevenueAchievementPercent ===
        null
          ? null
          : Math.round(
              expectedRevenueAchievementPercent *
                10
            ) / 10,

      revenueGap,
    },

    orders:
      attributedOrders.map(
        (order) => ({
          id: order.id,
          userId: order.userId,
          amount:
            order.totalAmount,
          currency:
            order.currency,
          createdAt:
            order.createdAt,
        })
      ),
  };
}