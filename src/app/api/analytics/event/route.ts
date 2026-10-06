import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ANALYTICS_SESSION_COOKIE, ANALYTICS_VISITOR_COOKIE } from "@/lib/analytics";

const ALLOWED = new Set(["PAGE_VIEW", "SEARCH"]);
const PRIVATE_PREFIXES = ["/admin", "/dashboard", "/supplier", "/api"];

function clean(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeReferrer(value: string) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return `${u.origin}${u.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}

function attribution(pageUrl: string, referrer: string, host: string) {
  let source = "direct";
  let medium = "none";
  let campaign: string | null = null;
  try {
    const u = new URL(pageUrl, `https://${host || "kuangpeiyun.com"}`);
    const utmSource = clean(u.searchParams.get("utm_source"), 100);
    const utmMedium = clean(u.searchParams.get("utm_medium"), 100);
    campaign = clean(u.searchParams.get("utm_campaign"), 150) || null;
    if (utmSource) {
      source = utmSource;
      medium = utmMedium || "campaign";
    } else if (referrer) {
      const r = new URL(referrer);
      if (r.host && r.host !== u.host) {
        source = r.hostname.slice(0, 100);
        medium = "referral";
      }
    }
  } catch {}
  return { source, medium, campaign };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = clean(body.eventType, 40);
    const path = clean(body.path, 500);
    if (!ALLOWED.has(eventType) || !path || PRIVATE_PREFIXES.some((p) => path.startsWith(p))) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const now = new Date();
    const visitorId = req.cookies.get(ANALYTICS_VISITOR_COOKIE)?.value || randomUUID();
    const sessionId = req.cookies.get(ANALYTICS_SESSION_COOKIE)?.value || randomUUID();
    const pageUrl = clean(body.url, 1000) || path;
    const referrerRaw = clean(body.referrer, 1000);
    const referrer = safeReferrer(referrerRaw);
    const attr = attribution(pageUrl, referrerRaw, req.headers.get("host") || "");

    const existing = await prisma.analyticsSession.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (existing) {
      await prisma.analyticsSession.update({ where: { id: sessionId }, data: { lastSeenAt: now } });
    } else {
      await prisma.analyticsSession.create({
        data: {
          id: sessionId,
          visitorId,
          landingPath: path,
          referrer,
          source: attr.source,
          medium: attr.medium,
          campaign: attr.campaign,
          startedAt: now,
          lastSeenAt: now,
        },
      });
    }

    await prisma.analyticsEvent.create({
      data: {
        eventType,
        visitorId,
        sessionId,
        path,
        searchQuery: eventType === "SEARCH" ? clean(body.searchQuery, 200) || null : null,
        resultCount: eventType === "SEARCH" && Number.isInteger(body.resultCount) ? Math.max(0, body.resultCount) : null,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
      },
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ANALYTICS_VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 31536000 });
    res.cookies.set(ANALYTICS_SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 1800 });
    return res;
  } catch (error) {
    console.error("[analytics] event endpoint failed", error);
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
