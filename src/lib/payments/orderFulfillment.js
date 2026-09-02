import prisma from "@/lib/db/prisma";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

import {
  attributeOrderToCampaign,
} from "@/lib/merchant/campaignAttribution";

/**
 * Fulfill a successfully paid checkout.
 *
 * This is the SINGLE order-fulfillment path used by:
 *
 * - browser payment completion
 * - Razorpay webhook
 *
 * The function is intentionally idempotent.
 */
export async function fulfillPaidCheckout({
  checkoutId,
  razorpayPaymentId = null,
}) {
  if (!checkoutId) {
    throw new Error(
      "checkoutId is required"
    );
  }

  /*
   * --------------------------------------------------
   * 1. Load authoritative checkout state
   * --------------------------------------------------
   */
  const checkout =
    await prisma.checkout.findUnique({
      where: {
        id: checkoutId,
      },

      include: {
        cart: {
          include: {
            user: true,

            items: {
              include: {
                product: true,
              },
            },
          },
        },

        payments: {
          orderBy: {
            attempt: "desc",
          },
        },
      },
    });

  if (!checkout) {
    throw new Error(
      "CHECKOUT_NOT_FOUND"
    );
  }

  if (!checkout.cart) {
    throw new Error(
      "CHECKOUT_CART_NOT_FOUND"
    );
  }

  /*
   * --------------------------------------------------
   * 2. Find the payment associated with the checkout
   * --------------------------------------------------
   */
  let payment = null;

  if (razorpayPaymentId) {
    payment =
      checkout.payments.find(
        (item) =>
          item.razorpayPaymentId ===
          razorpayPaymentId
      ) || null;
  }

  if (!payment) {
    payment =
      checkout.payments.find(
        (item) =>
          [
            "VERIFIED",
            "CAPTURED",
          ].includes(item.status)
      ) || null;
  }

  if (!payment) {
    throw new Error(
      "VERIFIED_PAYMENT_NOT_FOUND"
    );
  }

  /*
   * --------------------------------------------------
   * 3. Idempotency
   *
   * If the payment already has an order, the financial
   * transaction has already been fulfilled.
   * --------------------------------------------------
   */
  if (payment.orderId) {
    const existingOrder =
      await prisma.order.findUnique({
        where: {
          id:
            payment.orderId,
        },

        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

    if (existingOrder) {
      let campaignAttribution =
        null;

      try {
        campaignAttribution =
          await attributeOrderToCampaign({
            orderId:
              existingOrder.id,

            userId:
              checkout.cart.userId,
          });
      } catch (error) {
        console.error(
          "Existing order campaign attribution error:",
          error
        );
      }

      return {
        alreadyCreated: true,

        order:
          existingOrder,

        payment,

        campaignAttribution,
      };
    }
  }

  /*
   * --------------------------------------------------
   * 4. Validate cart
   * --------------------------------------------------
   */
  if (
    checkout.cart.items.length ===
    0
  ) {
    throw new Error(
      "CART_EMPTY"
    );
  }

  /*
   * --------------------------------------------------
   * 5. Recalculate authoritative total
   * --------------------------------------------------
   */
  let calculatedTotal = 0;

  for (
    const item of
      checkout.cart.items
  ) {
    if (!item.product) {
      throw new Error(
        "PRODUCT_NOT_FOUND"
      );
    }

    if (!item.product.active) {
      throw new Error(
        `${item.product.name} is no longer available`
      );
    }

    if (
      !Number.isInteger(
        item.quantity
      ) ||
      item.quantity <= 0
    ) {
      throw new Error(
        `Invalid quantity for ${item.product.name}`
      );
    }

    calculatedTotal +=
      item.product.price *
      item.quantity;
  }

  /*
   * --------------------------------------------------
   * 6. Verify checkout amount
   * --------------------------------------------------
   */
  if (
    calculatedTotal !==
    checkout.amount
  ) {
    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "ORDER_FULFILLMENT_BLOCKED",

      entityType:
        "Checkout",

      entityId:
        checkout.id,

      input: {
        checkoutId:
          checkout.id,

        storedAmount:
          checkout.amount,

        calculatedAmount:
          calculatedTotal,
      },

      status:
        "BLOCKED",

      reason:
        "Checkout amount does not match current cart",
    });

    throw new Error(
      "CHECKOUT_AMOUNT_MISMATCH"
    );
  }

  /*
   * --------------------------------------------------
   * 7. Atomically:
   *
   * - re-check inventory
   * - create order
   * - decrement inventory
   * - link payment
   * - complete checkout
   * - convert cart
   * --------------------------------------------------
   */
  const order =
    await prisma.$transaction(
      async (tx) => {
        /*
         * Re-read inventory inside transaction.
         */
        for (
          const item of
            checkout.cart.items
        ) {
          const product =
            await tx.product.findUnique({
              where: {
                id:
                  item.productId,
              },
            });

          if (!product) {
            throw new Error(
              `${item.product.name} no longer exists`
            );
          }

          if (!product.active) {
            throw new Error(
              `${product.name} is no longer available`
            );
          }

          if (
            product.inventory <
            item.quantity
          ) {
            throw new Error(
              `Insufficient inventory for ${product.name}`
            );
          }
        }

        /*
         * Make sure no order already exists for this
         * payment before creating a new one.
         */
        const currentPayment =
          await tx.payment.findUnique({
            where: {
              id:
                payment.id,
            },
          });

        if (
          currentPayment?.orderId
        ) {
          const existing =
            await tx.order.findUnique({
              where: {
                id:
                  currentPayment.orderId,
              },

              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            });

          if (existing) {
            return existing;
          }
        }

        /*
         * Create the internal paid order.
         */
        const createdOrder =
          await tx.order.create({
            data: {
              userId:
                checkout.cart.userId,

              totalAmount:
                calculatedTotal,

              currency:
                checkout.currency,

              status:
                "PAID",

              items: {
                create:
                  checkout.cart.items.map(
                    (item) => ({
                      productId:
                        item.productId,

                      quantity:
                        item.quantity,

                      price:
                        item.product.price,
                    })
                  ),
              },
            },

            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          });

        /*
         * Safely decrement inventory.
         *
         * updateMany + inventory >= quantity prevents
         * negative inventory under concurrent purchases.
         */
        for (
          const item of
            checkout.cart.items
        ) {
          const result =
            await tx.product.updateMany({
              where: {
                id:
                  item.productId,

                inventory: {
                  gte:
                    item.quantity,
                },
              },

              data: {
                inventory: {
                  decrement:
                    item.quantity,
                },
              },
            });

          if (
            result.count !== 1
          ) {
            throw new Error(
              `Inventory changed while fulfilling ${item.product.name}`
            );
          }
        }

        /*
         * Mark the payment captured and attach order.
         */
        await tx.payment.update({
          where: {
            id:
              payment.id,
          },

          data: {
            orderId:
              createdOrder.id,

            status:
              "CAPTURED",

            ...(razorpayPaymentId
              ? {
                  razorpayPaymentId,
                }
              : {}),
          },
        });

        /*
         * Complete checkout.
         */
        await tx.checkout.update({
          where: {
            id:
              checkout.id,
          },

          data: {
            status:
              "COMPLETED",
          },
        });

        /*
         * Convert cart.
         */
        await tx.cart.update({
          where: {
            id:
              checkout.cartId,
          },

          data: {
            status:
              "CONVERTED",
          },
        });

        return createdOrder;
      }
    );

  /*
   * --------------------------------------------------
   * 8. Audit order creation
   * --------------------------------------------------
   */
  await recordAgentAction({
    agentType:
      "PAYMENT_AGENT",

    action:
      "ORDER_CREATED",

    entityType:
      "Order",

    entityId:
      order.id,

    input: {
      checkoutId:
        checkout.id,

      paymentId:
        payment.id,

      razorpayPaymentId,

      userId:
        checkout.cart.userId,
    },

    output: {
      orderId:
        order.id,

      totalAmount:
        order.totalAmount,

      status:
        order.status,

      itemCount:
        order.items.length,
    },

    status:
      "SUCCESS",

    reason:
      "Verified Razorpay payment fulfilled into paid order",
  });

  /*
   * --------------------------------------------------
   * 9. Audit inventory update
   * --------------------------------------------------
   */
  await recordAgentAction({
    agentType:
      "MERCHANT_AGENT",

    action:
      "INVENTORY_UPDATED",

    entityType:
      "Order",

    entityId:
      order.id,

    output: {
      items:
        order.items.map(
          (item) => ({
            productId:
              item.productId,

            quantity:
              item.quantity,
          })
        ),
    },

    status:
      "SUCCESS",

    reason:
      "Inventory decremented during paid-order fulfillment",
  });

  /*
   * --------------------------------------------------
   * 10. Campaign attribution
   * --------------------------------------------------
   *
   * Attribution failure must not undo a successful
   * financial transaction.
   */
  let campaignAttribution =
    null;

  try {
    campaignAttribution =
      await attributeOrderToCampaign({
        orderId:
          order.id,

        userId:
          checkout.cart.userId,
      });
  } catch (error) {
    console.error(
      "Campaign attribution error:",
      error
    );

    await recordAgentAction({
      agentType:
        "MERCHANT_AGENT",

      action:
        "CAMPAIGN_ATTRIBUTION_FAILED",

      entityType:
        "Order",

      entityId:
        order.id,

      input: {
        orderId:
          order.id,

        userId:
          checkout.cart.userId,
      },

      status:
        "FAILED",

      reason:
        error.message ||
        "Campaign attribution failed",
    });
  }

  return {
    alreadyCreated: false,

    order,

    payment,

    campaignAttribution,
  };
}