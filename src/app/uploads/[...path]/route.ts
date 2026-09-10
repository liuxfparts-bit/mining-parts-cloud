import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const name = params.path.join("/");
  const fp = path.join(process.cwd(), "public", "uploads", name);
  try {
    const buf = await readFile(fp);
    const ext = name.split(".").pop()?.toLowerCase();
    const type = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "application/octet-stream";
    return new NextResponse(buf, { headers: { "Content-Type": type } });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
