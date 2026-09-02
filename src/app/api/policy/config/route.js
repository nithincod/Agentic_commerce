import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/authorization";
import { getPolicyConfig } from "@/lib/policy/policyEngine";

export async function GET() {
  try {
    const session = await requireSession();

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        role: session.user.role,
      },
      policy: getPolicyConfig(),
    });
  } catch (error) {
    const status =
      error.message === "UNAUTHENTICATED" ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          status === 401
            ? "Authentication required"
            : "Unable to load policy configuration",
      },
      { status }
    );
  }
}
