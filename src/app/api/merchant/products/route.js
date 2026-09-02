import { NextResponse } from "next/server";

import prisma from "@/lib/db/prisma";

import {
  requireMerchant,
} from "@/lib/auth/merchant";

export async function GET() {
  try {
    const { merchant } =
      await requireMerchant();

    const products =
      await prisma.product.findMany({
        where: {
          merchantId:
            merchant.id,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return NextResponse.json({
      success: true,

      products,
    });
  } catch (error) {
    console.error(
      "Merchant products GET error:",
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
            "Merchant access required",
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
          "Unable to load products",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request
) {
  try {
    const { merchant } =
      await requireMerchant();

    const body =
      await request.json();

    const name =
      typeof body?.name ===
      "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body?.description ===
      "string"
        ? body.description.trim()
        : "";

    const category =
      typeof body?.category ===
      "string"
        ? body.category.trim()
        : "";

    const price =
      Number(body?.price);

    const inventory =
      Number(body?.inventory);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product name is required",
        },
        {
          status: 400,
        }
      );
    }

    if (name.length > 150) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product name must be 150 characters or less",
        },
        {
          status: 400,
        }
      );
    }

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Category is required",
        },
        {
          status: 400,
        }
      );
    }

    if (category.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Category must be 100 characters or less",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Price must be a positive integer in INR",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(
        inventory
      ) ||
      inventory < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Inventory must be a non-negative integer",
        },
        {
          status: 400,
        }
      );
    }

    const product =
      await prisma.product.create({
        data: {
          name,
          description:
            description ||
            null,
          category,
          price,
          currency: "INR",
          inventory,
          active: true,

          merchantId:
            merchant.id,
        },
      });

    return NextResponse.json(
      {
        success: true,

        product,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Merchant products POST error:",
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
            "Merchant access required",
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
          "Unable to create product",
      },
      {
        status: 500,
      }
    );
  }
}