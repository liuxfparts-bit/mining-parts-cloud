# Trust Kernel P0-5 — Trusted Capability Integrity

## Decision

Capability truth is tiered and must never be collapsed into one score:

- CLAIMED: supplier self-description or unverified Product claim.
- OBSERVED: relevant REAL commercial behavior (currently REAL Quote).
- TRUSTED: reviewed Product + trusted PartNumber + formally trusted Supplier identity.
- PERFORMED: future fulfillment evidence; not represented reliably in V1.

Ranking is tier-first: TRUSTED > OBSERVED > CLAIMED. Membership level never upgrades trust.

## Canonical predicates

Trusted capability evidence:

- Product.verificationStatus = VERIFIED
- PartNumber.verificationStatus = VERIFIED
- PartNumber.publishStatus = READY
- Supplier.verifiedStatus = VERIFIED
- Supplier.approvedAt and approvedBy are present
- Supplier has no DISABLED user

Publication is separate from trust. Public trusted capability additionally requires Product.status = PUBLISHED.
An OFFLINE verified Product may preserve historical reviewed evidence but is not public and is not an active public recommendation.

## Production truth audit (2026-10-06)

Read-only production checks established:

- ProductSupplier table: absent.
- Current relation model: Supplier -> Product -> PartNumber.
- Product: 457 total; 455 ACTIVE/UNVERIFIED, 1 OFFLINE/VERIFIED, 1 PUBLISHED/VERIFIED.
- Current trusted capability helper result: 0 rows / 0 suppliers / 0 part numbers.
- Both historical VERIFIED Products point to UNVERIFIED/HOLD PartNumbers and Supplier #1 lacks formal approval trail.
- Quote: 5 total, all TEST/PENDING; REAL Quote = 0.
- Supplier self-claim fields mainBrands/mainEquipment/mainBusiness: 5 of 11 suppliers.
- Supplier: 11/11 carry VERIFIED label, only 3/11 have formal approval trail, 0 have DISABLED users.

Therefore current production has claims, but no OBSERVED REAL Quote capability signal and no TRUSTED capability.

## Code controls

- public-product.ts owns the canonical trusted Product capability predicate and public Product predicate.
- supplier-capability.ts consumes the canonical trusted predicate.
- RFQ PartNumber resolution is exposed separately from supplier capability lookup.
- RFQ recommendations assign a trust tier before relevance scoring.
- REAL Quote is OBSERVED only; it never becomes TRUSTED automatically.
- Buyer supplier aggregations and “My Suppliers” exclude TEST/UNKNOWN Quote rows.
- “verified-only” supplier search uses formal Supplier identity trust, not the historical VERIFIED label alone.
- UI labels distinguish enterprise review, trusted capability, real business record, and supplier claim.

## No schema migration

P0-5 intentionally adds no SupplierCapability table and performs no historical data backfill.
The existing Product -> Supplier + PartNumber relationship is sufficient for V1 until first-class capability evidence, validity, or performance history requires a dedicated entity.

## Acceptance

Run:

- npm run test:trust-p0-5
- npm run test:trust-p0-2
- npm run test:trust-p0-3
- npm run test:trust-p0-4
- npm run test:trust-p0-4a
- npm run test:wp0-3
- npm run test:p2-1f
- tsc --noEmit
- npm run build

Expected production behavior after deployment: with current data, TRUSTED = 0 and OBSERVED = 0 are valid outcomes; candidate recommendations may still appear as CLAIMED.
