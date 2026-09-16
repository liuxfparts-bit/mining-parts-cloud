// 智能询价单字段标准化 / 字段映射系统（浏览器端）
// 支持 .xlsx / .xls / .csv
// 能力：表头行自动定位 + 字段同义词词典（中英）+ 权重竞争 + 数据内容辅助判断
//       + 字段置信度 + 列抢占保护 + 附加采购信息保留 + 件号强制字符串
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

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

/** 单个标准字段的映射信息（供 UI 展示置信度与原因） */
export interface FieldMappingInfo {
  field: keyof FieldMapping;
  label: string; // 标准字段中文名
  excelCol: number | null; // 命中的 Excel 列（0-based），null=未映射
  confidence: Confidence;
  reason?: string; // 识别依据，如"表头 件号(高) + 内容为件号特征"
}

/** 附加列（单价/总计/货期/原厂/OEM/国产 等暂不进入 RFQItem 的列） */
export interface ExtraColumn {
  col: number; // 0-based
  header: string; // 原始表头文本
  samples: string[]; // 前 3 个非空数据样例
  kind: "SEQ" | "ATTACHMENT" | "UNKNOWN"; // 序号列 / 附加采购信息 / 未识别列
  note?: string;
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
  confidence: number; // 加权命中分（非简单计数）
  mapping: FieldMapping;
  mappingInfo: Record<string, FieldMappingInfo>; // 字段级置信度
  extraColumns: ExtraColumn[]; // 附加列（保留，不进入 RFQItem）
  colSamples: Record<number, string[]>; // 每列前 3 个非空数据样例（供人工判断）
  dataRows: number; // 表头以下数据行数（估算）
}

export interface WorkbookParseResult {
  sheets: SheetMeta[];
  defaultSheet: string;
}

// ============================================================
// 一、字段同义词词典（统一配置，勿散落组件）
// 权重：1.0=强信号；0.5~0.9=常用但需内容佐证；<0.5=泛词/歧义词，仅作参考
// ============================================================
interface Alias {
  kw: string; // 规范化关键词（小写、无空格标点）
  w: number; // 权重
}

const FIELD_ALIASES: Record<keyof FieldMapping, { label: string; aliases: Alias[] }> = {
  partNumber: {
    label: "件号",
    aliases: [
      { kw: "件号", w: 1.0 }, { kw: "配件号", w: 1.0 }, { kw: "零件号", w: 1.0 },
      { kw: "物料号", w: 0.9 }, { kw: "物料编码", w: 0.9 }, { kw: "料号", w: 1.0 },
      { kw: "货号", w: 0.8 }, { kw: "产品编号", w: 0.8 }, { kw: "备件号", w: 1.0 },
      { kw: "原厂件号", w: 1.0 }, { kw: "oem件号", w: 1.0 }, { kw: "图号", w: 0.8 },
      { kw: "partnumber", w: 1.0 }, { kw: "partno", w: 1.0 }, { kw: "part#", w: 1.0 },
      { kw: "p/n", w: 1.0 }, { kw: "pn", w: 0.9 }, { kw: "partcode", w: 1.0 },
      { kw: "itemno", w: 0.7 }, { kw: "itemnumber", w: 0.7 },
      { kw: "materialno", w: 0.8 }, { kw: "materialnumber", w: 0.8 },
      { kw: "productno", w: 0.7 }, { kw: "oemno", w: 0.9 },
      { kw: "oempartno", w: 1.0 }, { kw: "sparepartno", w: 1.0 },
    ],
  },
  productName: {
    label: "配件名称",
    aliases: [
      { kw: "配件名称", w: 1.0 }, { kw: "产品名称", w: 1.0 }, { kw: "物品名称", w: 0.9 },
      { kw: "物料名称", w: 0.9 }, { kw: "备件名称", w: 1.0 }, { kw: "零件名称", w: 0.9 },
      { kw: "品名", w: 0.9 }, { kw: "名称", w: 0.5 }, { kw: "物品", w: 0.5 },
      { kw: "配件", w: 0.8 }, { kw: "零件", w: 0.8 },
      { kw: "description", w: 0.5 }, { kw: "partdescription", w: 1.0 },
      { kw: "productdescription", w: 1.0 }, { kw: "productname", w: 1.0 },
      { kw: "partname", w: 1.0 }, { kw: "itemdescription", w: 1.0 },
      { kw: "materialdescription", w: 1.0 }, { kw: "sparepart", w: 1.0 },
      { kw: "spareparts", w: 1.0 },
    ],
  },
  brandName: {
    label: "品牌",
    aliases: [
      { kw: "品牌", w: 1.0 }, { kw: "品牌名称", w: 1.0 }, { kw: "制造商", w: 0.9 },
      { kw: "厂家", w: 0.9 }, { kw: "生产厂家", w: 0.9 }, { kw: "制造厂商", w: 0.9 },
      { kw: "原品牌", w: 0.8 }, { kw: "设备品牌", w: 0.8 },
      { kw: "brand", w: 1.0 }, { kw: "brandname", w: 1.0 }, { kw: "manufacturer", w: 0.9 },
      { kw: "manufacturername", w: 0.9 }, { kw: "make", w: 0.9 }, { kw: "maker", w: 0.8 },
      { kw: "oem", w: 0.3 }, // OEM 可能表示供货来源，权重低，不轻易当品牌
    ],
  },
  equipmentModel: {
    label: "设备型号",
    aliases: [
      { kw: "设备型号", w: 1.0 }, { kw: "机型", w: 0.9 }, { kw: "设备名称", w: 0.8 },
      { kw: "机器型号", w: 0.9 }, { kw: "主机型号", w: 0.9 }, { kw: "适用设备", w: 0.9 },
      { kw: "适用机型", w: 0.9 }, { kw: "设备", w: 0.5 },
      { kw: "equipmentmodel", w: 1.0 }, { kw: "equipment", w: 0.5 },
      { kw: "machinemodel", w: 1.0 }, { kw: "machinetype", w: 0.8 },
      { kw: "equipmenttype", w: 0.8 }, { kw: "applicableequipment", w: 0.9 },
      { kw: "applicablemodel", w: 0.9 }, { kw: "model", w: 0.6 },
    ],
  },
  quantity: {
    label: "数量",
    aliases: [
      { kw: "数量", w: 1.0 }, { kw: "数目", w: 0.9 }, { kw: "需求数量", w: 1.0 },
      { kw: "采购数量", w: 1.0 }, { kw: "申购数量", w: 1.0 }, { kw: "数量需求", w: 1.0 },
      { kw: "qty", w: 1.0 }, { kw: "quantity", w: 1.0 }, { kw: "requiredqty", w: 1.0 },
      { kw: "requiredquantity", w: 1.0 }, { kw: "orderqty", w: 1.0 },
      { kw: "requestedqty", w: 1.0 },
    ],
  },
  unit: {
    label: "单位",
    aliases: [
      { kw: "单位", w: 1.0 }, { kw: "计量单位", w: 1.0 }, { kw: "单位名称", w: 1.0 },
      { kw: "unit", w: 1.0 }, { kw: "uom", w: 1.0 }, { kw: "unitofmeasure", w: 1.0 },
      { kw: "measurementunit", w: 1.0 },
    ],
  },
  description: {
    label: "描述",
    aliases: [
      { kw: "描述", w: 0.8 }, { kw: "备注", w: 0.7 }, { kw: "说明", w: 0.7 },
      { kw: "技术要求", w: 0.9 }, { kw: "技术参数", w: 0.9 }, { kw: "规格", w: 0.7 },
      { kw: "规格型号", w: 0.7 }, { kw: "要求", w: 0.6 }, { kw: "采购要求", w: 0.9 },
      { kw: "备注说明", w: 0.8 },
      { kw: "description", w: 0.6 }, { kw: "remark", w: 0.6 }, { kw: "remarks", w: 0.6 },
      { kw: "specification", w: 0.8 }, { kw: "specifications", w: 0.8 },
      { kw: "specs", w: 0.8 }, { kw: "technicalrequirement", w: 1.0 },
      { kw: "requirement", w: 0.6 }, { kw: "requirements", w: 0.6 },
      { kw: "comment", w: 0.6 }, { kw: "comments", w: 0.6 }, { kw: "notes", w: 0.6 },
    ],
  },
};

/** 序号列关键词（数据行序号，忽略） */
const SEQ_ALIASES = ["序号", "编号", "项次", "行号", "no", "item", "sl", "slno", "line", "seq"];

/** 附加采购信息列（保留展示，不进入 RFQItem） */
const ATTACH_ALIASES: { kw: string; note: string }[] = [
  { kw: "单价", note: "采购单价（暂不进入明细）" },
  { kw: "unitprice", note: "采购单价（暂不进入明细）" },
  { kw: "总价", note: "总价/总计（暂不进入明细）" },
  { kw: "总计", note: "总价/总计（暂不进入明细）" },
  { kw: "总金额", note: "总价/总计（暂不进入明细）" },
  { kw: "金额", note: "总价/总计（暂不进入明细）" },
  { kw: "total", note: "总价/总计（暂不进入明细）" },
  { kw: "amount", note: "总价/总计（暂不进入明细）" },
  { kw: "price", note: "价格（暂不进入明细）" },
  { kw: "货期", note: "交货期（暂不进入明细）" },
  { kw: "交期", note: "交货期（暂不进入明细）" },
  { kw: "交货期", note: "交货期（暂不进入明细）" },
  { kw: "leadtime", note: "交货期（暂不进入明细）" },
  { kw: "delivery", note: "交货期（暂不进入明细）" },
  { kw: "原厂", note: "供货来源（原厂/OEM/国产，暂不进入明细）" },
  { kw: "oem", note: "供货来源（原厂/OEM/国产，暂不进入明细）" },
  { kw: "国产", note: "供货来源（原厂/OEM/国产，暂不进入明细）" },
  { kw: "进口", note: "供货来源（原厂/OEM/国产，暂不进入明细）" },
  { kw: "品牌等级", note: "品牌/质量等级（暂不进入明细）" },
];

// ============================================================
// 二、表头规范化与基础匹配
// ============================================================
function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s_\-()（）.#/\\:：，,、]+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

/** 单个列 → 所有字段的匹配权重（含表头词 + 内容佐证） */
interface ColScore {
  col: number;
  header: string;
  fieldScores: { field: keyof FieldMapping; w: number; aliasKw: string }[];
}

function scoreColumn(col: number, headerRaw: string, samples: string[]): ColScore {
  const key = normalizeHeader(headerRaw);
  const scores: ColScore["fieldScores"] = [];
  if (!key) return { col, header: headerRaw, fieldScores: scores };

  // 表头词权重
  for (const field of Object.keys(FIELD_ALIASES) as (keyof FieldMapping)[]) {
    let bestW = 0;
    let bestKw = "";
    for (const a of FIELD_ALIASES[field].aliases) {
      if (key.includes(a.kw) && a.w > bestW) {
        bestW = a.w;
        bestKw = a.kw;
      }
    }
    if (bestW > 0) scores.push({ field, w: bestW, aliasKw: bestKw });
  }

  // 内容佐证（仅对弱表头信号起辅助作用，不覆盖强表头）
  const nonEmpty = samples.filter((s) => s && s.trim() !== "");
  if (nonEmpty.length > 0) {
    const sample = nonEmpty[0];
    const looksPartNo = /^[A-Za-z0-9][A-Za-z0-9\-\./]*$/.test(sample) && /[A-Za-z\-\./]/.test(sample);
    const looksLongNumber = /^\d{6,}$/.test(sample);
    const looksModel = /^[A-Za-z]{1,6}[ \-]?\d{1,4}[A-Za-z0-9\-]*$/.test(sample) && /[A-Za-z]/.test(sample) && /\d/.test(sample);
    const looksQty = /^\d{1,6}(\.\d+)?$/.test(sample);
    const looksChineseName = /[\u4e00-\u9fff]{2,}/.test(sample);
    if (looksPartNo || looksLongNumber) {
      // 件号特征内容：仅对"模型/model/编号"等歧义表头或空表头起辅助作用
      const pn = scores.find((s) => s.field === "partNumber");
      if (!pn) scores.push({ field: "partNumber", w: 0.55, aliasKw: "内容为件号特征" });
      else if (pn.w < 0.7) pn.w = Math.max(pn.w, 0.55);
    }
    if (looksModel) {
      const em = scores.find((s) => s.field === "equipmentModel");
      if (!em) scores.push({ field: "equipmentModel", w: 0.5, aliasKw: "内容为设备型号特征" });
      else if (em.w < 0.6) em.w = Math.max(em.w, 0.5);
    }
    if (looksQty) {
      const q = scores.find((s) => s.field === "quantity");
      if (!q) scores.push({ field: "quantity", w: 0.45, aliasKw: "内容为数字" });
    }
    if (looksChineseName && scores.length === 0) {
      // 完全无表头信号但内容像中文品名 → 弱提示 productName
      scores.push({ field: "productName", w: 0.4, aliasKw: "内容为中文名称" });
    }
  }
  return { col, header: headerRaw, fieldScores: scores };
}

/** 判定列是否为序号列（数据 1,2,3... 或表头含序号词） */
function isSeqColumn(headerRaw: string, samples: string[]): boolean {
  const key = normalizeHeader(headerRaw);
  if (SEQ_ALIASES.some((k) => key.includes(k))) return true;
  const nums = samples.map((s) => s.trim()).filter((s) => /^\d{1,4}$/.test(s));
  if (nums.length >= 2) {
    const vals = nums.map(Number);
    let inc = true;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] !== vals[i - 1] + 1) { inc = false; break; }
    }
    if (inc && vals.length >= 3) return true;
  }
  return false;
}

// ============================================================
// 三、表头行检测（加权评分 + 核心字段门槛）
// ============================================================
function detectHeader(rows: string[][]): {
  headerRow: number;
  confidence: number;
  mapping: FieldMapping;
  mappingInfo: Record<string, FieldMappingInfo>;
  extraColumns: ExtraColumn[];
  colSamples: Record<number, string[]>;
} {
  const maxScan = Math.min(rows.length, 15);
  let best: {
    headerRow: number;
    confidence: number;
    mapping: FieldMapping;
    mappingInfo: Record<string, FieldMappingInfo>;
    extraColumns: ExtraColumn[];
    colSamples: Record<number, string[]>;
  } | null = null;

  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    const colCount = row.length;
    // 取每列数据样例（表头行之后最多 3 个非空值）
    const samples: Record<number, string[]> = {};
    for (let c = 0; c < colCount; c++) {
      const arr: string[] = [];
      for (let rr = r + 1; rr < Math.min(rows.length, r + 6); rr++) {
        const v = String(rows[rr]?.[c] ?? "").trim();
        if (v && !arr.includes(v)) arr.push(v);
        if (arr.length >= 3) break;
      }
      samples[c] = arr;
    }

    // 逐列打分
    const colScores: ColScore[] = [];
    row.forEach((cell, c) => {
      colScores.push(scoreColumn(c, String(cell ?? ""), samples[c] || []));
    });

    // 贪心分配：同一列只能映射一个核心字段；同一字段只取权重最高列
    // 按权重从高到低分配，实现列抢占保护
    const all: { field: keyof FieldMapping; col: number; w: number; aliasKw: string }[] = [];
    for (const cs of colScores) {
      for (const fs of cs.fieldScores) all.push({ field: fs.field, col: cs.col, w: fs.w, aliasKw: fs.aliasKw });
    }
    all.sort((a, b) => b.w - a.w);
    const mapping: FieldMapping = {};
    const usedCols = new Set<number>();
    const usedFields = new Set<string>();
    for (const item of all) {
      if (usedCols.has(item.col) || usedFields.has(item.field)) continue;
      mapping[item.field] = item.col;
      usedCols.add(item.col);
      usedFields.add(item.field);
    }

    // 核心字段门槛：件号/数量/配件名称/品牌/设备型号 至少命中 2 个才算表头行
    const coreHits = ["partNumber", "quantity", "productName", "brandName", "equipmentModel"].filter(
      (f) => mapping[f as keyof FieldMapping] !== undefined
    ).length;
    if (coreHits < 2) continue;

    // 加权置信分
    let score = 0;
    for (const f of Object.keys(mapping) as (keyof FieldMapping)[]) {
      const item = all.find((x) => x.field === f && mapping[f] === x.col);
      if (item) score += item.w * 100;
    }
    score += Math.min(samplesToDataRows(rows, r + 1), 300) / 10;

    if (!best || score > best.confidence) {
      // 构建字段级映射信息（置信度）
      const mappingInfo: Record<string, FieldMappingInfo> = {};
      for (const f of Object.keys(FIELD_ALIASES) as (keyof FieldMapping)[]) {
        const col = mapping[f];
        let conf: Confidence = "NONE";
        let reason = "未识别";
        if (col !== undefined) {
          const item = all.find((x) => x.field === f && x.col === col);
          if (item) {
            const aliasKw = item.aliasKw;
            const headerWord = item.w >= 0.9;
            const ambiguous = item.w < 0.7;
            if (headerWord) {
              conf = ambiguous ? "MEDIUM" : "HIGH";
              reason = `表头 ${String(row[col])} 权重${item.w}${aliasKw.startsWith("内容") ? "，辅助判断" : ""}`;
            } else {
              conf = "LOW";
              reason = aliasKw.startsWith("内容") ? `表头匹配度低，${aliasKw}` : `表头 ${String(row[col])} 权重较低，请人工确认`;
            }
            if (f === "quantity") {
              const nums = (samples[col] || []).filter((s) => /^\d/.test(s));
              if (nums.length === 0 && !headerWord) { conf = "LOW"; reason += "，样例非数字"; }
            }
          }
        }
        mappingInfo[f] = { field: f, label: FIELD_ALIASES[f].label, excelCol: col ?? null, confidence: conf, reason };
      }

      // 附加列识别
      const extraColumns: ExtraColumn[] = [];
      for (const cs of colScores) {
        if (usedCols.has(cs.col)) continue;
        const h = String(cs.header).trim();
        if (!h) continue;
        const samples3 = (samples[cs.col] || []).slice(0, 3);
        if (isSeqColumn(h, samples3)) {
          extraColumns.push({ col: cs.col, header: h, samples: samples3, kind: "SEQ", note: "序号列，自动忽略" });
        } else {
          const att = ATTACH_ALIASES.find((a) => normalizeHeader(h).includes(a.kw));
          if (att) extraColumns.push({ col: cs.col, header: h, samples: samples3, kind: "ATTACHMENT", note: att.note });
          else extraColumns.push({ col: cs.col, header: h, samples: samples3, kind: "UNKNOWN", note: "未识别列，保留原始数据" });
        }
      }

      best = {
        headerRow: r + 1,
        confidence: score,
        mapping,
        mappingInfo,
        extraColumns,
        colSamples: samples,
      };
    }
  }

  if (!best) return { headerRow: 1, confidence: 0, mapping: {}, mappingInfo: {}, extraColumns: [], colSamples: {} };
  return best;
}

function samplesToDataRows(rows: string[][], from: number): number {
  let n = 0;
  for (let r = from; r < rows.length; r++) {
    if (rows[r] && rows[r].some((c) => String(c).trim() !== "")) n++;
  }
  return n;
}

// ============================================================
// 四、公开接口（与旧版兼容 + 新增字段）
// ============================================================
export function loadWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

function sheetRows(ws: XLSX.WorkSheet): string[][] {
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  }) as string[][];
}

export function parseWorkbook(wb: XLSX.WorkBook): WorkbookParseResult {
  const sheets: SheetMeta[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = sheetRows(ws);
    const { headerRow, confidence, mapping, mappingInfo, extraColumns, colSamples } = detectHeader(rows);
    let dataRows = 0;
    for (let r = headerRow; r < rows.length; r++) {
      if (rows[r] && rows[r].some((c) => String(c).trim() !== "")) dataRows++;
    }
    return { name, headerRow, confidence, mapping, mappingInfo, extraColumns, colSamples, dataRows };
  });
  let best = sheets[0];
  if (best) {
    const score = (s: SheetMeta) =>
      s.confidence +
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
  // 注意：返回完整行（含空列），保持列索引与 mapping 一致
  return row.map((c) => String(c ?? "").trim());
}

/** 解析指定 sheet 为采购明细（件号强制字符串；数量转数字） */
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
  if (headerRow >= rows.length + 1) return [];
  const dataStart = headerRow; // rows[headerRow-1] 为表头
  if (dataStart >= rows.length) return [];

  let seq = 0;
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    const cell = (idx?: number) => {
      if (idx === undefined || idx < 0 || idx >= row.length) return "";
      return String(row[idx] ?? "").trim();
    };

    const partNumber = cell(mapping.partNumber);
    const quantityRaw = cell(mapping.quantity);
    const errors: string[] = [];

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
