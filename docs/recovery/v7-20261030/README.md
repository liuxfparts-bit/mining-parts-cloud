# V7 recovery candidate — 2026-10-30

This is a newly archived candidate, not the historical V7 commit and not a certified copy of production.

Base: production commit 81bd29c0eb533bb631611354fad3e4907fd8fcda.
Branch: baseline/v7-recovery-20261030.

## Sources and changes

Preserve all files from the base, including CI production triggers and migrations 0001–0008. Overlay only 33 existing local redesign files: 9 modified frontend files plus 24 additions (assets, homepage modules, home-banner.ts and .dockerignore). No backend P0-01 remediation is included.

24 unique paths matched the combined V5/V6/V7 package manifests and V7 base checks in prior local read-only verification. This proves package-record correspondence, not production equivalence. Eleven homepage images exist locally and their exact Git blobs also exist in the repository main tree. Historical SVG assets are retained. home-banner.ts is required by the homepage, but its production fingerprint remains unverified. .dockerignore matches the recorded VER-01 SHA256.

The local CI file omits production push and PR triggers; it is deliberately NOT imported. All base migrations and their two PartNumberCrossReference CHECK definitions are retained byte-for-byte. Migration chain equivalence and actual database behavior have not been tested.

## Inventory

files-v7-recovery.json lists payload paths and Git blob SHA-1 fingerprints, plus SHA256 for the 33 local overlay files. It excludes its own file and this report; both are identified in the commit Git tree. Git blob fingerprints must not be presented as raw file SHA256.

## Verification and limits

Uploaded blobs were checked against locally computed Git blob IDs. No install, build, test, migration, environment creation or deployment was executed. Production V7 full-directory fingerprint comparison is outstanding. A tracked-file inventory is not proof of build completeness.

The 19 unavailable historical evidence files are not reconstructed or substituted. This documentation is new recovery evidence only. VER-01 public-structure acceptance limits remain unchanged.

## Gates

REC-01 recovery rules approved. DEP-01 G1 / NOT_RELEASED; DEP-01 G2 NOT_STARTED; P0-01 G3 blocked and G5 not accepted; P0-02 NOT_RELEASED; PRODUCTION_CHANGE_AUTHORIZED=NO. Candidate branch archival authorization does not authorize implementation, environment work, merge or release.
