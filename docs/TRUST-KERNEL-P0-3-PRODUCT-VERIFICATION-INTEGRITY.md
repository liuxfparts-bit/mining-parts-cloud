# Trust Kernel P0-3 — Product Verification Integrity

Baseline: production candidate `cbc5512abbfbe9d380bdef8b49070b7d6de5b10e`.

## Audit scope

All production Product mutation paths were enumerated. Runtime writes are limited to:
- supplier Product create API / supplier server action (creates unverified/pending data only);
- supplier Product PUT edit API;
- admin approve/reject/status actions;
- admin featured toggle (presentation-only, not a trust state);
- seed/test scripts (non-runtime).

The critical integrity defect was the supplier PUT path: a `PUBLISHED + VERIFIED` Product could change trust-bearing content and remain verified. A second bypass existed in admin actions: approval could set `PUBLISHED + VERIFIED` without checking the PartNumber or Supplier trust chain, and generic status writes could publish without a closed allowlist.

## Field downgrade matrix

| Field group | Fields | Supplier edit result for VERIFIED Product |
| --- | --- | --- |
| Identity / technical / quality claim | partNumberId, supplierId, name, nameEn, productType, oemNumber, description, specification, material, application, images, datasheet, drawing | Verification invalidated immediately; status -> PENDING; verificationStatus -> PENDING; verifiedAt/verifiedBy cleared; re-review required |
| Commercial / volatile offer terms | price, currency, moq, stockStatus, stock, leadTime, warranty | May change without invalidating technical/product verification |
| Presentation only | isFeatured, featuredOrder | Does not change verification; public visibility is still constrained by canonical public Product policy |
| Workflow state | status, verificationStatus, verifiedAt/by, rejectedAt/by | Supplier cannot set directly; controlled by workflow code |

PartNumber and supplier identity are not editable in the current supplier PUT route. They remain in the trust-field registry so future mutation paths fail conceptually closed.

## Approval gate

Admin approval now requires:
1. Product is PENDING / PENDING.
2. PartNumber is VERIFIED + READY.
3. Supplier is VERIFIED.
4. Supplier has approvedAt + approvedBy.
5. Supplier has no DISABLED user.
6. Product name is non-empty.
7. Product has not changed concurrently since the approval snapshot.

Approval writes a non-null admin verifier and records dependency state in SecurityAuditLog.

## Concurrency rule

Supplier edits and admin approval/rejection/status transitions use optimistic concurrency via Product.updatedAt. A stale operation must fail rather than overwrite a newer verification or edit.

## Audit trail

A trust-bearing supplier edit of a VERIFIED Product writes:
- action: PRODUCT_VERIFICATION_INVALIDATED
- changed trust fields
- previous status / verification status
- downgrade target state
- actor user id

Blocked admin approvals write PRODUCT_APPROVAL_BLOCKED with the failed trust-chain reasons.

## Deliberate non-goal

The current Prisma Product model has no first-class product-specific evidence entity. P0-3 therefore enforces the evidence/trust dependencies that are actually represented today (PartNumber verification and Supplier formal approval), but does not pretend that product-specific OEM/manufacturing evidence exists. A future evidence model should be added separately rather than inferring evidence from images or descriptions.

## Acceptance criteria

- No supplier edit can silently preserve VERIFIED after a trust-bearing field changes.
- Commercial-only edits do not force unnecessary re-review.
- No admin approval can publish a Product whose PN/Supplier trust chain fails.
- No generic admin status call can publish an unverified Product.
- Concurrent stale edits/approvals fail closed.
- Invalidation and blocked approval are auditable.
- Existing public trust, business-authenticity, quote-integrity tests remain green.
- TypeScript and production build pass.
