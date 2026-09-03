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

          merchant: campaign.merchant
            ? {
                id:
                  campaign
                    .merchant.id,

                name:
                  campaign
                    .merchant.name,
              }
            : null,

          products:
            campaign.targets
              .filter(
                (target) =>
                  target.role ===
                    "TARGET" &&
                  target.product
                    .active &&
                  target.product
                    .inventory > 0
              )
              .map(
                (target) => ({
                  id:
                    target.product
                      .id,

                  name:
                    target.product
                      .name,

                  description:
                    target.product
                      .description,

                  category:
                    target.product
                      .category,

                  price:
                    target.product
                      .price,

                  currency:
                    target.product
                      .currency,

                  inventory:
                    target.product
                      .inventory,
                })
              ),
        })
      );

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
  campaignContext,
  null,
  2
)}

Your task:

1. Determine whether any campaign is relevant
   to the buyer request.

2. If relevant, recommend the best campaign.

3. Only use campaigns and products supplied
   above.

4. Never invent products, IDs, prices,
   discounts, inventory or campaign IDs.

5. Do not create or modify campaigns.

6. Do not expose private merchant analytics.

7. Return a concise customer-facing explanation.

If there is no relevant campaign, return exactly:

NO_RELEVANT_OFFER

If there is a relevant campaign, return:

RELEVANT_CAMPAIGN_ID: <exact campaignId>

Then give a concise customer-facing explanation
containing:

- campaign name
- merchant name
- target product
- price
- relevant explanation

Only use a campaignId supplied in the campaign
context.

Never invent a campaignId.
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
    
    const campaignIdMatch =
  revenueMessage.match(
    /RELEVANT_CAMPAIGN_ID:\s*([^\s]+)/i
  );

const relevantCampaignId =
  campaignIdMatch?.[1] || null;    

    /*
     * Determine whether the Revenue Agent
     * found an actual relevant offer.
     */
    const hasRelevantOffer =
  !revenueMessage
    .toLowerCase()
    .includes("no_relevant_offer");

const structuredOffers =
  hasRelevantOffer && relevantCampaignId
    ? campaignContext
        .filter(
          (campaign) =>
            campaign.campaignId ===
              relevantCampaignId &&
            campaign.products?.length > 0
        )
        .map((campaign) => ({
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
        }))
    : [];

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

  return {
    success: true,

    type:
      "OFFER_RESPONSE",

    buyerId:
      userId,

    responses,
  };
}