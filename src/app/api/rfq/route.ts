import { NextResponse } from "next/server";

// Legacy endpoint: do not return unrestricted RFQ records.
export async function GET() {
  return NextResponse.json(
    { error: "This legacy RFQ endpoint is no longer available." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "此询价创建接口已停用，请使用 /rfq/create" },
    { status: 410 }
  );
}
