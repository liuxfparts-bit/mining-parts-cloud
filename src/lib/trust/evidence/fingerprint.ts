import { createHash } from "node:crypto";
import type { ItemSnapshot, SourceSnapshot } from "./contract";
export function canonicalJson(value: unknown): string {
  const active = new Set<object>();
  function normalize(v: unknown): unknown {
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number") { if (!Number.isFinite(v)) throw new Error("nonfinite number"); return v; }
    if (Array.isArray(v)) {
      if (active.has(v)) throw new Error("cyclic input");
      active.add(v); const result = v.map(normalize); active.delete(v); return result;
    }
    if (typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype) {
      if (active.has(v)) throw new Error("cyclic input");
      active.add(v); const o: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) {
        const x = (v as Record<string, unknown>)[k];
        if (x === undefined) throw new Error("undefined field");
        o[k] = normalize(x);
      }
      active.delete(v); return o;
    }
    throw new Error("unsupported canonical value");
  }
  return JSON.stringify(normalize(value));
}
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
export function sourceFingerprint(s: SourceSnapshot): string {
  return fingerprint({ version: "evidence-source-v1", ...s });
}
export function itemFingerprint(s: ItemSnapshot): string {
  return fingerprint({ version: "evidence-item-v1", ...s });
}
