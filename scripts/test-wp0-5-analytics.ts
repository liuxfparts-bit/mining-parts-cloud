import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}
function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/0007_wp0_5_analytics_fact_layer/migration.sql");
const endpoint = read("src/app/api/analytics/event/route.ts");
const tracker = read("src/components/AnalyticsTracker.tsx");
const dashboard = read("src/app/admin/analytics/page.tsx");
const rfq = read("src/app/actions.ts");
const quote = read("src/app/api/quote/route.ts");
const register = read("src/app/api/register/route.ts");

expect(schema.includes("model AnalyticsSession"), "AnalyticsSession model missing");
expect(schema.includes("model AnalyticsEvent"), "AnalyticsEvent model missing");
expect(migration.includes('CREATE TABLE "AnalyticsSession"') && migration.includes('CREATE TABLE "AnalyticsEvent"'), "analytics migration incomplete");
expect(!schema.match(/ipAddress|clientIp|remoteAddress/i), "analytics schema must not store IP addresses");
expect(endpoint.includes('new Set(["PAGE_VIEW", "SEARCH"])'), "public analytics endpoint must whitelist event types");
expect(endpoint.includes('maxAge: 1800'), "analytics session must use 30-minute cookie");
expect(tracker.includes('["/admin", "/dashboard", "/supplier", "/api"]'), "private/backoffice paths must be excluded");
expect(dashboard.includes('businessAuthenticity: "REAL"'), "dashboard business metrics must count REAL facts only");
expect(dashboard.includes("UNKNOWN/TEST 均不进入真实经营指标"), "dashboard must quarantine unknown/test business facts");
expect(dashboard.includes("这些历史值不进入本驾驶舱"), "dashboard must quarantine legacy supplier counters");
expect(rfq.includes('eventType: "RFQ_CREATE"'), "RFQ conversion event missing");
expect(quote.includes('eventType: "QUOTE_CREATE"'), "Quote conversion event missing");
expect(register.match(/eventType: "REGISTER"/g)?.length === 2, "Buyer and supplier registration events required");

console.log("WP0-5 analytics static checks passed");
