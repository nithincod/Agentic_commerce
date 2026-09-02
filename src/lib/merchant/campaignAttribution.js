import prisma from "@/lib/db/prisma";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

/**
 * Attribute a PAID order to a campaign.
 *
 * Attribution rules:
 *
 * 1. If the order is already attributed, return the
 *    existing attribution.
 *
 * 2. Prefer LAST-TOUCH campaign exposure when one exists.
 *
 * 3. If there is no eligible exposure, fall back to the
 *    active campaign that targets one of the purchased
 *    products.
 *
 *    This is important for purchases made directly from
 *    the Buyer Offers section, because the Offers page
 *    currently does not create a CampaignExposure record.
 *
 * 4. Every order gets its own CampaignExposure.
 *
 *    This allows:
 *
 *      Order A -> Exposure A
 *      Order B -> Exposure B
 *
 *    instead of allowing one exposure to represent only
 *    one purchase.
 */
export async function attributeOrderToCampaign({
  orderId,
  userId,
}) {
  if (!orderId || !userId) {
    return {
      attributed: false,
      reason: "orderId and userId are required",
    };
  }

  /**
   * --------------------------------------------------
   * 1. Load authoritative order
   * --------------------------------------------------
   */
  const order =
    await prisma.order.findUnique({
      where: {
        id: orderId,
      },

      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                merchantId: true,
              },
            },
          },
        },

        campaignExposure: true,
      },
    });

  if (!order) {
    return {
      attributed: false,
      reason: "Order not found",
    };
  }

  /**
   * --------------------------------------------------
   * 2. Ownership validation
   * --------------------------------------------------
   */
  if (order.userId !== userId) {
    return {
      attributed: false,
      reason:
        "Order does not belong to authenticated buyer",
    };
  }

  /**
   * --------------------------------------------------
   * 3. Only PAID orders can be attributed
   * --------------------------------------------------
   */
  if (order.status !== "PAID") {
    return {
      attributed: false,
      reason:
        "Only paid orders can be attributed",
    };
  }

  /**
   * --------------------------------------------------
   * 4. Idempotency
   *
   * If this order already has an exposure, do not
   * create another one.
   * --------------------------------------------------
   */
  if (order.campaignExposure) {
    return {
      attributed: true,
      alreadyAttributed: true,

      campaignId:
        order.campaignExposure.campaignId,

      exposureId:
        order.campaignExposure.id,

      attributedRevenue:
        order.totalAmount,
    };
  }

  /**
   * --------------------------------------------------
   * 5. Determine merchant
   * --------------------------------------------------
   */
  const merchantIds = [
    ...new Set(
      order.items
        .map(
          (item) =>
            item.product?.merchantId
        )
        .filter(Boolean)
    ),
  ];

  if (merchantIds.length !== 1) {
    return {
      attributed: false,
      reason:
        "Order must belong to exactly one merchant",
    };
  }

  const merchantId =
    merchantIds[0];

  const productIds =
    order.items
      .map(
        (item) =>
          item.product?.id
      )
      .filter(Boolean);

  if (productIds.length === 0) {
    return {
      attributed: false,
      reason:
        "Order contains no merchant products",
    };
  }

  /**
   * --------------------------------------------------
   * 6. LAST-TOUCH EXPOSURE
   *
   * Prefer an existing campaign exposure for this buyer.
   * --------------------------------------------------
   */
  const exposure =
    await prisma.campaignExposure.findFirst({
      where: {
        userId,

        orderId: null,

        convertedAt: null,

        exposedAt: {
          lte: order.createdAt,
        },

        campaign: {
          merchantId,

          status: "ACTIVE",

          targets: {
            some: {
              productId: {
                in: productIds,
              },

              role: "TARGET",
            },
          },
        },
      },

      orderBy: {
        exposedAt: "desc",
      },
    });

  /**
   * --------------------------------------------------
   * 7. If no exposure exists, use CampaignTarget
   *
   * This is the critical fix for purchases made from
   * the Offers section.
   * --------------------------------------------------
   */
  let campaignId =
    exposure?.campaignId || null;

  if (!campaignId) {
    const campaignTarget =
      await prisma.campaignTarget.findFirst({
        where: {
          productId: {
            in: productIds,
          },

          role: "TARGET",

          campaign: {
            merchantId,

            status: "ACTIVE",
          },
        },

        include: {
          campaign: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (campaignTarget) {
      campaignId =
        campaignTarget.campaignId;
    }
  }

  /**
   * --------------------------------------------------
   * 8. No campaign found
   * --------------------------------------------------
   */
  if (!campaignId) {
    return {
      attributed: false,
      reason:
        "No eligible campaign found for purchased products",
    };
  }

  /**
   * --------------------------------------------------
   * 9. Create/convert an exposure
   *
   * IMPORTANT:
   *
   * If we found an existing exposure, convert it.
   *
   * If we did not find one, create a NEW exposure and
   * immediately convert it.
   *
   * This means every order can have its own exposure.
   * --------------------------------------------------
   */
  try {
    const conversion =
      await prisma.$transaction(
        async (tx) => {
          /**
           * ------------------------------------------------
           * Existing exposure
           * ------------------------------------------------
           */
          if (exposure) {
            const lockedExposure =
              await tx.campaignExposure.findUnique({
                where: {
                  id: exposure.id,
                },

                include: {
                  campaign: true,
                },
              });

            if (
              !lockedExposure
            ) {
              throw new Error(
                "Campaign exposure not found"
              );
            }

            /**
             * Another request may have already
             * converted this exposure.
             *
             * Do not reuse it for another order.
             */
            if (
              lockedExposure.orderId ||
              lockedExposure.convertedAt
            ) {
              return null;
            }

            return await tx.campaignExposure.update({
              where: {
                id:
                  lockedExposure.id,
              },

              data: {
                orderId,

                convertedAt:
                  order.createdAt,
              },
            });
          }

          /**
           * ------------------------------------------------
           * No exposure existed.
           *
           * Create one specifically for this purchase.
           * ------------------------------------------------
           */
          return await tx.campaignExposure.create({
            data: {
              campaignId,

              userId,

              exposedAt:
                order.createdAt,

              orderId,

              convertedAt:
                order.createdAt,
            },
          });
        }
      );

    /**
     * --------------------------------------------------
     * 10. Existing exposure was already consumed
     *
     * Create a fresh conversion exposure for this order.
     *
     * This fixes:
     *
     *     first purchase = counted
     *     second purchase = ignored
     * --------------------------------------------------
     */
    if (!conversion) {
      const existingOrderExposure =
        await prisma.campaignExposure.findUnique({
          where: {
            orderId,
          },
        });

      if (existingOrderExposure) {
        return {
          attributed: true,
          alreadyAttributed: true,

          campaignId:
            existingOrderExposure.campaignId,

          exposureId:
            existingOrderExposure.id,

          attributedRevenue:
            order.totalAmount,
        };
      }

      const retryExposure =
        await prisma.campaignExposure.create({
          data: {
            campaignId,

            userId,

            exposedAt:
              order.createdAt,

            orderId,

            convertedAt:
              order.createdAt,
          },
        });

      await recordAgentAction({
        agentType:
          "MERCHANT_AGENT",

        action:
          "CAMPAIGN_CONVERSION_ATTRIBUTED",

        entityType:
          "Campaign",

        entityId:
          retryExposure.campaignId,

        input: {
          campaignId:
            retryExposure.campaignId,

          exposureId:
            retryExposure.id,

          userId,

          orderId,
        },

        output: {
          conversionId:
            retryExposure.id,

          attributedRevenue:
            order.totalAmount,

          attributionModel:
            "LAST_TOUCH_WITH_PRODUCT_TARGET_FALLBACK",
        },

        status:
          "SUCCESS",

        reason:
          "Paid order attributed using a new conversion exposure",
      });

      return {
        attributed: true,

        alreadyAttributed: false,

        campaignId:
          retryExposure.campaignId,

        exposureId:
          retryExposure.id,

        conversionId:
          retryExposure.id,

        attributedRevenue:
          order.totalAmount,
      };
    }

    /**
     * --------------------------------------------------
     * 11. Audit successful attribution
     * --------------------------------------------------
     */
    await recordAgentAction({
      agentType:
        "MERCHANT_AGENT",

      action:
        "CAMPAIGN_CONVERSION_ATTRIBUTED",

      entityType:
        "Campaign",

      entityId:
        conversion.campaignId,

      input: {
        campaignId:
          conversion.campaignId,

        exposureId:
          conversion.id,

        userId,

        orderId,
      },

      output: {
        conversionId:
          conversion.id,

        attributedRevenue:
          order.totalAmount,

        attributionModel:
          exposure
            ? "LAST_TOUCH"
            : "PRODUCT_TARGET_FALLBACK",
      },

      status:
        "SUCCESS",

      reason:
        exposure
          ? "Paid order attributed to most recent eligible active campaign exposure"
          : "Paid order attributed to active campaign targeting a purchased offer product",
    });

    return {
      attributed: true,

      alreadyAttributed: false,

      campaignId:
        conversion.campaignId,

      exposureId:
        conversion.id,

      conversionId:
        conversion.id,

      attributedRevenue:
        order.totalAmount,
    };
  } catch (error) {
    /**
     * --------------------------------------------------
     * P2002 = order was attributed concurrently
     * --------------------------------------------------
     */
    if (
      error?.code === "P2002"
    ) {
      const existing =
        await prisma.campaignExposure.findUnique({
          where: {
            orderId,
          },
        });

      if (existing) {
        return {
          attributed: true,
          alreadyAttributed: true,

          campaignId:
            existing.campaignId,

          exposureId:
            existing.id,

          attributedRevenue:
            order.totalAmount,
        };
      }

      /**
       * If the unique orderId conflict was caused by
       * another exposure race, retry with a fresh
       * exposure for this order.
       */
      try {
        const retryExposure =
          await prisma.campaignExposure.create({
            data: {
              campaignId,

              userId,

              exposedAt:
                order.createdAt,

              orderId,

              convertedAt:
                order.createdAt,
            },
          });

        return {
          attributed: true,

          alreadyAttributed: false,

          campaignId:
            retryExposure.campaignId,

          exposureId:
            retryExposure.id,

          conversionId:
            retryExposure.id,

          attributedRevenue:
            order.totalAmount,
        };
      } catch (retryError) {
        console.error(
          "Campaign attribution retry failed:",
          retryError
        );
      }
    }

    console.error(
      "Campaign attribution error:",
      error
    );

    await recordAgentAction({
      agentType:
        "MERCHANT_AGENT",

      action:
        "CAMPAIGN_ATTRIBUTION_FAILED",

      entityType:
        "Order",

      entityId:
        orderId,

      input: {
        orderId,

        userId,
      },

      status:
        "FAILED",

      reason:
        error.message ||
        "Campaign attribution failed",
    });

    return {
      attributed: false,

      reason:
        error.message ||
        "Campaign attribution failed",
    };
  }
}