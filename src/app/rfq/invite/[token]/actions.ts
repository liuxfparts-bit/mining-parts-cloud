"use server";

import { prisma } from "@/lib/prisma";
import { bindInvitationToSupplier, invitationCanQuote } from "@/lib/rfq-invitation";
import { redirect } from "next/navigation";
import { requireSupplierWriteAccess } from "@/lib/supplier-write-access";

/** Token locates the invitation; supplier identity comes only from the session. */
export async function claimInvitationAction(token: string) {
  const access = await requireSupplierWriteAccess("BUSINESS");
  const inv = await bindInvitationToSupplier(token, access.supplierId);
  const rfq = inv ? await prisma.rFQ.findUnique({ where: { id: inv.rfqId } }) : null;
  if (!inv || !rfq || !invitationCanQuote(inv, rfq.status)) redirect(`/rfq/invite/${encodeURIComponent(token)}`);
  // The quote page still checks RFQ visibility using canSupplierAccessRfq.
  redirect(`/rfq/${inv.rfqId}/quote?inv=${encodeURIComponent(token)}`);
}
