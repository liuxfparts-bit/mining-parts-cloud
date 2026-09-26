#!/usr/bin/env python3
from pathlib import Path
import sys

TARGET = Path("src/app/part-number/[partNumber]/page.tsx")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FAIL {label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    if not TARGET.exists():
        raise SystemExit(f"FAIL: missing {TARGET}")

    text = TARGET.read_text()
    original = text

    text = replace_once(
        text,
        'import { PUBLIC_PRODUCT_WHERE_NESTED } from "@/lib/public-product";\n',
        'import { PUBLIC_PRODUCT_WHERE_NESTED } from "@/lib/public-product";\nimport { PUBLIC_PN_WHERE } from "@/lib/part-number";\n',
        "PUBLIC_PN_WHERE import",
    )

    text = replace_once(
        text,
        '  // 公开页面限制：只展示 publishStatus=READY 的件号\n  if (pn.publishStatus !== "READY") notFound();',
        '  // 公开页面唯一门槛：件号本身必须 VERIFIED + READY。\n  if (pn.verificationStatus !== "VERIFIED" || pn.publishStatus !== "READY") notFound();',
        "public detail guard",
    )

    text = replace_once(
        text,
        '      publishStatus: "READY",\n      OR: [',
        '      ...PUBLIC_PN_WHERE,\n      OR: [',
        "related Part Number public guard",
    )

    text = text.replace(
        'title="该件号及适用设备信息已经过矿配云数据审核。验证状态不代表原厂授权、库存状态或供应商资质。"',
        'title="该 Part Number 主数据已经过矿配云审核。此状态不代表某一设备适配关系已验证，也不代表原厂授权、库存状态或供应商资质。"',
    )

    basic_end = '''      </div>\n\n      {/* 供应商产品 */}'''
    relation_section = '''      </div>\n\n      {/* P2-1B-2: PN 与设备关系可信度。关系存在不等于适配已经验证。 */}\n      <div className="bg-white border border-line rounded-lg p-4 md:p-6 mb-6">\n        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">\n          <h2 className="text-lg font-bold">适用设备与关系证据</h2>\n          <span className="text-xs text-muted">件号验证与设备适配关系分别审核</span>\n        </div>\n        {pn.equipmentRelations.length === 0 ? (\n          <div className="rounded-md border border-dashed border-line p-4 text-sm text-muted">\n            暂无已登记的设备关系。没有设备关系不代表该件号不存在，仅表示当前数据库尚未建立适配关系。\n          </div>\n        ) : (\n          <div className="space-y-3">\n            {pn.equipmentRelations.map((relation) => {\n              const eq = relation.equipmentModel;\n              const relationVerified = relation.verificationStatus === "VERIFIED";\n              return (\n                <div key={relation.id} className="rounded-lg border border-line p-4">\n                  <div className="flex flex-wrap items-start justify-between gap-3">\n                    <div>\n                      <Link href={`/equipment/${eq.slug}`} className="font-semibold text-accent hover:underline">\n                        {eq.model}\n                      </Link>\n                      <div className="text-sm text-muted mt-0.5">{eq.name}</div>\n                    </div>\n                    {relationVerified ? (\n                      <span className="inline-flex items-center gap-1 text-xs text-brandGreen">\n                        <CheckCircle2 size={13} /> 关系已验证\n                      </span>\n                    ) : (\n                      <span className="text-xs text-muted">关系待验证</span>\n                    )}\n                  </div>\n                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">\n                    <div>\n                      <dt className="text-muted">证据状态</dt>\n                      <dd className="font-medium mt-0.5">{relation.evidenceStatus}</dd>\n                    </div>\n                    <div>\n                      <dt className="text-muted">关系验证</dt>\n                      <dd className="mt-0.5">{relationVerified ? <span className="text-brandGreen">已验证</span> : "待验证"}</dd>\n                    </div>\n                    <div className="md:col-span-2">\n                      <dt className="text-muted">证据摘要</dt>\n                      <dd className="mt-0.5 whitespace-pre-wrap">{relation.evidenceSummary || "暂无明确证据摘要"}</dd>\n                    </div>\n                    {relation.sourceReference && (\n                      <div className="md:col-span-2">\n                        <dt className="text-muted">来源参考</dt>\n                        <dd className="mt-0.5 break-words">{relation.sourceReference}</dd>\n                      </div>\n                    )}\n                  </dl>\n                </div>\n              );\n            })}\n          </div>\n        )}\n        <p className="text-xs text-muted mt-3">\n          说明：设备关系记录表示数据库中存在该件号与设备型号的关联；只有“关系已验证”才表示该适配关系已经过矿配云审核。\n        </p>\n      </div>\n\n      {/* 供应商产品 */}'''
    text = replace_once(text, basic_end, relation_section, "equipment relation section")

    if text == original:
        raise SystemExit("FAIL: no changes produced")

    TARGET.write_text(text)
    print("APPLIED P2-1B-2")
    print(f"modified: {TARGET}")
    print("No schema/migration/database changes.")


if __name__ == "__main__":
    main()
