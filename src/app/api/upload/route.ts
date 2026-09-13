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
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

  const ext = ALLOWED.get(file.type);
  if (!ext) return NextResponse.json({ error: "仅支持 jpg/png/webp" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "单张不超过 5MB" }, { status: 400 });

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "rfq");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);
  return NextResponse.json({ url: `/uploads/rfq/${name}` });
}
