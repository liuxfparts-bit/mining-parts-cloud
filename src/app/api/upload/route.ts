import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { auth } from "@/lib/auth";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  try {
    const s = await auth();
    if (!s?.user) {
      return NextResponse.json(
        { success: false, code: "UNAUTHORIZED", message: "登录凭证已过期，请重新登录" },
        { status: 401 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ success: false, message: "no file" }, { status: 400 });

    const ext = ALLOWED.get(file.type);
    if (!ext) return NextResponse.json({ success: false, message: "仅支持 jpg/png/webp" }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ success: false, message: "单张不超过 5MB" }, { status: 400 });

    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "rfq");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buf);
    return NextResponse.json({ success: true, url: `/uploads/rfq/${name}` });
  } catch (e) {
    console.error("【RFQ图片上传失败】:", e);
    return NextResponse.json({ success: false, message: "上传失败，请重试" }, { status: 500 });
  }
}
