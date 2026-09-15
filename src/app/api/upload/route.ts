import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { auth } from "@/lib/auth";

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
]);
const MAX_IMAGE = 5 * 1024 * 1024; // 图片 5MB
const MAX_DOC = 10 * 1024 * 1024; // 文档 10MB

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
    const scope = String(form.get("scope") || "rfq").replace(/[^a-z0-9_-]/gi, "");
    if (!file) return NextResponse.json({ success: false, message: "no file" }, { status: 400 });

    const ext = ALLOWED.get(file.type);
    if (!ext)
      return NextResponse.json(
        { success: false, message: "仅支持 jpg/png/webp/pdf/doc/docx/xls/xlsx" },
        { status: 400 }
      );
    const isImage = file.type.startsWith("image/");
    if (file.size > (isImage ? MAX_IMAGE : MAX_DOC))
      return NextResponse.json(
        { success: false, message: isImage ? "单张不超过 5MB" : "文档不超过 10MB" },
        { status: 400 }
      );

    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", scope);
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buf);
    return NextResponse.json({ success: true, url: `/uploads/${scope}/${name}` });
  } catch (e) {
    console.error("【文件上传失败】:", e);
    return NextResponse.json({ success: false, message: "上传失败，请重试" }, { status: 500 });
  }
}
