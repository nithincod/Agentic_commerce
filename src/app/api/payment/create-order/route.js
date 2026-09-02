import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";
import razorpay from "@/lib/razorpay/client";

import {
  recordAgentAction,
} from "@/lib/audit/auditLog";

import {
  requireBuyer,
  requireOwnedCheckout,
} from "@/lib/auth/authorization";

import {
  createPaymentIdempotencyKey,
} from "@/lib/payments/paymentIntent";

import {
  reconcileCreatingPayment,
} from "@/lib/payments/razorpayReconciliation";

export async function POST(request) {
  try {
    /*
     * --------------------------------------------------
     * 1. Authenticate buyer
     * --------------------------------------------------
     */
    const session =
      await requireBuyer();

    const body =
      await request.json();

    const checkoutId =
      body?.checkoutId?.trim();

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
     * 2. Verify checkout ownership
     * --------------------------------------------------
     */
    const ownedCheckout =
      await requireOwnedCheckout(
        checkoutId,
        session.user.id
      );

    /*
     * --------------------------------------------------
     * 3. Load authoritative checkout state
     * --------------------------------------------------
     */
    const checkout =
      await prisma.checkout.findUnique({
        where: {
          id:
            ownedCheckout.id,
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
      return NextResponse.json(
        {
          success: false,
          error:
            "Checkout not found",
        },
        { status: 404 }
      );
    }

    /*
     * --------------------------------------------------
     * 4. Defensive ownership verification
     * --------------------------------------------------
     */
    if (
      checkout.cart.userId !==
      session.user.id
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_BLOCKED",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          checkoutId:
            checkout.id,

          authenticatedUserId:
            session.user.id,

          checkoutUserId:
            checkout.cart.userId,
        },

        status:
          "BLOCKED",

        reason:
          "Authenticated buyer does not own checkout",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Checkout access denied",
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------
     * 5. Validate persisted policy
     * --------------------------------------------------
     */
    const policy =
      checkout.policy;

    if (!policy) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_BLOCKED",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          checkoutId:
            checkout.id,

          userId:
            session.user.id,
        },

        status:
          "BLOCKED",

        reason:
          "Checkout has no persisted policy decision",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Checkout policy is missing",
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 6. Block policy-blocked transactions
     * --------------------------------------------------
     */
    if (
      policy.status ===
      "BLOCKED"
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_BLOCKED",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          checkoutId:
            checkout.id,

          userId:
            session.user.id,

          amount:
            checkout.amount,
        },

        output: {
          policy,
        },

        status:
          "BLOCKED",

        reason:
          policy.reason ||
          "Transaction blocked by policy",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            policy.reason ||
            "Transaction blocked by payment policy",

          policy,
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------
     * 7. Approval-required checkout must be approved.
     * --------------------------------------------------
     */
    if (
      policy.status ===
        "APPROVAL_REQUIRED" &&
      checkout.status !==
        "APPROVED" &&
      checkout.status !==
        "PAYMENT_PENDING"
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_BLOCKED",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          checkoutId:
            checkout.id,

          userId:
            session.user.id,

          checkoutStatus:
            checkout.status,

          policyStatus:
            policy.status,
        },

        status:
          "BLOCKED",

        reason:
          "Human approval is required before payment",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            "Human approval is required before payment",

          checkoutStatus:
            checkout.status,

          policy,
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------
     * 8. Validate normal approved checkout state.
     *
     * A policy-approved checkout normally starts at READY.
     * PAYMENT_PENDING is allowed for retry/recovery.
     * --------------------------------------------------
     */
    if (
      policy.status ===
        "APPROVED" &&
      ![
        "READY",
        "PAYMENT_PENDING",
      ].includes(
        checkout.status
      )
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_BLOCKED",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          checkoutId:
            checkout.id,

          userId:
            session.user.id,

          checkoutStatus:
            checkout.status,

          policyStatus:
            policy.status,
        },

        status:
          "BLOCKED",

        reason:
          "Checkout is not in a valid payment state",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            `Checkout is not payable from status ${checkout.status}`,
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 9. Validate cart
     * --------------------------------------------------
     */
    if (
      !checkout.cart ||
      !checkout.cart.items.length
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_BLOCKED",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        status:
          "BLOCKED",

        reason:
          "Checkout cart is empty",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Checkout cart is empty",
        },
        { status: 400 }
      );
    }

    /*
     * --------------------------------------------------
     * 10. Recalculate authoritative amount
     * --------------------------------------------------
     */
    let totalAmount = 0;

    for (
      const item of
        checkout.cart.items
    ) {
      const product =
        item.product;

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A product in the cart no longer exists",
          },
          { status: 400 }
        );
      }

      if (!product.active) {
        return NextResponse.json(
          {
            success: false,
            error:
              `${product.name} is no longer available`,
          },
          { status: 400 }
        );
      }

      if (
        !Number.isInteger(
          item.quantity
        ) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Invalid quantity for ${product.name}`,
          },
          { status: 400 }
        );
      }

      if (
        product.inventory <
        item.quantity
      ) {
        await recordAgentAction({
          agentType:
            "PAYMENT_AGENT",

          action:
            "PAYMENT_BLOCKED",

          entityType:
            "Checkout",

          entityId:
            checkout.id,

          input: {
            checkoutId:
              checkout.id,

            productId:
              product.id,

            requestedQuantity:
              item.quantity,

            availableInventory:
              product.inventory,
          },

          status:
            "BLOCKED",

          reason:
            `Insufficient inventory for ${product.name}`,
        });

        return NextResponse.json(
          {
            success: false,
            error:
              `Insufficient inventory for ${product.name}`,
          },
          { status: 400 }
        );
      }

      totalAmount +=
        product.price *
        item.quantity;
    }

    /*
     * --------------------------------------------------
     * 11. Verify checkout amount
     * --------------------------------------------------
     */
    if (
      totalAmount !==
      checkout.amount
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_BLOCKED",

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
            totalAmount,

          userId:
            session.user.id,
        },

        status:
          "BLOCKED",

        reason:
          "Checkout amount does not match current cart",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            "Checkout amount does not match current cart",
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 12. Inspect latest payment attempt
     * --------------------------------------------------
     */
    let latestPayment =
      checkout.payments?.[0] ||
      null;

    /*
     * --------------------------------------------------
     * 13. IMPORTANT RECONCILIATION STEP
     *
     * If the previous request created our payment
     * intent but crashed before saving the Razorpay
     * order ID, do NOT immediately create another
     * Razorpay order.
     *
     * First search/reconcile the existing attempt.
     * --------------------------------------------------
     */
    if (
      latestPayment &&
      latestPayment.status ===
        "CREATING"
    ) {
      const reconciliation =
        await reconcileCreatingPayment(
          latestPayment
        );

      if (
        reconciliation.reconciled &&
        reconciliation.razorpayOrder
      ) {
        return NextResponse.json({
          success: true,

          checkoutId:
            checkout.id,

          paymentId:
            reconciliation.payment.id,

          razorpayOrderId:
            reconciliation
              .razorpayOrder.id,

          amount:
            reconciliation
              .payment.amount,

          amountInSubunits:
            reconciliation
              .payment.amount *
            100,

          currency:
            checkout.currency,

          keyId:
            process.env
              .RAZORPAY_KEY_ID,

          reused:
            true,

          reconciled:
            true,

          attempt:
            reconciliation
              .payment.attempt,
        });
      }

      /*
       * Multiple external orders matching the same receipt
       * is an ambiguous situation.
       *
       * Never create another one automatically.
       */
      if (
        reconciliation.ambiguous
      ) {
        await recordAgentAction({
          agentType:
            "PAYMENT_AGENT",

          action:
            "PAYMENT_CREATION_BLOCKED",

          entityType:
            "Payment",

          entityId:
            latestPayment.id,

          input: {
            checkoutId:
              checkout.id,

            paymentId:
              latestPayment.id,

            userId:
              session.user.id,
          },

          status:
            "BLOCKED",

          reason:
            "Razorpay reconciliation returned multiple matching orders",
        });

        return NextResponse.json(
          {
            success: false,

            error:
              "Payment reconciliation is ambiguous. No new Razorpay order was created.",
          },
          { status: 409 }
        );
      }

      /*
       * No matching external order was found.
       *
       * This attempt can be closed and a new attempt
       * can be created.
       */
      await prisma.payment.update({
        where: {
          id:
            latestPayment.id,
        },

        data: {
          status:
            "FAILED_TO_RECONCILE",
        },
      });

      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_RECONCILIATION_COMPLETED",

        entityType:
          "Payment",

        entityId:
          latestPayment.id,

        input: {
          checkoutId:
            checkout.id,

          paymentId:
            latestPayment.id,

          userId:
            session.user.id,
        },

        status:
          "SUCCESS",

        reason:
          "No matching Razorpay order was found; previous attempt marked unreconciled",
      });

      /*
       * Refresh the local reference so the next attempt
       * calculation uses the updated state.
       */
      latestPayment =
        await prisma.payment.findUnique({
          where: {
            id:
              latestPayment.id,
          },
        });
    }

    /*
     * --------------------------------------------------
     * 14. Reuse an already-created Razorpay payment
     * --------------------------------------------------
     */
    if (
      latestPayment &&
      [
        "CREATED",
        "PENDING",
      ].includes(
        latestPayment.status
      ) &&
      latestPayment.razorpayOrderId
    ) {
      /*
       * Payment amount must still match checkout.
       */
      if (
        latestPayment.amount !==
        totalAmount
      ) {
        await recordAgentAction({
          agentType:
            "PAYMENT_AGENT",

          action:
            "PAYMENT_BLOCKED",

          entityType:
            "Payment",

          entityId:
            latestPayment.id,

          input: {
            paymentId:
              latestPayment.id,

            paymentAmount:
              latestPayment.amount,

            calculatedAmount:
              totalAmount,

            userId:
              session.user.id,
          },

          status:
            "BLOCKED",

          reason:
            "Existing payment amount does not match checkout",
        });

        return NextResponse.json(
          {
            success: false,

            error:
              "Existing payment amount does not match checkout",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,

        checkoutId:
          checkout.id,

        paymentId:
          latestPayment.id,

        razorpayOrderId:
          latestPayment.razorpayOrderId,

        amount:
          latestPayment.amount,

        amountInSubunits:
          latestPayment.amount *
          100,

        currency:
          checkout.currency,

        keyId:
          process.env
            .RAZORPAY_KEY_ID,

        reused:
          true,

        reconciled:
          false,

        attempt:
          latestPayment.attempt,
      });
    }

    /*
     * --------------------------------------------------
     * 15. Determine next payment attempt
     * --------------------------------------------------
     */
    const nextAttempt =
      latestPayment
        ? latestPayment.attempt + 1
        : 1;

    /*
     * Limit automatic attempts.
     */
    if (
      nextAttempt > 2
    ) {
      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "PAYMENT_CREATION_BLOCKED",

        entityType:
          "Checkout",

        entityId:
          checkout.id,

        input: {
          checkoutId:
            checkout.id,

          userId:
            session.user.id,

          attempt:
            nextAttempt,
        },

        status:
          "BLOCKED",

        reason:
          "Maximum payment attempts exceeded",
      });

      return NextResponse.json(
        {
          success: false,

          error:
            "Maximum payment attempts exceeded",
        },
        { status: 409 }
      );
    }

    /*
     * --------------------------------------------------
     * 16. Deterministic internal idempotency key
     * --------------------------------------------------
     */
    const idempotencyKey =
      createPaymentIdempotencyKey(
        checkout.id,
        nextAttempt
      );

    /*
     * --------------------------------------------------
     * 17. Create durable payment intent FIRST
     * --------------------------------------------------
     */
    let payment;

    try {
      payment =
        await prisma.payment.create({
          data: {
            checkoutId:
              checkout.id,

            idempotencyKey,

            amount:
              totalAmount,

            status:
              "CREATING",

            attempt:
              nextAttempt,
          },
        });
    } catch (error) {
      /*
       * Another request may have won the race.
       */
      if (
        error?.code ===
        "P2002"
      ) {
        const existing =
          await prisma.payment.findUnique({
            where: {
              idempotencyKey,
            },
          });

        if (
          existing?.razorpayOrderId
        ) {
          return NextResponse.json({
            success: true,

            checkoutId:
              checkout.id,

            paymentId:
              existing.id,

            razorpayOrderId:
              existing.razorpayOrderId,

            amount:
              existing.amount,

            amountInSubunits:
              existing.amount *
              100,

            currency:
              checkout.currency,

            keyId:
              process.env
                .RAZORPAY_KEY_ID,

            reused:
              true,

            reconciled:
              false,

            attempt:
              existing.attempt,
          });
        }

        if (existing) {
          return NextResponse.json(
            {
              success: false,

              error:
                "A payment request is already being created. Please retry shortly.",
            },
            { status: 409 }
          );
        }
      }

      throw error;
    }

    /*
     * --------------------------------------------------
     * 18. Create Razorpay order
     * --------------------------------------------------
     */
    let razorpayOrder;

    try {
      razorpayOrder =
        await razorpay.orders.create({
          amount:
            totalAmount *
            100,

          currency:
            checkout.currency,

          receipt:
            `agentpay_${checkout.id}_${nextAttempt}`,

          notes: {
            checkoutId:
              checkout.id,

            userId:
              session.user.id,

            paymentId:
              payment.id,

            attempt:
              String(nextAttempt),
          },
        });
    } catch (error) {
      /*
       * External order creation failed.
       */
      await prisma.payment.update({
        where: {
          id:
            payment.id,
        },

        data: {
          status:
            "FAILED_TO_CREATE",
        },
      });

      await recordAgentAction({
        agentType:
          "PAYMENT_AGENT",

        action:
          "RAZORPAY_ORDER_CREATION_FAILED",

        entityType:
          "Payment",

        entityId:
          payment.id,

        input: {
          checkoutId:
            checkout.id,

          userId:
            session.user.id,

          attempt:
            nextAttempt,

          idempotencyKey,
        },

        status:
          "FAILED",

        reason:
          error.message ||
          "Razorpay order creation failed",
      });

      throw error;
    }

    /*
     * --------------------------------------------------
     * 19. Save Razorpay order ID
     * --------------------------------------------------
     */
    const updatedPayment =
      await prisma.payment.update({
        where: {
          id:
            payment.id,
        },

        data: {
          razorpayOrderId:
            razorpayOrder.id,

          status:
            "CREATED",
        },
      });

    /*
     * --------------------------------------------------
     * 20. Move checkout to PAYMENT_PENDING
     * --------------------------------------------------
     */
    const updatedCheckout =
      await prisma.checkout.update({
        where: {
          id:
            checkout.id,
        },

        data: {
          status:
            "PAYMENT_PENDING",
        },
      });

    /*
     * --------------------------------------------------
     * 21. Audit successful Razorpay order creation
     * --------------------------------------------------
     */
    await recordAgentAction({
      agentType:
        "PAYMENT_AGENT",

      action:
        "RAZORPAY_ORDER_CREATED",

      entityType:
        "Payment",

      entityId:
        updatedPayment.id,

      input: {
        checkoutId:
          checkout.id,

        paymentId:
          updatedPayment.id,

        userId:
          session.user.id,

        attempt:
          nextAttempt,

        idempotencyKey,

        policyStatus:
          policy.status,
      },

      output: {
        razorpayOrderId:
          razorpayOrder.id,

        amount:
          totalAmount,

        currency:
          checkout.currency,

        checkoutStatus:
          updatedCheckout.status,
      },

      status:
        "SUCCESS",

      reason:
        "Razorpay order created after payment-intent reconciliation and authorization checks",
    });

    /*
     * --------------------------------------------------
     * 22. Final response
     * --------------------------------------------------
     */
    return NextResponse.json({
      success: true,

      checkoutId:
        checkout.id,

      paymentId:
        updatedPayment.id,

      razorpayOrderId:
        razorpayOrder.id,

      amount:
        totalAmount,

      amountInSubunits:
        razorpayOrder.amount,

      currency:
        razorpayOrder.currency,

      keyId:
        process.env
          .RAZORPAY_KEY_ID,

      reused:
        false,

      reconciled:
        false,

      attempt:
        nextAttempt,

      checkoutStatus:
        updatedCheckout.status,

      policyStatus:
        policy.status,
    });
  } catch (error) {
    console.error(
      "Razorpay order creation error:",
      error
    );

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

    if (
      error.message ===
      "RESOURCE_NOT_FOUND"
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

    return NextResponse.json(
      {
        success: false,

        error:
          error.message ||
          "Unable to create Razorpay order",
      },
      { status: 500 }
    );
  }
}