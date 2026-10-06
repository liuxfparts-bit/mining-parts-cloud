import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/0008_trust_kernel_business_authenticity/migration.sql");
const createRfq = read("src/app/actions.ts");
const quoteApi = read("src/app/api/quote/route.ts");
const invitations = read("src/lib/rfq-invitation.ts");
const analytics = read("src/app/admin/analytics/page.tsx");
const adminActions = read("src/app/admin/rfqs/actions.ts");
const selection = read("src/lib/quote-selection.ts");
const publicRfqs = read("src/app/rfqs/page.tsx");
const home = read("src/app/page.tsx");

assert.match(schema, /enum BusinessAuthenticity\s*{[\s\S]*UNKNOWN[\s\S]*REAL[\s\S]*TEST/);
assert.equal((schema.match(/businessAuthenticity BusinessAuthenticity @default\(UNKNOWN\)/g) || []).length, 3);

assert.match(migration, /CREATE TYPE "BusinessAuthenticity" AS ENUM \('UNKNOWN', 'REAL', 'TEST'\)/);
assert.equal((migration.match(/DEFAULT 'UNKNOWN'/g) || []).length, 3, "legacy migration must default all existing facts UNKNOWN");
assert.doesNotMatch(migration, /UPDATE\s+"?(RFQ|Quote|RFQInvitation)"?/i, "migration must not guess historical REAL/TEST");

assert.match(createRfq, /businessAuthenticity: "REAL"/, "new verified-buyer RFQ must be REAL");
assert.match(quoteApi, /businessAuthenticity: lockedRfq\.businessAuthenticity/, "new Quote must inherit parent RFQ classification");
assert.match(invitations, /businessAuthenticity: rfq\.businessAuthenticity/g, "new invitations must inherit RFQ classification");

assert.match(invitations, /businessAuthenticity: "REAL"[\s\S]*rfq:/, "recommendation history must use REAL quotes only");
assert.match(invitations, /quote\.groupBy\([\s\S]*businessAuthenticity: "REAL"/, "quote-count score must exclude TEST/UNKNOWN");

assert.match(publicRfqs, /visibility: "PUBLIC", businessAuthenticity: "REAL"/, "public RFQ directory must be REAL-only");
assert.match(home, /status: "COLLECTING", visibility: "PUBLIC", businessAuthenticity: "REAL"/, "homepage RFQs must be REAL-only");

assert.match(analytics, /rFQ\.count\(\{ where: \{ businessAuthenticity: "REAL"/);
assert.match(analytics, /quote\.count\(\{ where: \{ businessAuthenticity: "REAL"/);
assert.match(analytics, /entityId: \{ in: realRfqIdsToday\.map/, "conversion attribution must bind to REAL RFQ ids");
assert.match(analytics, /UNKNOWN\/TEST 均不进入真实经营指标/);

assert.match(adminActions, /setRfqBusinessAuthenticity/);
assert.match(adminActions, /quote\.updateMany\(\{ where: \{ rfqId: id \}, data: \{ businessAuthenticity: value \} \}\)/);
assert.match(adminActions, /rFQInvitation\.updateMany\(\{ where: \{ rfqId: id \}, data: \{ businessAuthenticity: value \} \}\)/);
assert.match(adminActions, /RFQ_BUSINESS_AUTHENTICITY_CHANGED/);
assert.match(adminActions, /setQuoteBusinessAuthenticity/);
assert.match(adminActions, /QUOTE_BUSINESS_AUTHENTICITY_CHANGED/);
assert.match(adminActions, /已接受报价必须与所属 RFQ 保持相同业务真实性/);
assert.match(selection, /rfq\.businessAuthenticity === "UNKNOWN"/);
assert.match(selection, /target\.businessAuthenticity !== rfq\.businessAuthenticity/);

console.log("Trust Kernel P0-2 business authenticity checks passed");
