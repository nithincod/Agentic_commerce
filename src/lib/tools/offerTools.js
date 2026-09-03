import { tool } from "@langchain/core/tools";
import { z } from "zod";

import prisma from "@/lib/db/prisma";

export function createOfferTools(
  userId
) {
  if (!userId) {
    throw new Error(
      "userId is required"
    );
  }

  const getAvailableOffers =
    tool(
      async () => {
        try {
          const campaigns =
            await prisma.campaign.findMany({
              where: {
                status: "ACTIVE",
              },

              include: {
                merchant: true,

                targets: {
                  include: {
                    product: true,
                  },
                },
              },

              orderBy: {
                createdAt: "desc",
              },
            });

          const offers = [];

          for (
            const campaign of campaigns
          ) {
            const products =
              campaign.targets

                .filter(
                  (target) =>
                    target.role ===
                      "TARGET" &&
                    target.product &&
                    target.product.active &&
                    target.product.inventory >
                      0
                )

                .map(
                  (target) => ({
                    id:
                      target.product.id,

                    name:
                      target.product.name,

                    description:
                      target.product.description,

                    category:
                      target.product.category,

                    price:
                      target.product.price,

                    currency:
                      target.product.currency,

                    inventory:
                      target.product.inventory,

                    active:
                      target.product.active,
                  })
                );

            if (
              !products.length
            ) {
              continue;
            }

            offers.push({
              campaignId:
                campaign.id,

              campaignName:
                campaign.name,

              type:
                campaign.type,

              description:
                campaign.description,

              discountPercent:
                campaign.discountPercent,

              merchant:
                campaign.merchant
                  ? {
                      id:
                        campaign.merchant.id,

                      name:
                        campaign.merchant.name,
                    }
                  : null,

              products,
            });
          }

          return JSON.stringify({
            success: true,

            count:
              offers.length,

            offers,
          });
        } catch (error) {
          console.error(
            "get_available_offers error:",
            error
          );

          return JSON.stringify({
            success: false,

            count: 0,

            offers: [],

            error:
              "Unable to retrieve available offers",
          });
        }
      },

      {
        name:
          "get_available_offers",

        description:
          `
Find currently active merchant offers
available to the authenticated buyer.

Use this when the buyer explicitly asks
to see offers, deals, discounts, promotions,
or campaigns.
`,

        schema:
          z.object({}),
      }
    );

  return [
    getAvailableOffers,
  ];
}