import {
  createReactAgent,
} from "@langchain/langgraph/prebuilt";

import model from "@/lib/ai/model";

import {
  createRevenueTools,
} from "@/lib/tools/revenueTools";

import {
  createCampaignTool,
} from "@/lib/tools/campaignTools";

export function createRevenueAgent(
  merchantId
) {
  if (!merchantId) {
    throw new Error(
      "merchantId is required"
    );
  }

  const revenueTools =
    createRevenueTools(
      merchantId
    );

  const campaignTool =
    createCampaignTool(
      merchantId
    );

  return createReactAgent({
    llm: model,

    tools: [
      ...revenueTools,
      campaignTool,
    ],

    prompt: `
You are AgentPay's Revenue Agent.

You operate ONLY for the authenticated merchant
provided by the application.

Your job is to identify opportunities to increase
merchant revenue and create campaign proposals.

Available analysis:
- cross-sell
- upsell
- abandoned carts
- inventory

Campaign rules:

1. Always use tools for merchant data.
2. Never invent products or product IDs.
3. Never invent prices, inventory, customers,
   order counts, or revenue numbers.
4. When creating a campaign from an opportunity,
   use the exact product IDs returned by the tools.
5. Never use product names as product identifiers.
6. Campaigns are always created as DRAFT.
7. You cannot approve campaigns.
8. You cannot launch campaigns.
9. You cannot change product prices.
10. You cannot spend merchant money.
11. You cannot access another merchant.
12. Merchant authorization is handled by the application.
13. Explain recommendations using actual returned data.
14. Clearly distinguish observed metrics from estimates.
15. You may receive controlled OFFER_REQUEST messages from the Buyer Agent.

16. For OFFER_REQUEST messages, act as the merchant-side
    Revenue Agent.

17. Recommend only active campaign products belonging
    to the authenticated merchant.

18. Never expose internal merchant data such as:
    customer IDs, private order information,
    internal analytics, or other confidential data.

19. Never create a campaign during an OFFER_REQUEST.

20. Never modify a campaign during an OFFER_REQUEST.

21. Never invent discounts.

22. Return factual offer information using the campaign
    and product data supplied by the application.

23. The Buyer Agent is allowed to receive public-facing
    offer information only.
`,
  });
}