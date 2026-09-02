import { tool } from "@langchain/core/tools";
import { z } from "zod";

import prisma from "@/lib/db/prisma";
import { recordAgentAction } from "@/lib/audit/auditLog";

/**
 * Create a campaign draft for one authenticated merchant.
 *
 * IMPORTANT:
 * - merchantId is supplied by the server when the tool is created.
 * - Gemini cannot choose the merchant.
 * - sourceProductId / targetProductId are validated against
 *   the same merchant.
 * - The campaign is ALWAYS created as DRAFT.
 * - The Revenue Agent cannot approve or launch the campaign.
 */
export function createCampaignTool(merchantId) {
  if (!merchantId) {
    throw new Error(
      "merchantId is required to create campaign tool"
    );
  }

  return tool(
    async ({
      name,
      type,
      description,
      targetAudience,
      discountPercent,
      budget,
      expectedRevenue,
      sourceProductId,
      targetProductId,
    }) => {
      try {
        /*
         * --------------------------------------------------
         * Validate financial/business limits
         * --------------------------------------------------
         */

        if (
          !name ||
          !name.trim()
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Campaign name is required",
          });
        }

        if (
          !type ||
          !type.trim()
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Campaign type is required",
          });
        }

        if (
          !description ||
          !description.trim()
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Campaign description is required",
          });
        }

        if (
          !targetAudience ||
          !targetAudience.trim()
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Target audience is required",
          });
        }

        if (
          !Number.isInteger(
            discountPercent
          ) ||
          discountPercent < 0 ||
          discountPercent > 15
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Discount must be between 0% and 15%",
          });
        }

        if (
          !Number.isInteger(budget) ||
          budget < 0
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Campaign budget must be a non-negative integer",
          });
        }

        if (
          !Number.isInteger(
            expectedRevenue
          ) ||
          expectedRevenue < 0
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Expected revenue must be a non-negative integer",
          });
        }

        /*
         * --------------------------------------------------
         * Validate source product
         * --------------------------------------------------
         *
         * If supplied, it MUST belong to this merchant.
         */

        let sourceProduct = null;

        if (sourceProductId) {
          sourceProduct =
            await prisma.product.findFirst({
              where: {
                id: sourceProductId,
                merchantId,
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

          if (!sourceProduct) {
            return JSON.stringify({
              success: false,
              error:
                "Source product not found in merchant catalog",
            });
          }
        }

        /*
         * --------------------------------------------------
         * Validate target product
         * --------------------------------------------------
         */

        let targetProduct = null;

        if (targetProductId) {
          targetProduct =
            await prisma.product.findFirst({
              where: {
                id: targetProductId,
                merchantId,
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

          if (!targetProduct) {
            return JSON.stringify({
              success: false,
              error:
                "Target product not found in merchant catalog",
            });
          }
        }

        /*
         * A source and target product should not be
         * identical.
         */
        if (
          sourceProductId &&
          targetProductId &&
          sourceProductId ===
            targetProductId
        ) {
          return JSON.stringify({
            success: false,
            error:
              "Source and target products must be different",
          });
        }

        /*
         * --------------------------------------------------
         * Prepare campaign targets
         * --------------------------------------------------
         */

        const targets = [];

        if (sourceProduct) {
          targets.push({
            productId:
              sourceProduct.id,

            role: "SOURCE",
          });
        }

        if (targetProduct) {
          targets.push({
            productId:
              targetProduct.id,

            role: "TARGET",
          });
        }

        /*
         * --------------------------------------------------
         * Create campaign + target relationships
         *
         * Everything is created atomically.
         * --------------------------------------------------
         */

        const campaign =
          await prisma.campaign.create({
            data: {
              merchantId,

              name:
                name.trim(),

              type:
                type.trim(),

              description:
                description.trim(),

              targetAudience:
                targetAudience.trim(),

              discountPercent,

              budget,

              expectedRevenue,

              status:
                "DRAFT",

              targets: {
                create:
                  targets,
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

        /*
         * --------------------------------------------------
         * Audit proposal
         * --------------------------------------------------
         */

        await recordAgentAction({
          agentType:
            "REVENUE_AGENT",

          action:
            "CAMPAIGN_PROPOSED",

          entityType:
            "Campaign",

          entityId:
            campaign.id,

          input: {
            merchantId,

            name:
              campaign.name,

            type:
              campaign.type,

            sourceProductId:
              sourceProductId ||
              null,

            targetProductId:
              targetProductId ||
              null,

            discountPercent,

            budget,

            expectedRevenue,
          },

          output: {
            campaignId:
              campaign.id,

            status:
              campaign.status,

            targets:
              campaign.targets.map(
                (target) => ({
                  productId:
                    target.productId,

                  productName:
                    target.product.name,

                  role:
                    target.role,
                })
              ),
          },

          status:
            "SUCCESS",

          reason:
            "Revenue Agent created a merchant-scoped campaign draft",
        });

        /*
         * --------------------------------------------------
         * Return structured result
         * --------------------------------------------------
         */

        return JSON.stringify({
          success: true,

          campaign: {
            id:
              campaign.id,

            merchantId:
              campaign.merchantId,

            name:
              campaign.name,

            type:
              campaign.type,

            status:
              campaign.status,

            description:
              campaign.description,

            targetAudience:
              campaign.targetAudience,

            discountPercent:
              campaign.discountPercent,

            budget:
              campaign.budget,

            expectedRevenue:
              campaign.expectedRevenue,

            targets:
              campaign.targets.map(
                (target) => ({
                  productId:
                    target.productId,

                  role:
                    target.role,

                  product: {
                    id:
                      target.product.id,

                    name:
                      target.product.name,

                    category:
                      target.product.category,

                    price:
                      target.product.price,

                    currency:
                      target.product.currency,

                    inventory:
                      target.product.inventory,
                  },
                })
              ),

            createdAt:
              campaign.createdAt,
          },
        });
      } catch (error) {
        console.error(
          "create_campaign error:",
          error
        );

        /*
         * Never expose internal Prisma errors
         * directly to the LLM/user.
         */
        return JSON.stringify({
          success: false,
          error:
            "Unable to create campaign proposal",
        });
      }
    },

    {
      name:
        "create_campaign",

      description:
        "Create a DRAFT campaign for the authenticated merchant. Optionally associate source and target products from the merchant's own catalog. Never approve or launch the campaign.",

      schema: z.object({
        name: z
          .string()
          .describe(
            "Name of the proposed campaign"
          ),

        type: z
          .string()
          .describe(
            "Campaign type such as CROSS_SELL, UPSELL, RECOVERY, or INVENTORY"
          ),

        description: z
          .string()
          .describe(
            "Explanation of what the campaign will do"
          ),

        targetAudience: z
          .string()
          .describe(
            "Description of the customers the campaign targets"
          ),

        discountPercent: z
          .number()
          .int()
          .min(0)
          .max(15)
          .describe(
            "Discount percentage between 0 and 15"
          ),

        budget: z
          .number()
          .int()
          .min(0)
          .describe(
            "Maximum campaign budget in INR"
          ),

        expectedRevenue: z
          .number()
          .int()
          .min(0)
          .describe(
            "Estimated incremental revenue in INR"
          ),

        sourceProductId: z
          .string()
          .optional()
          .describe(
            "Optional source product ID from the merchant catalog"
          ),

        targetProductId: z
          .string()
          .optional()
          .describe(
            "Optional target product ID from the merchant catalog"
          ),
      }),
    }
  );
}