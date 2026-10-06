import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const ANALYTICS_VISITOR_COOKIE = "kpy_vid";
export const ANALYTICS_SESSION_COOKIE = "kpy_sid";

export async function writeBusinessEvent(input: {
  eventType: "REGISTER" | "RFQ_CREATE" | "QUOTE_CREATE";
  path: string;
  userId?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const jar = cookies();
    const visitorId = jar.get(ANALYTICS_VISITOR_COOKIE)?.value || null;
    const sessionId = jar.get(ANALYTICS_SESSION_COOKIE)?.value || null;
    await prisma.analyticsEvent.create({
      data: {
        eventType: input.eventType,
        path: input.path.slice(0, 500),
        visitorId,
        sessionId,
        userId: input.userId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? (input.metadata as any) : undefined,
      },
    });
  } catch (error) {
    // Analytics must never break a business transaction or response.
    console.error("[analytics] business event write failed", error);
  }
}
