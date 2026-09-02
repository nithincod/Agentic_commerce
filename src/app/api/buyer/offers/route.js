import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";

import {
  requireBuyer,
} from "@/lib/auth/authorization";

export async function GET() {
  try {
    const session =
      await requireBuyer();

    const campaigns =
      await prisma.campaign.findMany({
        where: {
          status: "ACTIVE",
        },

        include: {
          merchant: true,

          targets: {
            include: {
              product: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    const offers =
      campaigns
        .map((campaign) => {
          const targetProducts =
            campaign.targets
              .filter(
                (target) =>
                  target.role ===
                    "TARGET" &&
                  target.product &&
                  target.product.active &&
                  target.product.inventory >
                    0
              )
              .map((target) => ({
                id:
                  target.product.id,

                name:
                  target.product.name,

                description:
                  target.product.description,

                price:
                  target.product.price,

                currency:
                  target.product.currency,

                inventory:
                  target.product.inventory,
              }));

          if (
            targetProducts.length === 0
          ) {
            return null;
          }

          return {
            campaignId:
              campaign.id,

            campaignName:
              campaign.name,

            type:
              campaign.type,

            description:
              campaign.description,

            discountPercent:
              campaign.discountPercent,

            merchant:
              campaign.merchant
                ? {
                    id:
                      campaign.merchant.id,

                    name:
                      campaign.merchant.name,
                  }
                : null,

            products:
              targetProducts,
          };
        })
        .filter(Boolean);

    return NextResponse.json({
      success: true,
      offers,
    });
  } catch (error) {
    console.error(
      "Buyer offers error:",
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
        {
          status: 401,
        }
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
        {
          status: 403,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to load offers",
      },
      {
        status: 500,
      }
    );
  }
}