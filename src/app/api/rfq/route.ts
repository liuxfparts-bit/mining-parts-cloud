import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  return NextResponse.json(
    { error: "此询价创建接口已停用，请使用 /rfq/create" },
    { status: 410 }
  );
}

export async function GET() {
  const rfqs = await prisma.rFQ.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rfqs);
}
