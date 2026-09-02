import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from "@langchain/langgraph";

import {
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";

import { tool } from "@langchain/core/tools";
import { z } from "zod";

import model from "@/lib/ai/model";

import {
  searchProducts,
  getProduct,
  checkInventory,
} from "@/lib/tools/productTools";

import {
  createCartTool,
} from "@/lib/tools/cartTools";

import {
  createCheckoutTool,
} from "@/lib/tools/checkoutTools";

import {
  createOfferTools,
} from "@/lib/tools/offerTools";

import {
  requestOffersFromRevenueAgent,
} from "@/lib/agents/agentToAgent";

import {
  requireBuyer,
} from "@/lib/auth/authorization";


/* ==================================================
   STATE
   ================================================== */

const BuyerState =
  new StateSchema({
    messages: MessagesValue,
  });


/* ==================================================
   CREATE BUYER GRAPH
   ================================================== */

export function createBuyerGraph(userId) {
  if (!userId) {
    throw new Error(
      "userId is required to create buyer graph"
    );
  }


  /* ------------------------------------------------
     USER-SCOPED TOOLS
     ------------------------------------------------ */

  const cartTool =
    createCartTool(userId);

  const checkoutTool =
    createCheckoutTool(userId);

  const offerTools =
    createOfferTools(userId);


  /* ------------------------------------------------
     A2A OFFER TOOL
     ------------------------------------------------

     IMPORTANT:
     This MUST be a LangChain tool().
     Do NOT use a plain object with
     name / description / invoke.
     ------------------------------------------------ */

  const requestMerchantOffer = tool(
    async ({ message }) => {
      if (
        !message ||
        typeof message !== "string" ||
        !message.trim()
      ) {
        throw new Error(
          "Offer request message is required"
        );
      }

      try {
        const result =
          await requestOffersFromRevenueAgent({
            userId,
            message: message.trim(),
          });

        return typeof result === "string"
          ? result
          : JSON.stringify(result);
      } catch (error) {
        console.error(
          "request_merchant_offer error:",
          error
        );

        return JSON.stringify({
          success: false,
          error:
            error?.message ||
            "Unable to request merchant offer",
        });
      }
    },
    {
      name: "request_merchant_offer",

      description: `
Ask merchant Revenue Agents for relevant
offers based on the authenticated buyer's
shopping request.

Use this when the customer is looking for:
- offers
- deals
- promotions
- discounts
- better alternatives
- merchant campaigns

Do not invent offers, campaign IDs,
product IDs, prices, discounts, or inventory.
`,

      schema: z.object({
        message: z
          .string()
          .min(1)
          .describe(
            "The buyer's shopping request or offer request"
          ),
      }),
    }
  );


  /* ------------------------------------------------
     ONLY THESE TOOLS ARE EXPOSED TO THE LLM
     ------------------------------------------------ */

  const tools = [
    searchProducts,
    getProduct,
    checkInventory,
    cartTool,
    checkoutTool,
    ...offerTools,
    requestMerchantOffer,
  ];


  /* ------------------------------------------------
     SAFETY CHECK
     ------------------------------------------------

     Every item passed to bindTools() must be an
     actual LangChain tool.

     This catches accidental plain objects before
     they reach Gemini.
     ------------------------------------------------ */

  for (const [index, currentTool] of
    tools.entries()) {
    if (
      !currentTool ||
      typeof currentTool.invoke !== "function" ||
      typeof currentTool.name !== "string" ||
      typeof currentTool.description !== "string"
    ) {
      throw new Error(
        `Invalid Buyer Agent tool at index ${index}: ` +
        `${currentTool?.name || "unknown"}`
      );
    }
  }


  /* ------------------------------------------------
     BIND TOOLS
     ------------------------------------------------ */

  const modelWithTools =
    model.bindTools(tools);


  /* ==================================================
     MODEL NODE
     ================================================== */

  async function callModel(state) {
    const response =
      await modelWithTools.invoke([
        {
          role: "system",

          content: `
You are AgentPay's Buyer Agent.

Your job is to help the authenticated
customer with shopping.

You can:

- discover products
- compare products
- understand offers
- ask merchant Revenue Agents for offers
- add products to the customer's cart
- create checkout when the customer explicitly
  wants to purchase


==================================================
IDENTITY RULES
==================================================

The application has already authenticated
the customer.

Never ask the customer for a userId.

Never invent a userId.

Never modify a userId.

Never attempt to access another customer's
resources.

The application controls customer identity.


==================================================
PRODUCT RULES
==================================================

Always use product tools for product information.

Never invent:

- product names
- product IDs
- prices
- inventory
- product descriptions

If the customer specifies a maximum budget,
respect it.

Verify inventory before adding a product
to the cart.


==================================================
CART RULES
==================================================

Only add a product when the customer explicitly
asks to buy it or add it to the cart.

Use the exact productId returned by product
tools.

Never invent a productId.

Never invent a cartId.

Never modify another customer's cart.


==================================================
OFFER RULES
==================================================

When the customer asks about:

- offers
- discounts
- promotions
- deals
- campaigns

use:

get_available_offers

when appropriate.

You may also use:

request_merchant_offer

when a merchant-specific or personalized
offer should be requested.

Never invent:

- campaign IDs
- discounts
- offer names
- prices
- merchant names


==================================================
A2A OFFER RULES
==================================================

request_merchant_offer communicates with
merchant Revenue Agents.

Use it when the customer is asking for:

- a better deal
- merchant offers
- personalized offers
- promotions
- campaign-based recommendations

The Revenue Agent is the source of truth
for merchant campaign information.

Never invent the response from a Revenue Agent.

Only present information actually returned
by the A2A request.


==================================================
CHECKOUT RULES
==================================================

Only create checkout when the customer explicitly
wants to proceed with the purchase.

Use the cartId returned by create_cart.

Never invent a cartId.

Never calculate or invent the final payment amount.

create_checkout calculates the authoritative
amount from PostgreSQL.

Never modify the amount returned by
create_checkout.

Never create checkout for a cart the customer
does not own.


==================================================
PAYMENT RULES
==================================================

Do not perform payment directly.

Do not mark payments as successful.

Do not invent payment status.

Do not perform refunds.

Payment authorization is handled by the
dedicated payment workflow.


==================================================
IMPORTANT SHOPPING BEHAVIOR
==================================================

If the customer says something ambiguous like:

"ok lets do it"

do NOT immediately create checkout unless
the conversation clearly establishes what
the customer wants to purchase.

If a specific product has already been discussed
and the customer clearly means to purchase it,
you may add it to the cart.

However, checkout still requires explicit
purchase/checkout intent.

Examples:

"Add the RGB Gaming Mouse to my cart"
=> add to cart.

"I want to buy the RGB Gaming Mouse"
=> add to cart.

"Proceed to checkout"
=> create checkout.

"Pay for it"
=> create checkout if the cart/product
context is unambiguous.

"Show me offers"
=> check offers / request merchant offers.

"Can you get me a better deal?"
=> request merchant offer.


==================================================
SOURCE OF TRUTH
==================================================

Backend tool results are the source of truth.

Never fabricate database state.

Clearly explain important actions.

Require explicit customer intent before
financial actions.
`,
        },

        ...state.messages,
      ]);

    return {
      messages: [response],
    };
  }


  /* ==================================================
     TOOL EXECUTION
     ================================================== */

  async function executeTools(state) {
    const lastMessage =
      state.messages[
        state.messages.length - 1
      ];


    if (
      !AIMessage.isInstance(lastMessage)
    ) {
      return {
        messages: [],
      };
    }


    const toolResults = [];


    for (const toolCall of
      lastMessage.tool_calls ?? []) {

      const selectedTool =
        tools.find(
          (currentTool) =>
            currentTool.name ===
            toolCall.name
        );


      if (!selectedTool) {
        throw new Error(
          `Unknown tool: ${toolCall.name}`
        );
      }


      /* --------------------------------------------
         IMPORTANT

         LangChain tool.invoke() expects the tool
         arguments, NOT the complete toolCall.
         -------------------------------------------- */

      let result;

      try {
        result =
          await selectedTool.invoke(
            toolCall.args ?? {}
          );
      } catch (error) {
        console.error(
          `Tool execution failed: ${toolCall.name}`,
          error
        );

        result = JSON.stringify({
          success: false,
          error:
            error?.message ||
            `Tool ${toolCall.name} failed`,
        });
      }


      /* --------------------------------------------
         Convert result into ToolMessage so the
         model can continue the conversation.
         -------------------------------------------- */

      toolResults.push(
        new ToolMessage({
          content:
            typeof result === "string"
              ? result
              : JSON.stringify(result),

          tool_call_id:
            toolCall.id,
        })
      );
    }


    return {
      messages: toolResults,
    };
  }


  /* ==================================================
     SHOULD CONTINUE
     ================================================== */

  function shouldContinue(state) {
    const lastMessage =
      state.messages[
        state.messages.length - 1
      ];


    if (
      AIMessage.isInstance(lastMessage) &&
      lastMessage.tool_calls?.length
    ) {
      return "tools";
    }


    return END;
  }


  /* ==================================================
     BUILD GRAPH
     ================================================== */

  return new StateGraph(BuyerState)

    .addNode(
      "agent",
      callModel
    )

    .addNode(
      "tools",
      executeTools
    )

    .addEdge(
      START,
      "agent"
    )

    .addConditionalEdges(
      "agent",
      shouldContinue,
      [
        "tools",
        END,
      ]
    )

    .addEdge(
      "tools",
      "agent"
    )

    .compile();
}


/* ==================================================
   RUN BUYER AGENT
   ================================================== */

export async function runBuyerAgent(message) {
  if (
    !message ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    throw new Error(
      "Message is required"
    );
  }


  /* ----------------------------------------------
     Authentication happens on the server.

     The browser does NOT provide userId.
     ---------------------------------------------- */

  const session =
    await requireBuyer();


  const userId =
    session.user.id;


  /* ----------------------------------------------
     Create graph scoped to authenticated buyer.
     ---------------------------------------------- */

  const buyerGraph =
    createBuyerGraph(userId);


  /* ----------------------------------------------
     Execute graph.
     ---------------------------------------------- */

  const result =
    await buyerGraph.invoke({
      messages: [
        {
          role: "user",
          content: message.trim(),
        },
      ],
    });


  return result;
}