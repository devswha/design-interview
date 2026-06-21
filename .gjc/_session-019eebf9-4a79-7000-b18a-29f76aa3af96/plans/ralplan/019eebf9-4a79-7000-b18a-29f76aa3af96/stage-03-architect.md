## Summary
The SSRF guard path in `src/intake.js` is structurally strong: it restricts schemes, blocks literal and resolved private/loopback/link-local addresses, revalidates redirects, and uses a connect-time lookup hook. I did not find a direct SSRF or response-cap bypass in the reviewed implementation, but this slice is not fully clear because several CLI exit-code/schema cases and asset-readiness/fabrication edge cases violate the stated contract.

## Analysis
- SSRF guard: `looksLikeUrl` routes `scheme://` inputs into the URL path (`src/intake.js:164`), `assertSafeUrl` enforces `http:`/`https:` and host checks (`src/intake.js:243-265`), `guardedLookup` re-resolves at socket lookup time (`src/intake.js:274-298`), redirects are revalidated per hop (`src/intake.js:333-340`), and the same URL object is passed into `http/https.request`, avoiding parser split-brain.
- SSRF edge cases requested: uppercase schemes are normalized by `URL` before the protocol check; userinfo targets are guarded via `url.hostname`; IPv4-mapped/compatible/NAT64 IPv6 are reduced through `embeddedV4` before private checks (`src/intake.js:168-218`); DNS rebinding is mitigated by both preflight lookup and `guardedLookup`. Decimal/hex/octal IPv4 forms are either canonicalized by the URL parser before `isIP` or resolved through the same private-address lookup path, so I found no connectable private-address bypass in the reviewed code.
- Response caps: `readCappedBody` increments byte count per chunk, destroys the response, and rejects before pushing over-cap chunks (`src/intake.js:308-315`); `Buffer.concat` happens only after the cap gate (`src/intake.js:318`). This is streaming enforcement, not post-hoc truncation.
- CLI contract: usage exits 2 (`src/cli.js:33-46`), audit result exits 0/1 based on pass (`src/cli.js:142-143`), and bad local file reads avoid stacks and exit 2 (`src/cli.js:84-97`). The remaining gaps are listed below.
- Args/pathing: missing values are checked for `--concept-sheet`, `--out`, `--name`, and `--against` (`src/cli.js:166-208`, `src/cli.js:233-258`). `crawl` basename-normalizes `--name` and requires an extension (`src/crawl.js:25-33`), so I found no `--name` traversal escape; `--out` is intentionally user-selected and may be outside the repo.
- Assets: case-insensitive `.license.txt` sidecars are recognized (`src/assets.js:254`, `src/assets.js:282`), exact-case sidecars are preferred before lower-case fallback and ambiguous case siblings are avoided (`src/assets.js:246-306`), and out-of-root symlink targets are skipped (`src/assets.js:199`, `src/assets.js:221-230`). The readiness/fabrication/phantom-counting gaps are listed below.
- Packaging: `src/cli.js` has the shebang (`src/cli.js:1`) and `package.json` maps the npm bin to `src/cli.js` (`package.json:7-8`). Given the stated git mode 100644, npm bin installs are still fine because npm creates executable shims; the install.sh clone/symlink path links the repo/skill directories (`install.sh:100`, `install.sh:128`), so direct `./src/cli.js` execution from that clone would require `node src/cli.js`, `chmod +x`, or changing the tracked mode to 100755.

## Root Cause
The main root cause is inconsistent boundary classification: the URL guard correctly rejects unsafe inputs, but the CLI maps those user-policy rejections to internal failures; the asset lane similarly treats filename presence as provenance readiness and uses text word boundaries instead of filename token boundaries.

## Findings
1. **MEDIUM — `src/cli.js:115` and `src/cli.js:221`** — Problem: SSRF/URL policy rejects from `fetchSource`/`fetchBinary` (`ftp://`, `file://`, private IPs, invalid redirect targets) are reported as exit 1 fetch failures even though they are user input/policy errors under the stated exit-code contract. Fix: tag `assertSafeUrl` validation failures with `userError` (or a dedicated code such as `ERR_UNSAFE_URL`) and map them to exit 2 in both `intake` and `crawl`, while leaving real network/status/body-cap failures as exit 1.

2. **MEDIUM — `src/cli.js:155`** — Problem: `shot` sends every `captureFile` exception to exit 1 and does no local input preflight, so missing files, directories, and other user path mistakes cannot satisfy the `input errors -> exit 2` contract. Fix: preflight the `shot` input with the same `stat`/directory/error-code classification used by `readInput`, or classify filesystem/input codes from `captureFile` before falling back to exit 1 for renderer failures.

3. **LOW — `src/cli.js:106`** — Problem: `intake`, `audit`, `shot`, `assets`, and `crawl` select the first positional argument and silently ignore extra positionals/unknown flags, so schema mistakes can succeed against the wrong target instead of exiting 2. Fix: enforce exact arity per subcommand after known-flag parsing, reject unknown flags, and route violations through `usage()`/exit 2 as `board` and `preview` already do.

4. **LOW — `src/crawl.js:14`** — Problem: `crawl --out <existing-file>` is a directory-vs-file input error, but `mkdir(outDir, { recursive: true })` can throw `EEXIST`, which is absent from `USER_FS_ERROR_CODES` and therefore falls through to `crawl failed` exit 1 in `src/cli.js:221`. Fix: include `EEXIST` in the shared user filesystem error set or pre-stat `outDir` and fail with exit 2 when it exists and is not a directory.

5. **MEDIUM — `src/assets.js:309` and `src/asset-readiness.js:5`** — Problem: readiness counts `hasSidecar` based on filename match before the sidecar is successfully read/parsed, so an unreadable or invalid sidecar is skipped but can still make a visual anchor count as usable/READY. Fix: distinguish `sidecarFound` from `sidecarUsable`, set the readiness flag only after successful sidecar read/parse with required provenance fields, and have `assessAssetReadiness` count only usable sidecars.

6. **MEDIUM — `src/assets.js:51`, `src/assets.js:161`, and `src/assets.js:166`** — Problem: texture and fabrication detection use `\b` word boundaries, which do not split on underscores, so common filenames like `paper_noise.svg`, `dashboard_screen.png`, or `revenue_chart.png` are misclassified or miss AI-fabrication signals. Fix: tokenize basenames with the same separator-aware splitter used by `isLogoLike` (`[\s\-_.~–—]+`) and match tokens instead of regex word boundaries.

7. **LOW — `src/assets.js:251` and `src/assets.js:282`** — Problem: the scanner skips `.gitkeep` and `.license.txt` sidecars but not standalone `LICENSE`/`LICENSE.txt` files, so license documents inside asset directories are counted as `other` assets with missing sidecars and inflate phantom-asset totals. Fix: add a case-insensitive metadata skip for standalone license/readme/copying files before sidecar indexing and asset counting.

## Recommendations
1. Make URL validation failures typed (`ERR_UNSAFE_URL`/`userError`) and route them consistently to exit 2 in all URL-taking commands.
2. Share a small CLI arg/FS classification helper across `intake`, `audit`, `shot`, `assets`, `crawl`, `board`, and `preview` to enforce exact arity and avoid divergent exit-code behavior.
3. Make sidecar validity an explicit data field and base readiness on usable provenance, not just a matched filename.
4. Replace filename `\b` regexes with separator tokenization for texture/fabrication checks.
5. Treat standalone license/readme metadata files as non-assets to keep advisory counts clean.
6. Packaging: npm-bin distribution is okay with mode 100644; for direct clone/symlink execution, either document `node src/cli.js`, chmod in install, or track `src/cli.js` as 100755.

## Architectural Status
`WATCH`

## Code Review Recommendation
`REQUEST CHANGES`

## Trade-offs
| Option | Pros | Cons |
|---|---|---|
| Tag unsafe URL errors in `assertSafeUrl` | Single source of truth for both intake/crawl and redirect failures | Requires small error-code plumbing through fetch helpers |
| String-match CLI error messages | Minimal local change | Brittle, localizes security semantics in CLI text |
| Sidecar filename presence as readiness | Simple and current behavior | Can report READY without readable provenance |
| Sidecar usability flag | More accurate readiness and spoof resistance | Requires updating report shape/tests |
| Regex `\b` filename matching | Short | Wrong for underscores, one of the most common filename separators |
| Separator tokenization | Matches existing `isLogoLike` design and common filenames | Slightly more code |
