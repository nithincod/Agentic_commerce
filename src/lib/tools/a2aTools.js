import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
  requestOffersFromRevenueAgent,
} from "@/lib/agents/agentToAgent";

/**
 * Tools used by the Buyer Agent to
 * communicate with other AgentPay agents.
 */
export function createA2ATools(
  userId
) {
  if (!userId) {
    throw new Error(
      "userId is required"
    );
  }

  const requestMerchantOffer =
    tool(
      async ({ message }) => {
        try {
          const result =
            await requestOffersFromRevenueAgent(
              {
                userId,
                message,
              }
            );

          return JSON.stringify(
            result
          );
        } catch (error) {
          console.error(
            "A2A offer tool error:",
            error
          );

          return JSON.stringify({
            success: false,

            type:
              "OFFER_RESPONSE",

            error:
              error?.message ||
              "Unable to contact Revenue Agent",

            responses: [],
          });
        }
      },

      {
        name:
          "request_merchant_offer",

        description: `
Communicate with AgentPay's merchant-side
Revenue Agent.

Use this tool after understanding the
customer's product request to determine
whether a relevant active merchant campaign
exists.

This is an Agent-to-Agent communication tool.

The Revenue Agent evaluates merchant campaigns
and returns public-facing offers.

Never invent:
- campaigns
- campaign IDs
- products
- product IDs
- prices
- discounts
- inventory
        `,

        schema:
          z.object({
            message:
              z
                .string()
                .describe(
                  "The customer's shopping request."
                ),
          }),
      }
    );

  return [
    requestMerchantOffer,
  ];
}