import { tool } from "@langchain/core/tools";
import { z } from "zod";
import prisma from "@/lib/db/prisma";

/**
 * Search products in the merchant catalog.
 *
 * The tool performs deterministic filtering and ranking so the
 * LLM receives relevant commerce data instead of having to
 * decide which database results are valid.
 */
export const searchProducts = tool(
  async ({ query, maxPrice }) => {
    try {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return JSON.stringify({
          success: false,
          products: [],
          error: "Search query cannot be empty",
        });
      }

      if (maxPrice !== undefined && maxPrice <= 0) {
        return JSON.stringify({
          success: false,
          products: [],
          error: "Maximum price must be greater than zero",
        });
      }

      const queryWords = normalizedQuery
        .split(/\s+/)
        .filter(Boolean);

      /*
       * Fetch active products first.
       * Price filtering is deterministic and happens in the DB.
       */
      const products = await prisma.product.findMany({
        where: {
          active: true,

          ...(maxPrice !== undefined && {
            price: {
              lte: maxPrice,
            },
          }),
        },

        take: 50,
      });

      /*
       * Generic words that describe context/category rather than
       * the actual product type.
       *
       * Example:
       * "gaming mouse"
       *
       * "gaming" is contextual.
       * "mouse" is the actual product requested.
       */
      const genericWords = new Set([
        "gaming",
        "best",
        "good",
        "cheap",
        "budget",
        "affordable",
        "wireless",
        "rgb",
      ]);

      const specificWords = queryWords.filter(
        (word) => !genericWords.has(word)
      );

      const rankedProducts = products
        .map((product) => {
          const name = product.name.toLowerCase();
          const description = (
            product.description || ""
          ).toLowerCase();
          const category = product.category.toLowerCase();

          let score = 0;

          for (const word of queryWords) {
            // Strong match in product name
            if (name.includes(word)) {
              score += 5;
            }

            // Description match
            if (description.includes(word)) {
              score += 2;
            }

            // Category match
            if (category.includes(word)) {
              score += 1;
            }
          }

          // Strong boost for an exact phrase in the product name.
          if (name.includes(normalizedQuery)) {
            score += 10;
          }

          return {
            product,
            score,
          };
        })

        .filter(({ score }) => score > 0)

        .sort((a, b) => {
          // Highest relevance first
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          // Cheapest first when relevance is equal
          return a.product.price - b.product.price;
        });

      /*
       * Strict product-type filtering.
       *
       * For:
       * "gaming mouse"
       *
       * We require the specific term "mouse" to appear in
       * the product name. This prevents "Gaming Mouse Pad"
       * from appearing as a primary product result.
       */
      const strictProducts = rankedProducts.filter(
        ({ product }) => {
          const name = product.name.toLowerCase();

          // If the query has no specific product words,
          // use relevance ranking only.
          if (specificWords.length === 0) {
            return true;
          }

          // At least one specific product term must be in
          // the product name.
          return specificWords.some((word) =>
            name.includes(word)
          );
        }
      );

      /*
       * Explicit exclusions for incompatible product types.
       *
       * This gives us another deterministic safeguard for
       * commerce search.
       */
      const excludedTerms = [
        "mouse pad",
        "mousepad",
        "pad",
      ];

      const filteredProducts = strictProducts.filter(
        ({ product }) => {
          const name = product.name.toLowerCase();

          return !excludedTerms.some((term) =>
            name.includes(term)
          );
        }
      );

      const finalProducts = filteredProducts
        .slice(0, 10)
        .map(({ product }) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          price: product.price,
          currency: product.currency,
          inventory: product.inventory,
          active: product.active,
        }));

      return JSON.stringify({
        success: true,
        query: normalizedQuery,
        maxPrice: maxPrice ?? null,
        count: finalProducts.length,
        products: finalProducts,
      });
    } catch (error) {
      console.error("search_products error:", error);

      return JSON.stringify({
        success: false,
        products: [],
        error: "Unable to search products",
      });
    }
  },
  {
    name: "search_products",

    description:
      "Search the merchant catalog for products matching the customer's request. Respect the customer's maximum budget and return only relevant products.",

    schema: z.object({
      query: z
        .string()
        .describe(
          "The specific product or product category the customer wants"
        ),

      maxPrice: z
        .number()
        .optional()
        .describe(
          "Maximum acceptable price in INR"
        ),
    }),
  }
);

/**
 * Get authoritative details for a single product.
 */
export const getProduct = tool(
  async ({ productId }) => {
    try {
      const product = await prisma.product.findUnique({
        where: {
          id: productId,
        },
      });

      if (!product) {
        return JSON.stringify({
          success: false,
          error: "Product not found",
        });
      }

      return JSON.stringify({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          price: product.price,
          currency: product.currency,
          inventory: product.inventory,
          active: product.active,
          createdAt: product.createdAt,
        },
      });
    } catch (error) {
      console.error("get_product error:", error);

      return JSON.stringify({
        success: false,
        error: "Unable to retrieve product",
      });
    }
  },
  {
    name: "get_product",

    description:
      "Get authoritative details for a specific product using its product ID.",

    schema: z.object({
      productId: z
        .string()
        .describe("The product ID"),
    }),
  }
);

/**
 * Check authoritative inventory and current price.
 *
 * This must be called before adding a product to the cart
 * or performing a purchase-related action.
 */
export const checkInventory = tool(
  async ({ productId }) => {
    try {
      const product = await prisma.product.findUnique({
        where: {
          id: productId,
        },

        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          inventory: true,
          active: true,
        },
      });

      if (!product) {
        return JSON.stringify({
          success: false,
          available: false,
          error: "Product not found",
        });
      }

      const available =
        product.active && product.inventory > 0;

      return JSON.stringify({
        success: true,
        available,
        productId: product.id,
        productName: product.name,
        price: product.price,
        currency: product.currency,
        inventory: product.inventory,
        active: product.active,
      });
    } catch (error) {
      console.error("check_inventory error:", error);

      return JSON.stringify({
        success: false,
        available: false,
        error: "Unable to check inventory",
      });
    }
  },
  {
    name: "check_inventory",

    description:
      "Check the authoritative current inventory and price of a product. Always use this before recommending or purchasing a product.",

    schema: z.object({
      productId: z
        .string()
        .describe("The product ID"),
    }),
  }
);

export const productTools = [
  searchProducts,
  getProduct,
  checkInventory,
];