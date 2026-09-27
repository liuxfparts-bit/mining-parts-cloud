"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bindInvitationToSupplier, invitationCanQuote } from "@/lib/rfq-invitation";
import { redirect } from "next/navigation";

/** Token locates the invitation; supplier identity comes only from the session. */
export async function claimInvitationAction(token: string) {
  const session = await auth();
  if (!session?.user?.email) redirect(`/login?token=${encodeURIComponent(token)}`);
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== "SUPPLIER" || !user.supplierId) redirect("/supplier");
  const inv = await bindInvitationToSupplier(token, user.supplierId);
  const rfq = inv ? await prisma.rFQ.findUnique({ where: { id: inv.rfqId } }) : null;
  if (!inv || !rfq || !invitationCanQuote(inv, rfq.status)) redirect(`/rfq/invite/${encodeURIComponent(token)}`);
  // The quote page still checks RFQ visibility using canSupplierAccessRfq.
  redirect(`/rfq/${inv.rfqId}/quote?inv=${encodeURIComponent(token)}`);
}
