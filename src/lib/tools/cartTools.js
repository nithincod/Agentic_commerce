import { tool } from "@langchain/core/tools";
import { z } from "zod";

import prisma from "@/lib/db/prisma";

/**
 * Create a cart tool bound to one authenticated buyer.
 *
 * userId is supplied by the server from Auth.js.
 * Gemini never controls the user identity.
 */
export function createCartTool(userId) {
  if (!userId) {
    throw new Error(
      "userId is required to create cart tool"
    );
  }

  return tool(
    async ({
      productId,
      quantity = 1,
    }) => {
      try {
        if (!productId) {
          return JSON.stringify({
            success: false,
            error:
              "productId is required",
          });
        }

        if (
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {
          return JSON.stringify({
            success: false,
            error:
              "quantity must be a positive integer",
          });
        }

        /*
         * --------------------------------------------------
         * 1. Load product from PostgreSQL.
         * --------------------------------------------------
         */
        const product =
          await prisma.product.findUnique({
            where: {
              id: productId,
            },
          });

        if (!product) {
          return JSON.stringify({
            success: false,
            error:
              "Product not found",
          });
        }

        if (!product.active) {
          return JSON.stringify({
            success: false,
            error:
              "Product is not available",
          });
        }

        if (
          product.inventory <
          quantity
        ) {
          return JSON.stringify({
            success: false,
            error:
              `Only ${product.inventory} units are available`,
          });
        }

        /*
         * --------------------------------------------------
         * 2. Find the authenticated buyer's active cart.
         * --------------------------------------------------
         */
        let cart =
          await prisma.cart.findFirst({
            where: {
              userId,

              status:
                "ACTIVE",
            },

            include: {
              items: true,
            },

            orderBy: {
              createdAt:
                "desc",
            },
          });

        /*
         * --------------------------------------------------
         * 3. Create cart if none exists.
         * --------------------------------------------------
         */
        if (!cart) {
          cart =
            await prisma.cart.create({
              data: {
                userId,

                status:
                  "ACTIVE",
              },

              include: {
                items: true,
              },
            });
        }

        /*
         * --------------------------------------------------
         * 4. Check whether the product is already present.
         * --------------------------------------------------
         */
        const existingItem =
          cart.items.find(
            (item) =>
              item.productId ===
              productId
          );

        let cartItem;

        if (existingItem) {
          const newQuantity =
            existingItem.quantity +
            quantity;

          if (
            newQuantity >
            product.inventory
          ) {
            return JSON.stringify({
              success: false,

              error:
                `Cannot add ${quantity} more units. Only ${product.inventory} units are available.`,
            });
          }

          cartItem =
            await prisma.cartItem.update({
              where: {
                id:
                  existingItem.id,
              },

              data: {
                quantity:
                  newQuantity,
              },
            });
        } else {
          cartItem =
            await prisma.cartItem.create({
              data: {
                cartId:
                  cart.id,

                productId,

                quantity,
              },
            });
        }

        /*
         * --------------------------------------------------
         * 5. Return authoritative current cart state.
         * --------------------------------------------------
         */
        const updatedCart =
          await prisma.cart.findUnique({
            where: {
              id:
                cart.id,
            },

            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          });

        return JSON.stringify({
          success: true,

          cart: {
            id:
              updatedCart.id,

            userId:
              updatedCart.userId,

            status:
              updatedCart.status,

            items:
              updatedCart.items.map(
                (item) => ({
                  id:
                    item.id,

                  productId:
                    item.productId,

                  name:
                    item.product.name,

                  price:
                    item.product.price,

                  currency:
                    item.product.currency,

                  quantity:
                    item.quantity,

                  subtotal:
                    item.product.price *
                    item.quantity,
                })
              ),
          },

          added: {
            productId,

            quantity,

            cartItemId:
              cartItem.id,
          },
        });
      } catch (error) {
        console.error(
          "create_cart error:",
          error
        );

        return JSON.stringify({
          success: false,

          error:
            error.message ||
            "Unable to update cart",
        });
      }
    },

    {
      name:
        "create_cart",

      description:
        "Add a product to the authenticated buyer's active cart. The buyer identity is controlled by the server.",

      schema: z.object({
        productId: z
          .string()
          .describe(
            "Product ID returned by a product tool"
          ),

        quantity: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe(
            "Quantity to add"
          ),
      }),
    }
  );
}