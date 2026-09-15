// Excel 批量导入解析库（浏览器端）
// 支持 .xlsx / .xls / .csv；自动寻找表头行；中英文表头识别；件号强制字符串
import * as XLSX from "xlsx";

export interface FieldMapping {
  brandName?: number;
  equipmentModel?: number;
  productName?: number;
  partNumber?: number;
  quantity?: number;
  unit?: number;
  description?: number;
}

export interface ParsedRow {
  rowNum: number; // Excel 行号（1-based，用于错误提示）
  seq: number; // 导入顺序
  brandName: string;
  equipmentModel: string;
  productName: string;
  partNumber: string;
  quantity: number | null;
  unit: string;
  description: string;
  errors: string[];
}

export interface SheetMeta {
  name: string;
  headerRow: number; // 自动识别到的表头行（1-based）
  confidence: number; // 命中字段数
  mapping: FieldMapping;
  dataRows: number; // 表头以下数据行数（估算）
}

export interface WorkbookParseResult {
  sheets: SheetMeta[];
  defaultSheet: string;
}

/** 表头规范化：转小写、去空格、去标点，用于模糊匹配 */
function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_\-()（）.#/\\:：]+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

const FIELD_RULES: { field: keyof FieldMapping; keywords: string[] }[] = [
  { field: "partNumber", keywords: ["件号", "零件号", "图号", "料号", "partnumber", "partno", "pn"] },
  { field: "quantity", keywords: ["数量", "qty", "quantity"] },
  { field: "unit", keywords: ["单位", "unit", "uom"] },
  { field: "brandName", keywords: ["品牌", "brand", "make", "厂家", "制造商"] },
  { field: "equipmentModel", keywords: ["设备型号", "设备", "equipment", "machinemodel", "机型", "型号", "model"] },
  { field: "productName", keywords: ["配件名称", "配件名", "产品名称", "productname", "partname", "名称", "品名", "货物名称", "product"] },
  { field: "description", keywords: ["产品描述", "描述", "description", "备注", "remarks", "note"] },
];

/** 忽略词（序号/编号等） */
const IGNORE_KEYS = ["no", "item", "序号", "编号", "项次", "line", "sl", "slno", "总价", "金额", "单价", "price", "amount"];

/** 匹配单个表头词 → 目标字段（包含匹配，容忍 中英文混合/标点/括号） */
function matchField(header: string): keyof FieldMapping | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  if (IGNORE_KEYS.includes(key)) return null;
  for (const rule of FIELD_RULES) {
    for (const kw of rule.keywords) {
      if (key.includes(kw)) return rule.field;
    }
  }
  return null;
}

/** 读取工作簿（浏览器 File → ArrayBuffer） */
export function loadWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

/** 获取某 sheet 的二维数组（含表头，raw:false 保证件号按显示格式转字符串；保留空行使行号与 Excel 一致） */
function sheetRows(ws: XLSX.WorkSheet): string[][] {
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  }) as string[][];
}

/** 自动寻找表头行：遍历前 15 行，取命中字段最多的行 */
function detectHeader(rows: string[][]): { headerRow: number; confidence: number; mapping: FieldMapping } {
  let best: { headerRow: number; confidence: number; mapping: FieldMapping } | null = null;
  const maxScan = Math.min(rows.length, 15);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    const mapping: FieldMapping = {};
    let hits = 0;
    row.forEach((cell, c) => {
      const f = matchField(String(cell));
      if (f && mapping[f] === undefined) {
        mapping[f] = c;
        hits++;
      }
    });
    // 件号或数量必须命中其一，才认为可能是表头行
    const hasCore = mapping.partNumber !== undefined || mapping.quantity !== undefined;
    if (hasCore && (!best || hits > best.confidence)) {
      best = { headerRow: r + 1, confidence: hits, mapping };
    }
  }
  if (!best) return { headerRow: 1, confidence: 0, mapping: {} };
  return best;
}

/** 解析整个工作簿：列出各 Sheet 与自动识别结果 */
export function parseWorkbook(wb: XLSX.WorkBook): WorkbookParseResult {
  const sheets: SheetMeta[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = sheetRows(ws);
    const { headerRow, confidence, mapping } = detectHeader(rows);
    // 估计表头行以下的数据行数（非空）
    let dataRows = 0;
    for (let r = headerRow; r < rows.length; r++) {
      if (rows[r] && rows[r].some((c) => String(c).trim() !== "")) dataRows++;
    }
    return { name, headerRow, confidence, mapping, dataRows };
  });
  // 默认选得分最高的 sheet：命中字段优先，其次含件号/数量，再其次数据行数
  let best = sheets[0];
  if (best) {
    const score = (s: SheetMeta) =>
      s.confidence * 100 +
      (s.mapping.partNumber !== undefined ? 10 : 0) +
      (s.mapping.quantity !== undefined ? 10 : 0) +
      Math.min(s.dataRows || 0, 200) / 10;
    for (const s of sheets) {
      if (score(s) > score(best)) best = s;
    }
  }
  return { sheets, defaultSheet: best ? best.name : "" };
}

/** 取指定 sheet 表头行的单元格文本（供列映射下拉使用） */
export function getHeaderCells(wb: XLSX.WorkBook, sheetName: string, headerRow: number): string[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = sheetRows(ws);
  const row = rows[headerRow - 1];
  if (!row) return [];
  return row.map((c) => String(c ?? "").trim()).filter((c) => c !== "");
}

/** 解析指定 sheet 为采购明细 */
export function parseSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  headerRow: number,
  mapping: FieldMapping
): ParsedRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = sheetRows(ws);
  const out: ParsedRow[] = [];
  const dataStart = headerRow; // 表头行索引（0-based）即 rows[headerRow-1]
  if (dataStart >= rows.length) return [];

  let seq = 0;
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    const cell = (idx?: number) => {
      if (idx === undefined || idx < 0 || idx >= row.length) return "";
      const v = String(row[idx] ?? "").trim();
      return v;
    };

    const partNumber = cell(mapping.partNumber);
    const quantityRaw = cell(mapping.quantity);
    const errors: string[] = [];

    // 空行跳过（关键字段全空）
    const brandName = cell(mapping.brandName);
    const equipmentModel = cell(mapping.equipmentModel);
    const productName = cell(mapping.productName);
    const description = cell(mapping.description);
    if (
      !partNumber &&
      !brandName &&
      !equipmentModel &&
      !productName &&
      !description &&
      !quantityRaw
    ) {
      continue;
    }

    if (mapping.partNumber !== undefined && !partNumber) {
      errors.push(`第 ${r + 1} 行件号为空`);
    }
    let quantity: number | null = null;
    if (mapping.quantity !== undefined) {
      const cleaned = quantityRaw.replace(/,/g, "").replace(/\.0+$/g, "");
      if (!cleaned) {
        errors.push(`第 ${r + 1} 行数量为空`);
      } else {
        quantity = parseInt(cleaned, 10);
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`第 ${r + 1} 行数量无效（${quantityRaw}）`);
          quantity = null;
        }
      }
    }

    seq++;
    out.push({
      rowNum: r + 1,
      seq,
      brandName,
      equipmentModel,
      productName,
      partNumber,
      quantity,
      unit: cell(mapping.unit) || "pcs",
      description,
      errors,
    });
  }
  return out;
}
