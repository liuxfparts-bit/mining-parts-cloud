import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const rfqId = parseInt(String(formData.get("rfqId")));
  const supplierId = parseInt(String(formData.get("supplierId")));
  const unitPrice = parseFloat(String(formData.get("unitPrice")));

  if (!rfqId || !supplierId || !unitPrice) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  try {
    await prisma.quote.create({
      data: {
        rfqId,
        supplierId,
        unitPrice,
        currency: String(formData.get("currency") || "CNY"),
        quantity: parseInt(String(formData.get("quantity") || "1")) || 1,
        moq: parseInt(String(formData.get("moq") || "0")) || null,
        stockStatus: String(formData.get("stockStatus") || "IN_STOCK"),
        leadTime: String(formData.get("leadTime") || "") || null,
        warranty: String(formData.get("warranty") || "") || null,
        paymentTerms: String(formData.get("paymentTerms") || "") || null,
        incoterm: String(formData.get("incoterm") || "") || null,
        remarks: String(formData.get("remarks") || "") || null,
      },
    });

    // 更新 RFQ 状态为 QUOTED
    await prisma.rFQ.update({
      where: { id: rfqId },
      data: { status: "QUOTED" },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("quote error:", e);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
