# Trust Kernel P0-4A — Upload Authorization Integrity

Baseline: `67924ae59250e552719bb884691e82cbf767ee93`

## Audit findings

The previous `/api/upload` endpoint required only an authenticated session. The caller controlled a sanitized but otherwise unrestricted `scope`, and most UI callers omitted scope entirely, causing Admin images, Supplier Product images and Buyer RFQ images to share the legacy `/uploads/rfq/` directory. The endpoint trusted browser MIME metadata and downstream Product/RFQ/Quote writes did not prove that referenced upload URLs belonged to the current business principal.

## Canonical upload scopes

| Scope | Role / business gate | File classes | Principal directory |
| --- | --- | --- | --- |
| `rfq-image` | ACTIVE BUYER + VERIFIED BuyerCompany | jpg/png/webp | `buyer-{companyId}` |
| `buyer-license` | ACTIVE BUYER (pre-verification onboarding allowed) | jpg/png/webp | `buyer-{userId}` |
| `quote-attachment` | canonical Supplier BUSINESS gate | images + pdf/doc/docx/xls/xlsx | `supplier-{supplierId}` |
| `product-image` | canonical Supplier BUSINESS gate | jpg/png/webp | `supplier-{supplierId}` |
| `admin-image` | ACTIVE ADMIN | jpg/png/webp | `admin-{userId}` |

There is no default scope and arbitrary scopes are rejected.

## Storage isolation

New URLs are generated only by the server:

`/uploads/{scope}/{business-principal}/{timestamp-random.ext}`

The client cannot choose the directory, filename or extension. Product, RFQ and Quote mutations verify that newly referenced URLs belong to the current Supplier or BuyerCompany and the correct scope.

Existing legacy Product/Quote URLs already attached to the same record are grandfathered only when editing that record. This preserves existing data without allowing a client to introduce a new legacy or cross-principal URL.

## Read/download authorization

The dynamic `/uploads/[...path]` route is part of the trust boundary as well as the POST endpoint.

- path segments are allowlisted and the resolved path must remain under `public/uploads`; traversal fails closed;
- `admin-image` is public;
- `product-image` is public only when referenced by a Product satisfying the canonical public Product predicate; its owning Supplier and Admin retain preview/review access;
- `rfq-image` follows the canonical RFQ visibility/ownership policy, while the owning verified BuyerCompany can preview a newly uploaded image before RFQ commit;
- `quote-attachment` is restricted to the Quote's Supplier, owning Buyer/RFQ company and Admin;
- `buyer-license` is restricted to the uploading Buyer during onboarding, its BuyerCompany after attachment, and Admin;
- legacy flat `/uploads/rfq/*` and `/uploads/quote/*` files are served only when an existing database record references the URL;
- private responses use `private, no-store`; all responses set `X-Content-Type-Options: nosniff`, and Office/PDF documents are served as attachments.

## File controls

- server-side scope/MIME allowlist;
- 5 MB image and 10 MB document limits;
- early Content-Length rejection above the multipart ceiling;
- magic/signature checks for JPEG, PNG, WEBP, PDF, legacy Office CFB, and OOXML ZIP containers;
- random server filenames and exclusive-create writes;
- per-user in-memory upload rate limit;
- SVG and executable/web formats are not accepted.

Client `accept` attributes are aligned with the server image allowlist but are not treated as a security control.

## Deliberate boundary / residual risk

Uploads occur before the parent business record is committed. If a user uploads and abandons the form, the file can remain orphaned. P0-4A records this as a storage-lifecycle issue rather than adding a new Upload database model or destructive cleanup job during an authorization patch.

The current rate limiter is process-local, matching the existing single-instance deployment. A future multi-instance deployment must move rate limiting to shared infrastructure.

Admin business forms may intentionally accept manually entered external image URLs; Admin is a trusted role. The P0-4A ownership rule is mandatory for Buyer/Supplier business evidence surfaces.

## Acceptance criteria

- no implicit/default upload scope;
- arbitrary scope cannot create directories;
- scope is role/business-state bound;
- DISABLED/REJECTED Supplier cannot upload Product/Quote files;
- unverified Buyer cannot upload RFQ evidence, while ACTIVE Buyers can upload the license needed to enter verification;
- Supplier/Buyer files are business-principal isolated;
- spoofed MIME with invalid signature is rejected;
- Product/RFQ/Quote cannot introduce cross-principal upload URLs;
- upload read paths cannot traverse outside the upload root;
- private RFQ, Quote and Buyer-license files are not anonymously downloadable;
- existing attached legacy URLs remain editable/readable under their parent record's authorization without bulk migration;
- all current `/api/upload` callers declare scope explicitly;
- no Prisma schema change or migration.
