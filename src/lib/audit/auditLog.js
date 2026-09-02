import prisma from "@/lib/db/prisma";

export async function recordAgentAction({
  agentType,
  action,
  entityType = null,
  entityId = null,
  input = null,
  output = null,
  status,
  reason = null,
}) {
  try {
    return await prisma.agentAction.create({
      data: {
        agentType,
        action,
        entityType,
        entityId,
        input,
        output,
        status,
        reason,
      },
    });
  } catch (error) {
    /*
     * Audit failure should not silently break a payment/order flow.
     * Log it for debugging, but let the business action continue.
     */
    console.error("Audit logging failed:", error);

    return null;
  }
}