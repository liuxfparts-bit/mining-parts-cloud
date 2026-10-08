# Evidence Contract V1 — Phase 3B-1 foundation

Status: CONDITIONALLY APPROVED for isolated implementation only. No production trust or migration authorization.

## Trust boundaries
1. Declared source kind, issuer, filename, SHA-256, metadata and existing VERIFIED status never establish authenticity.
2. Phase 3B-1 persists only PENDING_CAPTURE metadata and unverified item locators. It cannot confirm source authenticity, item fidelity, PN identity or equipment fitment.
3. No source-to-Gate adapter, no publish authorization and no importer changes in this slice.
4. A source revision and item revision are immutable. Changes create new versions. Review history is append-only.
5. Review dimensions in this slice: SOURCE_METADATA and ITEM_FIDELITY. Neither means SOURCE_AUTHENTICITY.
6. All CONFIRMED review events are prohibited until immutable private evidence snapshots are available in Phase 3B-2.
7. Rejected, conflicted, requested-more-evidence and revoked events can be appended, never overwritten.
8. Evidence independence requires separately verified provenance groups. A submitter-supplied independenceGroupClaim has zero trust weight.
9. Legacy 160 PNs and 162 PN-equipment relations retain IDs, fields and statuses; no backfill or downgrade.
10. Phase 1 Gate and Phase 2 Manifest 1.0 remain unchanged.

## Versioning, review and persistence
- Source: stableKey + revision, SHA-256 over canonical metadata.
- Item: stableKey + revision, locator + frozen source version/fingerprint.
- Review: target XOR, target-specific dimension, expected sequence, same-target predecessor, same-target revocation, idempotency key, reviewer and reason.
- Hashes are integrity digests, not signatures or issuer authentication.
- New tables use Restrict FKs and database triggers rejecting UPDATE/DELETE.
- App-layer active ADMIN checks are defense in depth; direct DB writes must remain controlled by DB permissions.
- Metadata/locator may be stored while capture pending; it is not evidence of the claim itself.
- Review expiration and revocation do not rewrite historical events; future current-effective checks must use time, chain and conflicts.

## Deferred
3B-2: private immutable attachment, server byte hash, authorization, source authenticity review.
3C-1: PN Identity Evidence and independent PN × Equipment Fitment Evidence.
3C-2: canonical Gate input/evidence bundle and Manifest bindings.
Phase 4+: human review UI and publication authorization.

## Safety
No database connection to production, no migration apply, no public read switch, no automatic trusted decisions.
Migration 0009 is a DRAFT: repository migration history currently only contains 0001–0005, while prior production audit reported 0006–0008. Reconcile before any deployment.
