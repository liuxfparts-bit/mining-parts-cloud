import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      brandName,
      equipmentModel,
      partNumber,
      quantity,
      description,
      region,
      contactName,
      contactPhone,
    } = body;

    if (!title || !description || !contactName || !contactPhone) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const rfq = await prisma.rFQ.create({
      data: {
        title,
        brandName,
        equipmentModel,
        partNumber,
        quantity: parseInt(quantity) || 1,
        description,
        region,
        contactName,
        contactPhone,
      },
    });

    return NextResponse.json({ success: true, id: rfq.id }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function GET() {
  const rfqs = await prisma.rFQ.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rfqs);
}
