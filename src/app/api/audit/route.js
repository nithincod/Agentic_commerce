import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/authorization";

export async function GET() {
  try {
    const session = await requireSession();
    const role = session.user.role;

    const events = await prisma.agentAction.findMany({
      where:
        role === "ADMIN"
          ? undefined
          : {
              OR: [
                {
                  input: {
                    path: ["userId"],
                    equals: session.user.id,
                  },
                },
                {
                  input: {
                    path: ["merchantUserId"],
                    equals: session.user.id,
                  },
                },
              ],
            },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Audit API error:", error);

    const status =
      error.message === "UNAUTHENTICATED" ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          status === 401
            ? "Authentication required"
            : "Unable to fetch audit events",
      },
      { status }
    );
  }
}
