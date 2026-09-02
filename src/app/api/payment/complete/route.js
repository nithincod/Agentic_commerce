import { NextResponse } from "next/server";

import {
  requireBuyer,
  requireOwnedCheckout,
} from "@/lib/auth/authorization";

import {
  fulfillPaidCheckout,
} from "@/lib/payments/orderFulfillment";

export async function POST(request) {
  try {
    /*
     * --------------------------------------------------
     * 1. Authenticate buyer
     * --------------------------------------------------
     */
    const session =
      await requireBuyer();

    /*
     * --------------------------------------------------
     * 2. Read request
     * --------------------------------------------------
     */
    const body =
      await request.json();

    const checkoutId =
      body?.checkoutId?.trim();

    const razorpayPaymentId =
      body?.razorpayPaymentId?.trim() ||
      null;

    if (!checkoutId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "checkoutId is required",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * 3. Verify checkout ownership
     *
     * We do this before calling the fulfillment service.
     * --------------------------------------------------
     */
    await requireOwnedCheckout(
      checkoutId,
      session.user.id
    );

    /*
     * --------------------------------------------------
     * 4. Fulfill the verified payment.
     *
     * IMPORTANT:
     *
     * This is the SINGLE order-fulfillment implementation.
     *
     * It handles:
     * - payment lookup
     * - idempotency
     * - cart validation
     * - amount validation
     * - inventory validation
     * - order creation
     * - inventory decrement
     * - payment update
     * - checkout completion
     * - cart conversion
     * - campaign attribution
     *
     * The route itself does NOT duplicate any of that.
     * --------------------------------------------------
     */
    const result =
      await fulfillPaidCheckout({
        checkoutId,

        razorpayPaymentId,
      });

    /*
     * --------------------------------------------------
     * 5. Return the shared fulfillment result.
     * --------------------------------------------------
     */
    return NextResponse.json({
      success: true,

      alreadyCreated:
        result.alreadyCreated,

      order:
        result.order
          ? {
              id:
                result.order.id,

              userId:
                result.order.userId,

              totalAmount:
                result.order.totalAmount,

              currency:
                result.order.currency,

              status:
                result.order.status,

              createdAt:
                result.order.createdAt,

              items:
                result.order.items?.map(
                  (item) => ({
                    productId:
                      item.productId,

                    name:
                      item.product?.name ||
                      null,

                    quantity:
                      item.quantity,

                    price:
                      item.price,

                    subtotal:
                      item.price *
                      item.quantity,
                  })
                ) || [],
            }
          : null,

      payment:
        result.payment
          ? {
              id:
                result.payment.id,

              checkoutId:
                result.payment.checkoutId,

              razorpayOrderId:
                result.payment
                  .razorpayOrderId,

              razorpayPaymentId:
                result.payment
                  .razorpayPaymentId,

              amount:
                result.payment.amount,

              status:
                result.payment.status,

              attempt:
                result.payment.attempt,
            }
          : null,

      campaignAttribution:
        result.campaignAttribution ||
        null,
    });
  } catch (error) {
    console.error(
      "Payment completion error:",
      error
    );

    /*
     * --------------------------------------------------
     * Authentication errors
     * --------------------------------------------------
     */
    if (
      error.message ===
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
      error.message ===
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

    /*
     * --------------------------------------------------
     * Resource errors
     * --------------------------------------------------
     */
    if (
      error.message ===
        "RESOURCE_NOT_FOUND" ||
      error.message ===
        "CHECKOUT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Checkout not found",
        },
        { status: 404 }
      );
    }

    if (
      error.message ===
      "CHECKOUT_CART_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Checkout cart not found",
        },
        { status: 404 }
      );
    }

    /*
     * --------------------------------------------------
     * Payment errors
     * --------------------------------------------------
     */
    if (
      error.message ===
      "VERIFIED_PAYMENT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No verified payment found for this checkout",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * Cart/order validation errors
     * --------------------------------------------------
     */
    if (
      error.message ===
      "CART_EMPTY"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Checkout cart is empty",
        },
        { status: 400 }
      );
    }

    if (
      error.message ===
      "CHECKOUT_AMOUNT_MISMATCH"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Checkout amount does not match the current cart",
        },
        { status: 409 }
      );
    }

    if (
      error.message ===
      "PRODUCT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "A product in the order no longer exists",
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * Generic failure
     * --------------------------------------------------
     */
    return NextResponse.json(
      {
        success: false,

        error:
          error.message ||
          "Unable to complete payment",
      },
      { status: 500 }
    );
  }
}