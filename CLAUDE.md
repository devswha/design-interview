# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

design-interview is an agent skill plus a deterministic verification CLI. It takes AI-generated "slop" source content and, through a user interview, produces landing/detail/proposal pages free of AI design tells. The product has two layers that must not be confused:

- **SKILL.md** — the LLM orchestration prompt (5 phases: intake → interview → concept lock → build → preview loop → audit/delivery). Interviewing and page building happen here, driven by `core/interview.md` (6-dimension clarity scoring, threshold 0.80), `core/design-tells.md` (forbidden-pattern list), and `core/design-principles.md` (24 positive senior-designer principles — token discipline, the proposal genre rules, and the conflict-resolution log that bounds each principle).
- **src/** — deterministic CLI lanes (`node src/cli.js intake|preview|audit|shot`). No LLM self-grading: numbers come from code. The skill calls these lanes at phase boundaries.

Two hard gates in the skill: no HTML is generated before the concept sheet (`templates/concept-sheet.md`) is approved, and delivery is blocked while `audit` exits 1.

## Commands

```bash
npm test                 # unit + e2e (e2e drives the real CLI: intake→audit→preview→shot)
npm run test:unit
npm run test:e2e
node --test tests/unit/audit.test.js                        # single file
node --test --test-name-pattern="S3" tests/unit/*.test.js   # single test by name
npm run benchmark        # regression gate vs tests/quality/baseline.json
```

Node >= 22.12, pure ESM, built-in `node:test` — no test framework, no build step, no linter configured.

CLI lanes:

```bash
node src/cli.js intake <file-or-url> [--json]    # freeze claims (price/quantity/percent/duration/feature)
node src/cli.js audit <page.html> [--visual]     # design-tell audit; exit 1 = not deliverable
node src/cli.js preview <built.html> [--against <slop.html>] [--out <file>]
node src/cli.js shot <page.html>                 # desktop/mobile full-page PNG (requires puppeteer)
```

## Architecture

### Tell/principle taxonomy and the three audit lanes

Negative tells have IDs in `core/design-tells.md` (L1–L4 layout, C1–C4 color, T1–T5 typography/copy, S1–S5 structure); positive principles have two-letter IDs in `core/design-principles.md` (TY/SP/CO/LA/HI/CN/IM/DE/PR). Every item is judged in exactly one lane:

- **Static machine lane** (`src/audit.js`): tells C1, T1, T2, T4, S5 + principles TY4, CO1, DE1, DE3 static quality-floor arms, plus TY5-B/C hangul fallback-stack/fake-italic warnings — pure HTML/CSS parsing. WARN signals (DE3 craft floor, TY5-B/C) feed a `warnings` array (each `{ name, lane, evidence }`) that never affects pass/failed/slopScore/exit.
- **Visual machine lane** (`src/geometry.js`, via `audit --visual`): tells L1, L2, S3 + principles TY1, TY2, DE3 rendered contrast, and TY5-A hangul mid-word break (fail; `Range.getClientRects()` proves two space-less adjacent syllables render on different lines) — judged from rendered box geometry/computed style. `pageAnalyzer()` executes inside the browser; it must not reference outer scope. `analyzeVisualTells()` returns `{ findings, warnings }`; `combineAudits()` normalizes a legacy array or that object, merges findings, and concatenates static+visual warnings without scoring them. L2 and S3 are deliberately disjoint. DE3 static+visual arms are merged under one ID before scoring to avoid double counting.
- **LLM lane** (SKILL.md Phase 5 checklist): tells L3, L4, S1/S2/S4, T3, T5 + all principles not machine-checked.

Invariant: an item covered by a machine lane is removed from the LLM checklist — no double scoring. Promoting an item to a machine lane means updating its core doc, SKILL.md, and the baseline together. Promotion candidates that FAILED adversarial review (do not re-promote without new evidence): L3 (bypassable via padding nudges), TY3 (line-height:normal trap), DE2 (inherited property — wrong lane for static).

### Benchmark gate

`tests/quality/baseline.json` maps fixtures (`tests/fixtures/{slop,clean}/`, `examples/`, select `tests/redteam/`) to expected failed IDs. `npm run benchmark` fails on either regression: **miss** (expected fail not caught — detection regressed) or **fp** (new fail on a clean fixture — false-positive regressed). Adding or modifying a machine-lane check must land with its fixture + baseline update in the same commit (ROADMAP operating principle). `tests/redteam/` holds adversarial fixtures for both lanes (geometry decoys, CO1's accepted SVG-attribute blind spot); most are exercised by unit tests rather than baseline — the SVG-smuggle one is wired into baseline as an explicit fp-guard locking the accepted miss.

### Exit-code discipline (src/cli.js)

- User input errors (missing file, bad usage) → message to stderr, **exit 2**, never a stack trace.
- Audit fail / intake fetch fail / shot fail → **exit 1**.
- The visual lane falls back to static-only on exactly one error: `ERR_PUPPETEER_MISSING`. Any other visual-lane error fails the audit — silently degrading to static-only would weaken audit results.

### Optional puppeteer

puppeteer is optional (ROADMAP principle: everything except the visual lane must work without it). `loadPuppeteer()` in `src/screenshot.js` is the single shared loader (geometry.js uses it too) and throws the typed `ERR_PUPPETEER_MISSING`. Tests needing it skip via `hasPuppeteer` checks. Never make a non-visual feature depend on it.

### Security models (do not weaken)

- **Intake SSRF guard** (`src/intake.js`): two stages — pre-validation (scheme/host/DNS) plus a connection-time `lookup` hook on the http/https request, defeating DNS rebinding between check and connect. Blocks private/loopback/link-local/metadata ranges (including IPv4-mapped IPv6 forms), revalidates every redirect hop, caps at 5MB/30s. Anything `scheme://`-shaped goes through the URL guard, never the file-read path.
- **Inert preview** (`src/preview.js`): scripts/inline handlers/`javascript:` URLs stripped, CSP `script-src 'none'`, view toggle is a no-script radio hack, chrome selectors are `dsiv-`-prefixed with `!important` so the audited page's CSS cannot override review chrome.
- **Claim preservation**: source copy is *meant* to be rewritten in the concept-sheet voice, but rewriting is bounded — meaning, polarity, and causality must survive. Only the claims (numbers/prices/percentages/durations/features) extracted at intake are strictly immutable (patina MPS principle); Phase 5 diffs them against the built page.

## Conventions

- Code comments, core docs, and skill prompts in this repo are written in Korean; identifiers in English. Match the surrounding style.
- ROADMAP.md tracks milestones; a milestone closes only when its acceptance criteria are verifiable by code.
- Root `v0-*.{html,png}` files and `artifacts/` are skill-session run artifacts, not source.
