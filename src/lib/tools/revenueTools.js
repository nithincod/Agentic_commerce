import { tool } from "@langchain/core/tools";
import { z } from "zod";

import prisma from "@/lib/db/prisma";

/*
 * Revenue tools are bound to ONE merchant.
 *
 * The merchantId comes from authenticated server-side
 * authorization, not from Gemini and not from the browser.
 */
export async function getMerchantRevenueSummary(
  merchantId
) {
  if (!merchantId) {
    throw new Error(
      "merchantId is required"
    );
  }

  const orders =
    await prisma.order.findMany({
      where: {
        status: "PAID",

        items: {
          some: {
            product: {
              merchantId,
            },
          },
        },
      },

      select: {
        id: true,
        createdAt: true,

        items: {
          where: {
            product: {
              merchantId,
            },
          },

          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const merchantOrders =
    orders.map((order) => ({
      id: order.id,

      createdAt:
        order.createdAt,

      amount:
        order.items.reduce(
          (sum, item) =>
            sum +
            Number(item.price) *
              item.quantity,
          0
        ),
    }));

  const totalRevenue =
    merchantOrders.reduce(
      (sum, order) =>
        sum + order.amount,
      0
    );

  const last30DaysStart =
    new Date();

  last30DaysStart.setDate(
    last30DaysStart.getDate() - 30
  );

  const last30DaysOrders =
    merchantOrders.filter(
      (order) =>
        order.createdAt >=
        last30DaysStart
    );

  const last30DaysRevenue =
    last30DaysOrders.reduce(
      (sum, order) =>
        sum + order.amount,
      0
    );

  return {
    success: true,

    totalRevenue,

    paidOrders:
      merchantOrders.length,

    last30DaysRevenue,

    last30DaysOrders:
      last30DaysOrders.length,

    recentOrders:
      merchantOrders.slice(
        0,
        10
      ),
  };
}
export function createRevenueTools(
  merchantId
) {
  const findCrossSellOpportunities =
    tool(
      async () => {
        try {
          const orderItems =
            await prisma.orderItem.findMany({
              where: {
                order: {
                  status: "PAID",
                },
                product: {
                  merchantId,
                },
              },

              include: {
                product: true,

                order: {
                  select: {
                    id: true,
                    userId: true,
                  },
                },
              },
            });

          const productCustomers =
            new Map();

          for (const item of orderItems) {
            if (
              !productCustomers.has(
                item.productId
              )
            ) {
              productCustomers.set(
                item.productId,
                new Set()
              );
            }

            productCustomers
              .get(item.productId)
              .add(item.order.userId);
          }

          const productIds =
            [...productCustomers.keys()];

          const products =
            await prisma.product.findMany({
              where: {
                merchantId,

                id: {
                  in: productIds,
                },

                active: true,
              },
            });

          const productMap =
            new Map(
              products.map((product) => [
                product.id,
                product,
              ])
            );

          const opportunities = [];

          for (
            let i = 0;
            i < productIds.length;
            i++
          ) {
            for (
              let j = 0;
              j < productIds.length;
              j++
            ) {
              if (i === j) {
                continue;
              }

              const sourceId =
                productIds[i];

              const targetId =
                productIds[j];

              const sourceCustomers =
                productCustomers.get(
                  sourceId
                );

              const targetCustomers =
                productCustomers.get(
                  targetId
                );

              const sourceProduct =
                productMap.get(sourceId);

              const targetProduct =
                productMap.get(targetId);

              if (
                !sourceProduct ||
                !targetProduct
              ) {
                continue;
              }

              if (
                sourceCustomers.size < 2
              ) {
                continue;
              }

              const boughtBoth =
                new Set(
                  [...sourceCustomers].filter(
                    (customerId) =>
                      targetCustomers.has(
                        customerId
                      )
                  )
                );

              const attachmentRate =
                boughtBoth.size /
                sourceCustomers.size;

              if (
                attachmentRate >= 0.8
              ) {
                continue;
              }

              const missingCustomers =
                sourceCustomers.size -
                boughtBoth.size;

              const potentialRevenue =
                missingCustomers *
                targetProduct.price;

              if (
                potentialRevenue <= 0
              ) {
                continue;
              }

              opportunities.push({
                type: "CROSS_SELL",

                sourceProduct: {
                  id: sourceProduct.id,
                  name: sourceProduct.name,
                  category:
                    sourceProduct.category,
                  price:
                    sourceProduct.price,
                },

                targetProduct: {
                  id: targetProduct.id,
                  name: targetProduct.name,
                  category:
                    targetProduct.category,
                  price:
                    targetProduct.price,
                },

                customersBuyingSource:
                  sourceCustomers.size,

                customersBuyingBoth:
                  boughtBoth.size,

                attachmentRatePercent:
                  Math.round(
                    attachmentRate * 100
                  ),

                missingCustomers,

                potentialRevenue:
                  Math.round(
                    potentialRevenue
                  ),

                confidence:
                  sourceCustomers.size >=
                  5
                    ? "HIGH"
                    : sourceCustomers.size >=
                        3
                      ? "MEDIUM"
                      : "LOW",
              });
            }
          }

          /*
           * Keep the strongest opportunities.
           */
          opportunities.sort(
            (a, b) =>
              b.potentialRevenue -
              a.potentialRevenue
          );

          return JSON.stringify({
            success: true,
            count:
              opportunities.length,

            opportunities:
              opportunities.slice(
                0,
                20
              ),
          });
        } catch (error) {
          console.error(
            "Cross-sell error:",
            error
          );

          return JSON.stringify({
            success: false,
            count: 0,
            opportunities: [],
            error:
              "Unable to calculate cross-sell opportunities",
          });
        }
      },
      {
        name:
          "find_cross_sell_opportunities",

        description:
          "Find cross-sell opportunities using purchase behavior from the authenticated merchant's catalog only.",

        schema:
          z.object({}),
      }
    );

  const findUpsellOpportunities =
    tool(
      async () => {
        try {
          const products =
            await prisma.product.findMany({
              where: {
                merchantId,
                active: true,
              },

              orderBy: {
                price: "asc",
              },
            });

          const purchased =
  await prisma.orderItem.findMany({
    where: {
      order: {
        status: "PAID",
      },

      product: {
        merchantId,
      },
    },

    select: {
      productId: true,
    },

    distinct: [
      "productId",
    ],
  });

          const purchasedIds =
            new Set(
              purchased.map(
                (item) =>
                  item.productId
              )
            );

          const opportunities = [];

          for (
            const baseProduct of products
          ) {
            if (
              !purchasedIds.has(
                baseProduct.id
              )
            ) {
              continue;
            }

            const premium =
              products
                .filter(
                  (candidate) =>
                    candidate.category ===
                      baseProduct.category &&
                    candidate.price >
                      baseProduct.price &&
                    candidate.id !==
                      baseProduct.id
                )
                .sort(
                  (a, b) =>
                    a.price - b.price
                )[0];

            if (!premium) {
              continue;
            }

            opportunities.push({
              type: "UPSELL",

              baseProduct: {
                id: baseProduct.id,
                name: baseProduct.name,
                category:
                  baseProduct.category,
                price:
                  baseProduct.price,
              },

              targetProduct: {
                id: premium.id,
                name: premium.name,
                category:
                  premium.category,
                price:
                  premium.price,
              },

              incrementalRevenue:
                premium.price -
                baseProduct.price,

              recommendation:
                `Present ${premium.name} as a premium alternative to ${baseProduct.name}.`,
            });
          }

          return JSON.stringify({
            success: true,
            count:
              opportunities.length,
            opportunities:
              opportunities.slice(
                0,
                20
              ),
          });
        } catch (error) {
          console.error(
            "Upsell error:",
            error
          );

          return JSON.stringify({
            success: false,
            count: 0,
            opportunities: [],
          });
        }
      },
      {
        name:
          "find_upsell_opportunities",

        description:
          "Find upsell opportunities within the authenticated merchant's own product catalog.",

        schema:
          z.object({}),
      }
    );

  const findAbandonedCartOpportunities =
    tool(
      async () => {
        try {
          const carts =
            await prisma.cart.findMany({
              where: {
                status:
                  "ABANDONED",

                items: {
                  some: {
                    product: {
                      merchantId,
                    },
                  },
                },
              },

              include: {
                user: true,

                items: {
                  where: {
                    product: {
                      merchantId,
                    },
                  },

                  include: {
                    product: true,
                  },
                },
              },

              take: 100,
            });

          const opportunities =
            carts
              .filter(
                (cart) =>
                  cart.items.length > 0
              )
              .map((cart) => {
                const cartValue =
                  cart.items.reduce(
                    (sum, item) =>
                      sum +
                      item.product.price *
                        item.quantity,
                    0
                  );

                return {
                  type:
                    "ABANDONED_CART",

                  cartId:
                    cart.id,

                  customer: {
                    id: cart.userId,
                    name: cart.user.name,
                  },

                  products:
                    cart.items.map(
                      (item) => ({
                        id:
                          item.product.id,

                        name:
                          item.product.name,

                        price:
                          item.product.price,

                        quantity:
                          item.quantity,
                      })
                    ),

                  cartValue,

                  recommendation:
                    "Send a personalized recovery message based on the abandoned cart.",
                };
              });

          const totalRecoverableRevenue =
            opportunities.reduce(
              (sum, item) =>
                sum + item.cartValue,
              0
            );

          return JSON.stringify({
            success: true,

            count:
              opportunities.length,

            totalRecoverableRevenue,

            opportunities,
          });
        } catch (error) {
          console.error(
            "Abandoned cart error:",
            error
          );

          return JSON.stringify({
            success: false,
            count: 0,
            totalRecoverableRevenue: 0,
            opportunities: [],
          });
        }
      },
      {
        name:
          "find_abandoned_cart_opportunities",

        description:
          "Find abandoned carts containing products belonging to the authenticated merchant.",

        schema:
          z.object({}),
      }
    );

  const findInventoryOpportunities =
    tool(
      async () => {
        try {
          const products =
            await prisma.product.findMany({
              where: {
                merchantId,
                active: true,

                inventory: {
                  gte: 20,
                },
              },

              orderBy: {
                inventory:
                  "desc",
              },

              take: 50,
            });

          return JSON.stringify({
            success: true,

            count:
              products.length,

            opportunities:
              products.map(
                (product) => ({
                  type: "INVENTORY",

                  productId:
                    product.id,

                  productName:
                    product.name,

                  category:
                    product.category,

                  inventory:
                    product.inventory,

                  price:
                    product.price,

                  inventoryValue:
                    product.inventory *
                    product.price,

                  recommendation:
                    "Consider a targeted promotion, bundle, or campaign to improve inventory turnover.",
                })
              ),
          });
        } catch (error) {
          console.error(
            "Inventory error:",
            error
          );

          return JSON.stringify({
            success: false,
            count: 0,
            opportunities: [],
          });
        }
      },
      {
        name:
          "find_inventory_opportunities",

        description:
          "Find high-inventory products belonging to the authenticated merchant.",

        schema:
          z.object({}),
      }
    );

  return [
    findCrossSellOpportunities,
    findUpsellOpportunities,
    findAbandonedCartOpportunities,
    findInventoryOpportunities,
  ];
}