# Asset Gate V1 — Phase 3B-1 verification and migration reconciliation (2026-10-08)

Status: LOCAL CODE AND ISOLATED POSTGRESQL TESTS PASS. PR REVIEW ELIGIBLE; NOT DEPLOYMENT ELIGIBLE.

## Source baseline
- Base origin/main: 88a0e209e75c6033e48c8f507b852d4d875a21e5
- Worktree: H:\mining-parts-cloud-phase3b1
- Branch: codex/asset-gate-v1-phase3b1-evidence-foundation
- Original worktree and tsconfig.tsbuildinfo unchanged.

## Reconciled migration history
- Origin/main tracks 0001-0005 only.
- Origin/production and origin/fix/p0-3-product-verification-integrity both track 0006-0008 with identical Git blob IDs:
  - 0006_admin_security_audit: 95cc71cb5337ff2e3f1794576191011fdcee1432
  - 0007_wp0_5_analytics_fact_layer: 28b5ff8abe8f6358890990f84530394801d30282
  - 0008_trust_kernel_business_authenticity: 1b07bbf48462602a55cc9060fb9d6db338f22dbb
- Recovered 0006-0008 byte-for-byte into isolated worktree from origin/production.
- Restored matching Prisma fields: User.sessionVersion, SecurityAuditLog, BusinessAuthenticity on RFQ/Quote/RFQInvitation, AnalyticsSession, AnalyticsEvent and indexes.
- Prisma diff from origin/production schema to current schema generates ONLY three new evidence tables/enums and related indexes/FKs (Phase 3B-1).
- Production database _prisma_migrations checksums NOT verified live; prior audit confirms 0006-0008 applied, but no production DB read was performed. Must compare before deployment.

## Isolated integration environment
- Windows-local embedded PostgreSQL 16.14 installed only under user TEMP (not production and not in repo).
- Bound to 127.0.0.1:55438, database evidence_test, user evidence_test.
- Prisma migrate deploy: ALL 0001-0009 applied successfully in isolation.
- Prisma migrate status: Database schema is up to date.
- Prisma DB-to-schema diff: only an index rename suggestion for existing PartNumberCrossReference unique index (historical migration naming; unrelated to Phase 3B-1).
- Test DB contains only synthetic fixtures; no production data copied.

## Validation
- Prisma schema validate: PASS.
- Prisma client generate: PASS.
- TypeScript --noEmit --incremental false: PASS.
- Next.js build: PASS (existing Edge Runtime warnings, nonfatal).
- Phase 1/2 Gate regression: PASS (19 groups, no rule changes).
- Evidence foundation pure/static checks: PASS 16.
- PostgreSQL integration: PASS 15, rerun successful with unique test fixtures.
- DB tests cover source/item creation, active admin authorization, premature confirmation rejection, target XOR, UPDATE/DELETE triggers, cross-target predecessor, concurrent review conflict, same-target revocation, rollback.
- git diff --check: PASS.

## Security and deployment constraints
- The repo docker-compose.yml uses the same database role for application and database provisioning; separate least-privilege runtime role is NOT validated. A table owner could disable triggers, so trigger-only immutability is insufficient against a privileged DB principal.
- New evidence tables have append-only triggers and app-layer active ADMIN checks. Production role policy remains a separate approval task.
- No independent source authenticity or PN×Equipment fitment trust can be produced in 3B-1. No Gate/Manifest/Importer/public behavior changes.
- No production DB reads/writes, no production migration, no deployment, no legacy backfill, no changes to 160 PNs / 162 relations.

## Decision recommendation
PHASE3B1_PR_REVIEW=GO (code review only; do not merge/deploy automatically)
PHASE3B1_PRODUCTION_DEPLOY=NO_GO
BEFORE_MERGE=review migration recovery scope, database permission boundary, and production migration checksum reconciliation.

## 2026-10-08 isolated PostgreSQL validation update

- Discovered existing portable PostgreSQL 16.14 binaries under the local temporary directory; no Windows-wide database service was installed.
- Created a separate PostgreSQL cluster at H:\kuangpeiyun-phase3b1-pgtest\data, bound exclusively to 127.0.0.1:55439, database evidence_test. This is NOT the production database.
- Prisma migrate deploy against this isolated database: 0001 through 0009 ALL PASS.
- Evidence foundation pure/static tests: 16 PASS.
- Evidence foundation PostgreSQL integration tests: 15 PASS, including XOR, premature confirmation, append-only UPDATE/DELETE, predecessor isolation, concurrent review (one winner), revocation and transaction rollback.
- Test server shut down after validation; 127.0.0.1:55439 is closed.
- Source migration files 0006/0007/0008 match SHA-256 against existing local P0-5 worktree, but are absent from origin/main. Production _prisma_migrations checksums NOT independently compared.
- Official PostgreSQL 16.15 installer downloaded but not executed; kept outside Git worktree under H:\kuangpeiyun-phase3b1-pgtest\installer.
- Integration blocker is now CLOSED for this test scope. Remaining PR/merge blocker: reconcile production migration checksums and review untracked 0006–0008 provenance/commit strategy.
- This update supersedes the earlier 'DB tests not run' entry above.

## 2026-10-08 migration history reconciliation — local findings

- `origin/main` does not track migrations 0006, 0007 or 0008; the Phase 3B-1 worktree contains local untracked copies.
- Local SQL SHA-256 (hex lowercase):
  - 0006_admin_security_audit = `9ba66a4cecc2f33a3b23d359484492220178d69637b8faa243844a6e29be6b3c`
  - 0007_wp0_5_analytics_fact_layer = `bbf1593b41117d3c0c0109788cbd699e0ad05098b1f6948a0d205697c4b36ba5`
  - 0008_trust_kernel_business_authenticity = `fe4cd5010df78c054274a54d88e9bdca5a7bd15e28ff2a7f1877ebf10e2ff758`
- Prior audit said production migrations 0006–0008 are applied. This report does NOT treat that as checksum proof.
- Noninteractive SSH read-only attempt from Windows was unsuccessful (exit 255), so production `_prisma_migrations.checksum` values remain UNVERIFIED.
- NO PR, push, commit, production migration or database write authorized until production checksum comparison is obtained and reviewed.

## Production checksum reconciliation — VERIFIED (supersedes previous blockers)

The operator supplied production `_prisma_migrations` records: 0006, 0007 and 0008 all finished, none rolled back. Their checksums match exactly when local SQL files use LF rather than Windows CRLF. The three migration files have now been normalized to LF, and `.gitattributes` pins `eol=lf` for these paths.

- 0006: `05f10c1dfb485234c3637d98c6e787e754275d5f71d627e9b33fc44d7b847f86`
- 0007: `1b379b678e3d557209c3e0ce7db7acbcf3f380a59594d4717fc4f9daec6653e9`
- 0008: `27f7afcb4b9f676d147ba12a566cee20fdf5b8bc06ffa4b0ad81897a26d04f06`

Migration checksum blocker CLOSED for 0006–0008. No production writes. Phase 3B-1 remains pending final review/PR decision; no production deployment authorized.
