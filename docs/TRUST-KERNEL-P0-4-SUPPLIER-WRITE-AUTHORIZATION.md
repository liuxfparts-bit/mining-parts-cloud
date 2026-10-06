# Trust Kernel P0-4 — Supplier Write Authorization Integrity

Baseline: `442fac7607925b9fd324185a5678decd6467c80d`

## Audit finding

Supplier-side mutations used inconsistent authorization checks. Several routes accepted any authenticated user with a non-null `supplierId`; others trusted the session role but did not re-check the database user, account state, Supplier existence, or Supplier operating state. A `DISABLED` Supplier could therefore retain an ACTIVE user session and continue reaching business-write paths.

## Canonical Supplier Write Gate

`src/lib/supplier-write-access.ts` is the single authorization gate for supplier business mutations.

Every write resolves identity from the authenticated user ID and the database. It requires:

1. valid authenticated user ID;
2. database `User.role === SUPPLIER`;
3. database `User.status === ACTIVE`;
4. non-null `supplierId`;
5. the bound Supplier exists and matches that relation;
6. the Supplier status is allowed for the requested write policy.

The gate never accepts a supplier ID from request input.

## Policy matrix

| Supplier state | PROFILE | BUSINESS |
| --- | --- | --- |
| PENDING | allow | allow |
| VERIFIED | allow | allow |
| REJECTED | allow | deny |
| DISABLED | deny | deny |
| unknown/corrupt | deny | deny |

`PENDING` remains allowed for BUSINESS because the existing platform intentionally supports external RFQ invitations and newly registered suppliers before public verification. Permission to submit data does **not** make that Supplier or its Product publicly trusted.

`REJECTED` may edit its profile so the company can correct information, but cannot create or modify business records.

Supplier authorization is intentionally separate from public trust. `VERIFIED` alone is not treated here as canonical approval provenance; public Supplier/Product visibility continues to use the stricter Trust Kernel public predicate.

## Covered mutation surfaces

- Quote create/update
- Product create
- Product edit/resubmit
- Supplier profile update
- Quote withdrawal
- Invitation accept/reject/view
- External invitation claim/bind
- Equipment request create
- Part Number request create (both current entry paths)
- Part Number request edit/resubmit
- Legacy supplier Product create action

Object ownership remains independently enforced after the identity gate.

## Explicitly separate issue

`/api/upload` is a generic authenticated file-upload endpoint and is not reclassified as Supplier business authorization in P0-4. Its role/scope authorization remains the separately tracked upload-security gap.

## Acceptance criteria

- no Supplier business mutation authorizes solely from session role or non-null `supplierId`;
- DISABLED Supplier cannot write;
- REJECTED Supplier cannot perform BUSINESS writes;
- PENDING invited/onboarding Supplier flows remain functional;
- Supplier identity always comes from the authenticated database User;
- cross-Supplier object ownership checks remain in place;
- existing Trust Kernel P0-2/P0-3 behavior remains unchanged.
