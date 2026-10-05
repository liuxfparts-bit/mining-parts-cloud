import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorUserId?: number | null;
  action: string;
  targetType: string;
  targetId?: string | number | null;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function writeSecurityAudit(input: AuditInput) {
  return prisma.securityAuditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId == null ? null : String(input.targetId),
      summary: input.summary ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function getAdminContinuityStatus() {
  const activeAdminCount = await prisma.user.count({
    where: { role: "ADMIN", status: "ACTIVE" },
  });
  return { activeAdminCount, hasRedundancy: activeAdminCount >= 2 };
}
