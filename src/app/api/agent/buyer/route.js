import { NextResponse } from "next/server";

import { requireBuyer } from "@/lib/auth/authorization";
import { runBuyerAgent } from "@/lib/agents/buyerAgent";

export async function POST(request) {
  try {
    // -----------------------------------------
    // 1. AUTHENTICATION
    // -----------------------------------------

    const session = await requireBuyer();

    // -----------------------------------------
    // 2. READ REQUEST
    // -----------------------------------------

    const body = await request.json();
    const message = body?.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "message is required",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 3. RUN BUYER AGENT
    // -----------------------------------------

    const result = await runBuyerAgent(
      message,
      session.user.id
    );

    const messages = result?.messages || [];

    

    // -----------------------------------------
    // 4. FIND FINAL AI RESPONSE
    // -----------------------------------------

    let responseText = "";

    for (let i = messages.length - 1; i >= 0; i--) {
      const current = messages[i];

      const type =
        current?._getType?.() ??
        current?.type;

      if (
        (type === "ai" ||
          current?.role === "assistant") &&
        typeof current?.content === "string" &&
        current.content.trim()
      ) {
        responseText = current.content;
        break;
      }
    }

    // Fallback
    if (!responseText) {
      const lastMessage =
        messages[messages.length - 1];

      if (
        typeof lastMessage?.content === "string"
      ) {
        responseText = lastMessage.content;
      }
    }

    // -----------------------------------------
    // 5. EXTRACT PRODUCTS FROM TOOL RESULTS
    // -----------------------------------------

    const products = [];

    for (const current of messages) {
      const type =
        current?._getType?.() ??
        current?.type;

      // Only inspect tool messages
      if (
        type !== "tool" &&
        current?.role !== "tool"
      ) {
        continue;
      }

      let parsed;

      try {
        if (
          typeof current?.content === "string"
        ) {
          parsed = JSON.parse(
            current.content
          );
        } else {
          parsed = current?.content;
        }
      } catch {
        continue;
      }

      // -----------------------------------------
      // search_products response
      // -----------------------------------------

      if (
        parsed?.success === true &&
        Array.isArray(parsed?.products)
      ) {
        for (const product of parsed.products) {
          if (
            product?.id &&
            product?.name &&
            typeof product?.price === "number"
          ) {
            if (
              !products.some(
                (existing) =>
                  existing.id === product.id
              )
            ) {
              products.push({
                id: product.id,
                name: product.name,
                description:
                  product.description ?? "",
                category:
                  product.category ?? "",
                price: product.price,
                currency:
                  product.currency ?? "INR",
                inventory:
                  product.inventory,
                active:
                  product.active ?? true,
              });
            }
          }
        }
      }

      // -----------------------------------------
      // get_product response
      // -----------------------------------------

      if (
        parsed?.success === true &&
        parsed?.product?.id
      ) {
        const product = parsed.product;

        if (
          !products.some(
            (existing) =>
              existing.id === product.id
          )
        ) {
          products.push({
            id: product.id,
            name: product.name,
            description:
              product.description ?? "",
            category:
              product.category ?? "",
            price: product.price,
            currency:
              product.currency ?? "INR",
            inventory:
              product.inventory,
            active:
              product.active ?? true,
          });
        }
      }
    }

    // -----------------------------------------
    // 6. EXTRACT OFFERS
    // -----------------------------------------

    const offers = [];

    for (const current of messages) {
      const type =
        current?._getType?.() ??
        current?.type;

      if (
        type !== "tool" &&
        current?.role !== "tool"
      ) {
        continue;
      }

      let parsed;

      try {
        if (
          typeof current?.content === "string"
        ) {
          parsed = JSON.parse(
            current.content
          );
        } else {
          parsed = current?.content;
        }
      } catch {
        continue;
      }

      if (
        parsed?.success === true &&
        Array.isArray(parsed?.offers)
      ) {
        for (const offer of parsed.offers) {
          if (
            offer?.campaignId &&
            !offers.some(
              (existing) =>
                existing.campaignId ===
                offer.campaignId
            )
          ) {
            offers.push(offer);
          }
        }
      }
    }

    // -----------------------------------------
    // 7. SERIALIZE MESSAGES
    // -----------------------------------------

    const serializedMessages =
      messages.map((current) => ({
        type:
          current?._getType?.() ??
          current?.type,

        role:
          current?.role ?? null,

        content:
          current?.content ?? "",

        toolCalls:
          current?.tool_calls ?? [],
      }));

    // -----------------------------------------
    // 8. RETURN RESPONSE
    // -----------------------------------------

    return NextResponse.json({
      success: true,

      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },

      // Human-readable AI response
      response: responseText,

      // IMPORTANT:
      // BuyerPage uses this for ProductCard
      products,

      // Offers for future UI
      offers,

      // Full serialized agent messages
      messages: serializedMessages,
    });
  } catch (error) {
    console.error(
      "Buyer agent error:",
      error
    );

    if (
      error?.message ===
      "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required",
        },
        { status: 401 }
      );
    }

    if (
      error?.message ===
      "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Buyer access required",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Buyer agent failed",
      },
      { status: 500 }
    );
  }
}