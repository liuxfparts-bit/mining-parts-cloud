import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  MIME_EXTENSION,
  fileSignatureMatches,
  resolveUploadAuthorization,
} from "@/lib/upload-policy";
import { rateLimit } from "@/lib/rateLimit";

const MAX_REQUEST = 11 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_DOC = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST) {
      return NextResponse.json(
        { success: false, code: "REQUEST_TOO_LARGE", message: "上传请求过大" },
        { status: 413 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const scope = String(form.get("scope") || "");

    const access = await resolveUploadAuthorization(scope);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, code: access.code, message: access.message },
        { status: access.status }
      );
    }
    const limit = rateLimit(`upload:user:${access.userId}`, 120, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, code: "UPLOAD_RATE_LIMITED", message: "上传过于频繁，请稍后再试" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter || 60) } }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, code: "FILE_REQUIRED", message: "请选择文件" }, { status: 400 });
    }

    const ext = MIME_EXTENSION[file.type];
    if (!ext || !access.allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { success: false, code: "FILE_TYPE_FORBIDDEN", message: "该上传用途不支持此文件类型" },
        { status: 400 }
      );
    }

    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? MAX_IMAGE : MAX_DOC;
    if (file.size <= 0 || file.size > maxSize) {
      return NextResponse.json(
        { success: false, code: "FILE_SIZE_INVALID", message: isImage ? "图片大小须在 1B–5MB" : "文档大小须在 1B–10MB" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length !== file.size || !fileSignatureMatches(buf, file.type)) {
      return NextResponse.json(
        { success: false, code: "FILE_SIGNATURE_MISMATCH", message: "文件内容与声明格式不一致" },
        { status: 400 }
      );
    }

    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", access.scope, access.principal);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf, { flag: "wx" });

    return NextResponse.json({
      success: true,
      url: `/uploads/${access.scope}/${access.principal}/${name}`,
      scope: access.scope,
    });
  } catch (e) {
    console.error("【文件上传失败】:", e);
    return NextResponse.json({ success: false, message: "上传失败，请重试" }, { status: 500 });
  }
}
