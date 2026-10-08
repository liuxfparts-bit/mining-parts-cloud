-- WP0-5 analytics fact layer. Additive only; no legacy counters are rewritten.
CREATE TABLE "AnalyticsSession" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "userId" INTEGER,
  "landingPath" TEXT NOT NULL,
  "referrer" TEXT,
  "source" TEXT NOT NULL DEFAULT 'direct',
  "medium" TEXT NOT NULL DEFAULT 'none',
  "campaign" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
  "id" BIGSERIAL NOT NULL,
  "eventType" TEXT NOT NULL,
  "visitorId" TEXT,
  "sessionId" TEXT,
  "userId" INTEGER,
  "path" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" INTEGER,
  "searchQuery" TEXT,
  "resultCount" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsSession_visitorId_idx" ON "AnalyticsSession"("visitorId");
CREATE INDEX "AnalyticsSession_startedAt_idx" ON "AnalyticsSession"("startedAt");
CREATE INDEX "AnalyticsSession_source_startedAt_idx" ON "AnalyticsSession"("source", "startedAt");
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX "AnalyticsEvent_visitorId_createdAt_idx" ON "AnalyticsEvent"("visitorId", "createdAt");
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "AnalyticsEvent"("sessionId", "createdAt");
CREATE INDEX "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");
CREATE INDEX "AnalyticsEvent_entityType_entityId_createdAt_idx" ON "AnalyticsEvent"("entityType", "entityId", "createdAt");
