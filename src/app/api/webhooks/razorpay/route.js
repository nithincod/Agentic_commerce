import crypto from "crypto";

import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";

import {
  processRazorpayWebhook,
} from "@/lib/payments/razorpayWebhook";

/**
 * Verify Razorpay webhook signature using the raw body.
 */
function verifyWebhookSignature(
  rawBody,
  receivedSignature,
  webhookSecret
) {
  if (
    !rawBody ||
    !receivedSignature ||
    !webhookSecret
  ) {
    return false;
  }

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        webhookSecret
      )
      .update(rawBody)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      "utf8"
    );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

export async function POST(request) {
  /*
   * IMPORTANT:
   *
   * We must read the RAW body.
   * Do not call request.json() before verifying
   * the Razorpay signature.
   */
  const rawBody =
    await request.text();

  const signature =
    request.headers.get(
      "x-razorpay-signature"
    );

  const eventId =
    request.headers.get(
      "x-razorpay-event-id"
    );

  const webhookSecret =
    process.env
      .RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(
      "RAZORPAY_WEBHOOK_SECRET is not configured"
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Webhook configuration error",
      },
      { status: 500 }
    );
  }

  /*
   * --------------------------------------------------
   * 1. Verify signature
   * --------------------------------------------------
   */
  const validSignature =
    verifyWebhookSignature(
      rawBody,
      signature,
      webhookSecret
    );

  if (!validSignature) {
    console.error(
      "Invalid Razorpay webhook signature"
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Invalid webhook signature",
      },
      { status: 400 }
    );
  }

  /*
   * --------------------------------------------------
   * 2. Require webhook event ID
   * --------------------------------------------------
   */
  if (!eventId) {
    return NextResponse.json(
      {
        success: false,

        error:
          "Missing x-razorpay-event-id",
      },
      { status: 400 }
    );
  }

  /*
   * --------------------------------------------------
   * 3. Parse JSON after signature validation.
   * --------------------------------------------------
   */
  let event;

  try {
    event =
      JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        success: false,

        error:
          "Invalid JSON payload",
      },
      { status: 400 }
    );
  }

  if (!event?.event) {
    return NextResponse.json(
      {
        success: false,

        error:
          "Webhook event type is missing",
      },
      { status: 400 }
    );
  }

  /*
   * --------------------------------------------------
   * 4. Durable event inbox.
   *
   * eventId is UNIQUE in PostgreSQL.
   * --------------------------------------------------
   */
  let webhookEvent;

  try {
    webhookEvent =
      await prisma.razorpayWebhookEvent.create({
        data: {
          eventId,

          event:
            event.event,

          payload:
            event,

          processed:
            false,
        },
      });
  } catch (error) {
    /*
     * Duplicate webhook delivery.
     */
    if (
      error?.code ===
      "P2002"
    ) {
      const existing =
        await prisma.razorpayWebhookEvent.findUnique({
          where: {
            eventId,
          },
        });

      /*
       * Already completed.
       *
       * Return 200 because this is an intentionally
       * idempotent duplicate.
       */
      if (
        existing?.processed
      ) {
        return NextResponse.json({
          success: true,

          duplicate: true,

          processed: true,

          eventId,
        });
      }

      /*
       * Another process may currently be handling it.
       */
      return NextResponse.json({
        success: true,

        duplicate: true,

        processed: false,

        eventId,
      });
    }

    console.error(
      "Webhook event persistence error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Unable to persist webhook event",
      },
      { status: 500 }
    );
  }

  /*
   * --------------------------------------------------
   * 5. Process business event.
   * --------------------------------------------------
   */
  try {
    const result =
      await processRazorpayWebhook(
        event
      );

    /*
     * Mark event processed only after the business
     * operation succeeds.
     */
    await prisma.razorpayWebhookEvent.update({
      where: {
        id:
          webhookEvent.id,
      },

      data: {
        processed:
          true,

        processedAt:
          new Date(),

        error:
          null,
      },
    });

    return NextResponse.json({
      success: true,

      eventId,

      result,
    });
  } catch (error) {
    console.error(
      "Razorpay webhook processing error:",
      error
    );

    /*
     * Keep event unprocessed so Razorpay can retry.
     */
    try {
      await prisma.razorpayWebhookEvent.update({
        where: {
          id:
            webhookEvent.id,
        },

        data: {
          processed:
            false,

          error:
            error.message ||
            "Webhook processing failed",
        },
      });
    } catch (updateError) {
      console.error(
        "Unable to update webhook failure state:",
        updateError
      );
    }

    return NextResponse.json(
      {
        success: false,

        eventId,

        error:
          error.message ||
          "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}