import prisma from "@/lib/db/prisma";

import {
  createRevenueAgent,
} from "@/lib/agents/revenueAgent";

/**
 * Buyer Agent -> Revenue Agent
 *
 * This is the Agent-to-Agent communication layer.
 *
 * The Buyer Agent provides:
 * - authenticated buyer ID
 * - natural-language shopping request
 *
 * The Revenue Agent evaluates merchant campaigns.
 *
 * Only public-facing campaign/product information
 * is returned to the Buyer Agent.
 */

export async function requestOffersFromRevenueAgent({
  userId,
  message,
}) {
  if (!userId) {
    throw new Error(
      "userId is required"
    );
  }

  if (
    !message ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    throw new Error(
      "Message is required"
    );
  }

  /*
   * Get currently active campaigns.
   *
   * The browser never supplies merchantId.
   */

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

      take: 20,
    });

  if (!campaigns.length) {
    return {
      success: true,

      type:
        "OFFER_RESPONSE",

      buyerId:
        userId,

      responses: [],

      offers: [],
    };
  }

  /*
   * Group campaigns by merchant.
   */

  const merchantIds = [
    ...new Set(
      campaigns
        .map(
          (campaign) =>
            campaign.merchantId
        )
        .filter(Boolean)
    ),
  ];

  const responses = [];

  /*
   * Ask each relevant merchant-side
   * Revenue Agent to evaluate the request.
   */

  for (
    const merchantId of merchantIds
  ) {
    const merchantCampaigns =
      campaigns.filter(
        (campaign) =>
          campaign.merchantId ===
          merchantId
      );

    if (
      !merchantCampaigns.length
    ) {
      continue;
    }

    const revenueAgent =
      createRevenueAgent(
        merchantId
      );

    /*
     * Give the Revenue Agent only the
     * campaign information it needs.
     */

    const campaignContext =
      merchantCampaigns.map(
        (campaign) => ({
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

          products:
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
                })
              ),
        })
      );

    /*
     * Remove campaigns with no available
     * target products.
     */

    const usableCampaigns =
      campaignContext.filter(
        (campaign) =>
          campaign.products?.length > 0
      );

    if (
      !usableCampaigns.length
    ) {
      continue;
    }

    /*
     * Ask Revenue Agent to identify relevant
     * campaigns.
     */

    const result =
      await revenueAgent.invoke({
        messages: [
          {
            role: "user",

            content: `
AGENT-TO-AGENT REQUEST

Request type:
OFFER_REQUEST

Buyer request:
${message.trim()}

Active campaigns belonging to this merchant:

${JSON.stringify(
  usableCampaigns,
  null,
  2
)}

Your task:

1. Determine whether any supplied campaign is
   relevant to the buyer request.

2. If relevant, recommend only the relevant
   campaign(s).

3. Use ONLY the campaign and product information
   supplied above.

4. Never invent products, IDs, prices,
   discounts, inventory or campaign IDs.

5. Do not create or modify campaigns.

6. Do not expose private merchant analytics.

7. Return a concise customer-facing explanation.

IMPORTANT:

If there is no relevant campaign, respond exactly:

NO_RELEVANT_OFFER

If there is a relevant campaign, respond exactly
using this structure for each relevant offer:

RELEVANT_OFFERS

campaignId: <exact campaign ID>
campaignName: <exact campaign name>
merchantName: <exact merchant name>
productId: <exact product ID>
productName: <exact product name>
price: <exact product price>
discountPercent: <exact discount percentage>
description: <short customer-facing explanation>

Only use information supplied above.
`,
          },
        ],
      });

    const messages =
      result?.messages || [];

    const lastMessage =
      messages[
        messages.length - 1
      ];

    const revenueMessage =
      typeof lastMessage?.content ===
      "string"
        ? lastMessage.content
        : "";

    /*
     * If Revenue Agent says there is no
     * relevant offer, skip this merchant.
     */

    if (
      revenueMessage
        .toLowerCase()
        .includes(
          "no_relevant_offer"
        )
    ) {
      continue;
    }

    /*
     * Extract campaign IDs mentioned by
     * Revenue Agent.
     *
     * We validate every ID against the
     * actual database-backed context.
     */

    const relevantCampaignIds = [
      ...revenueMessage.matchAll(
        /campaignId:\s*([^\s]+)/gi
      ),
    ].map(
      (match) =>
        match[1].trim()
    );

    /*
     * If the agent didn't return campaign IDs,
     * do not trust it enough to expose offers.
     */

    if (
      !relevantCampaignIds.length
    ) {
      continue;
    }

    /*
     * Validate campaign IDs against the
     * campaigns actually supplied to the
     * Revenue Agent.
     */

    const structuredOffers =
      usableCampaigns

        .filter(
          (campaign) =>
            relevantCampaignIds.includes(
              campaign.campaignId
            )
        )

        .map(
          (campaign) => ({
            campaignId:
              campaign.campaignId,

            campaignName:
              campaign.campaignName,

            type:
              campaign.type,

            description:
              campaign.description,

            discountPercent:
              campaign.discountPercent,

            merchant:
              campaign.merchant,

            products:
              campaign.products,
          })
        );

    if (
      structuredOffers.length
    ) {
      responses.push({
        merchantId,

        message:
          revenueMessage,

        offers:
          structuredOffers,
      });
    }
  }

  /*
   * IMPORTANT:
   *
   * Flatten all merchant responses into
   * one top-level offers array.
   *
   * This is what the Buyer API/frontend
   * will consume for OfferCard rendering.
   */

  const offers =
    responses.flatMap(
      (response) =>
        response.offers || []
    );

  return {
    success: true,

    type:
      "OFFER_RESPONSE",

    buyerId:
      userId,

    responses,

    offers,
  };
}