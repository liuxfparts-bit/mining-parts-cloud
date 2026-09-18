/**
 * ============================================================
 * V3.1 现有 PartNumber normalizedPartNumber 回填预检（仅 dry-run）
 * ============================================================
 * 用法：npm run backfill:normalized -- --dry-run
 * 本阶段只统计，不写库、不建 unique、不自动 merge。
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "logs");

function norm(input: string): string {
  if (!input) return "";
  return String(input).trim().toUpperCase().replace(/[\s\-_/.·,，()（）\[\]]/g, "");
}

async function main() {
  console.log(`\n=== V3.1 现有 PN normalizedPartNumber 回填预检（DRY-RUN）===\n`);
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const all = await prisma.partNumber.findMany({ select: { id: true, number: true, normalizedPartNumber: true } });
    console.log(`现有 PN 总数: ${all.length}`);

    let normalizable = 0, alreadyFilled = 0, invalid = 0;
    const byNorm = new Map<string, number[]>();
    for (const p of all) {
      if (p.normalizedPartNumber) { alreadyFilled++; continue; }
      const n = norm(p.number);
      if (!n) { invalid++; continue; }
      normalizable++;
      if (!byNorm.has(n)) byNorm.set(n, []);
      byNorm.get(n)!.push(p.id);
    }
    const dups = [...byNorm.entries()].filter(([, ids]) => ids.length > 1);
    console.log(`可回填（normalized 可计算）: ${normalizable}`);
    console.log(`已回填: ${alreadyFilled}`);
    console.log(`无效（无法归一化）: ${invalid}`);
    console.log(`归一化重复组（需人工确认）: ${dups.length}`);

    fs.mkdirSync(LOG_DIR, { recursive: true });
    const lines = ["normalized_part_number,part_number_ids,count"];
    for (const [n, ids] of dups) lines.push(`${n},"${ids.join("|")}",${ids.length}`);
    fs.writeFileSync(path.join(LOG_DIR, "backfill-normalized-report.csv"), lines.join("\n"), "utf8");
    console.log(`报告: logs/backfill-normalized-report.csv`);
    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`[警告] 数据库不可用（本地开发环境），existing 回填预检跳过: ${e.message?.split("\n")[0]}`);
  }
  console.log(`\n=== 回填预检完成（DRY-RUN，未写任何数据）===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
