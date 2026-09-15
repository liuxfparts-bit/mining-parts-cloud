// Excel 解析测试：生成 8 类测试文件并验证（npx tsx scripts/test-excel.ts）
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { loadWorkbook, parseWorkbook, parseSheet } from "../src/lib/excel";

const dir = path.join(process.cwd(), "temp-excel");
fs.mkdirSync(dir, { recursive: true });

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail || ""}`); }
}

function makeBook(sheets: { name: string; rows: (string | number)[][] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  return wb;
}

function parseFile(file: string) {
  const buf = fs.readFileSync(path.join(dir, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const wb = loadWorkbook(ab);
  const meta = parseWorkbook(wb);
  const def = meta.sheets.find((s) => s.name === meta.defaultSheet)!;
  const rows = parseSheet(wb, def.name, def.headerRow, def.mapping);
  return { meta, def, rows };
}

// 1) 标准中文表头 10 条
{
  const rows: (string | number)[][] = [["序号", "品牌", "设备型号", "配件名称", "件号", "数量", "单位"]];
  for (let i = 1; i <= 10; i++) rows.push([i, "JOY", "14CM15", `Motor ${i}`, `10025609${i}`, 2, "pcs"]);
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows }]), path.join(dir, "t1-cn.xlsx"));
}
// 2) 英文表头 20 条
{
  const rows: (string | number)[][] = [["No.", "Brand", "Equipment Model", "Product Name", "Part Number", "Qty", "Unit"]];
  for (let i = 1; i <= 20; i++) rows.push([i, "CAT", "CL210", `Filter ${i}`, `66300103${String(i).padStart(2, "0")}`, i, "pcs"]);
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows }]), path.join(dir, "t2-en.xlsx"));
}
// 3) 中英文混合表头
{
  const rows: (string | number)[][] = [["Item", "品牌(Brand)", "设备型号(Model)", "配件名称(Description)", "件号 P/N", "数量 Qty", "单位 Unit"]];
  for (let i = 1; i <= 5; i++) rows.push([i, "SANDVIK", "LS190", `Cylinder ${i}`, `A2U220-55102${i}`, 4, "pcs"]);
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows }]), path.join(dir, "t3-mix.xlsx"));
}
// 4) 前面有公司名/标题，第 5 行才是表头
{
  const rows: (string | number)[][] = [
    ["山西某某矿业有限公司"],
    ["Spare Parts Request"],
    ["日期：2026-09-15"],
    [],
    ["序号", "品牌", "设备型号", "配件名称", "件号", "数量", "单位"],
    [1, "JOY", "10SC32", "Motor", "XP210162", 2, "pcs"],
    [2, "JOY", "10SC32", "Pump", "XP210172", 3, "pcs"],
  ];
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows }]), path.join(dir, "t4-offset.xlsx"));
}
// 5) 多 Sheet：Sheet1 空、Sheet2 标题、Sheet3 有数据（默认应选对）
{
  const s1: (string | number)[][] = [["无用"]];
  const s2: (string | number)[][] = [["Quotation"], ["No", "Brand", "Model", "Part No", "Qty"]];
  const s3: (string | number)[][] = [["序号", "品牌", "配件名称", "件号", "数量"], [1, "CAT", "Filter", "6565861700", 5]];
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows: s1 }, { name: "Sheet2", rows: s2 }, { name: "数据表", rows: s3 }]), path.join(dir, "t5-multi.xlsx"));
}
// 6) 矿山件号：字母+数字+横杠、前导0文本、长数字
{
  const rows: (string | number)[][] = [["品牌", "配件名称", "件号", "数量"]];
  rows.push(["SANDVIK", "Steering Cylinder", "A2U220-551026", 4]);           // 字母+横杠（文本）
  rows.push(["CAT", "Filter", "000123", 2]);                                  // 前导0（文本，不能丢0）
  rows.push(["JOY", "Motor", 100256099, 2]);                                  // 纯数字件号
  rows.push(["KOMATSU", "Seal", "6565861700", 1]);                            // 长数字（文本）
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows }]), path.join(dir, "t6-partno.xlsx"));
}
// 7) 空行、空数量、错误数据
{
  const rows: (string | number)[][] = [["品牌", "配件名称", "件号", "数量"]];
  rows.push(["CAT", "Filter", "663001031", 10]);
  rows.push(["", "", "", ""]);                                                  // 空行
  rows.push(["JOY", "Motor", "XP210162", ""]);                                  // 数量为空
  rows.push(["JOY", "Pump", "XP210172", 0]);                                    // 数量0
  rows.push(["SANDVIK", "", "A2U220-551026", 4]);                               // 缺配件名称（允许，只有件号）
  rows.push(["CAT", "Seal", "", 3]);                                            // 件号为空
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows }]), path.join(dir, "t7-error.xlsx"));
}
// 8) 50 条
{
  const rows: (string | number)[][] = [["序号", "品牌", "设备型号", "配件名称", "件号", "数量", "单位", "产品描述"]];
  for (let i = 1; i <= 50; i++) rows.push([i, "BRAND" + (i % 5), "EQ" + i, `Part ${i}`, `PN-${String(i).padStart(3, "0")}`, i % 7 + 1, "pcs", `desc ${i}`]);
  XLSX.writeFile(makeBook([{ name: "Sheet1", rows }]), path.join(dir, "t8-50.xlsx"));
}

// ===== 验证 =====
console.log("\n== T1 中文 10 条 ==");
{
  const { def, rows } = parseFile("t1-cn.xlsx");
  check("headerRow=1", def.headerRow === 1, `got ${def.headerRow}`);
  check("识别出 10 行", rows.length === 10, `got ${rows.length}`);
  check("件号保真", rows[0].partNumber === "100256091", `got ${rows[0].partNumber}`);
  check("无错误", rows.every((r) => r.errors.length === 0));
}

console.log("\n== T2 英文 20 条 ==");
{
  const { def, rows } = parseFile("t2-en.xlsx");
  check("headerRow=1", def.headerRow === 1, `got ${def.headerRow}`);
  check("识别出 20 行", rows.length === 20, `got ${rows.length}`);
  check("件号无小数点", !rows[0].partNumber.includes(".") && !rows[0].partNumber.includes("E"), `got ${rows[0].partNumber}`);
}

console.log("\n== T3 中英混合 ==");
{
  const { def, rows } = parseFile("t3-mix.xlsx");
  check("headerRow=1", def.headerRow === 1, `got ${def.headerRow}`);
  check("识别出 5 行", rows.length === 5, `got ${rows.length}`);
  check("品牌识别", rows[0].brandName === "SANDVIK", `got ${rows[0].brandName}`);
  check("件号识别", rows[0].partNumber === "A2U220-551021", `got ${rows[0].partNumber}`);
}

console.log("\n== T4 表头在第5行 ==");
{
  const { def, rows } = parseFile("t4-offset.xlsx");
  check("自动找到 headerRow=5", def.headerRow === 5, `got ${def.headerRow}`);
  check("识别出 2 行", rows.length === 2, `got ${rows.length}`);
}

console.log("\n== T5 多 Sheet ==");
{
  const { meta, def, rows } = parseFile("t5-multi.xlsx");
  check("列出 3 个 sheet", meta.sheets.length === 3, `got ${meta.sheets.length}`);
  check("默认选数据最多的 sheet", def.name === "数据表", `got ${def.name}`);
  check("识别 1 行", rows.length === 1, `got ${rows.length}`);
}

console.log("\n== T6 矿山件号保真 ==");
{
  const { def, rows } = parseFile("t6-partno.xlsx");
  const pns = rows.map((r) => r.partNumber);
  check("字母+横杠件号", pns[0] === "A2U220-551026", `got ${pns[0]}`);
  check("前导0不丢失", pns[1] === "000123", `got ${pns[1]}`);
  check("纯数字件号", pns[2] === "100256099", `got ${pns[2]}`);
  check("长数字件号", pns[3] === "6565861700", `got ${pns[3]}`);
}

console.log("\n== T7 错误行处理 ==");
{
  const { rows } = parseFile("t7-error.xlsx");
  check("空行被跳过（5 行有效）", rows.length === 5, `got ${rows.length}`);
  const errMsgs = rows.flatMap((r) => r.errors.map((e) => `${r.rowNum}:${e}`));
  check("提示数量为空", errMsgs.some((e) => e.includes("数量为空")), JSON.stringify(errMsgs));
  check("提示数量无效", errMsgs.some((e) => e.includes("数量无效")), JSON.stringify(errMsgs));
  check("提示件号为空", errMsgs.some((e) => e.includes("件号为空")), JSON.stringify(errMsgs));
  check("无崩溃且其余行保留", rows.filter((r) => r.errors.length === 0).length >= 2);
}

console.log("\n== T8 50 条 ==");
{
  const { def, rows } = parseFile("t8-50.xlsx");
  check("识别 50 行", rows.length === 50, `got ${rows.length}`);
  check("无错误", rows.every((r) => r.errors.length === 0));
}

console.log(`\n========== 结果: ${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
