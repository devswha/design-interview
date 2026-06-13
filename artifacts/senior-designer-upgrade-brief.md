# Senior-Designer Upgrade — Research & Integration Brief

Scheduled heavy run (planned for 2026-06-13 ~07:00 KST, fresh 5h token window).
Owner intent: outputs of this skill must be indistinguishable from pages a **senior
designer** built by hand — landing pages, detail pages, and (new) **proposals (제안서)**.
User explicitly opted into multi-agent Workflow orchestration for this run.

## Mission

Upgrade design-interview from "avoids AI tells" to "exhibits senior-designer craft".
The current system is purely *negative* (a forbidden-pattern list). This run adds the
*positive* layer: what good designers actually do — and wires it into the skill,
the core docs, the machine audit lanes, and a new page type.

## Phase A — Research (fan out, parallel)

1. **Anthropic frontend-design plugin (local, read first)**
   - `/home/devswha/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md`
   - `/home/devswha/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/README.md`
   - Extract: its anti-generic-AI-aesthetic principles, typography/spacing/color
     guidance, and anything that overlaps or conflicts with our `core/design-tells.md`.

2. **High-star GitHub repos** — discover via WebSearch, then `git clone --depth 1`
   public repos into `/tmp` and read locally (avoids WebFetch 403 issues; never
   WebFetch + another tool in one parallel batch — global rule). Seed candidates
   (verify stars/活性 before trusting):
   - `sw-yx/spark-joy` — practical "design tips for developers" (high star)
   - `bradtraversy/design-resources-for-developers` — curated resources (~60k★)
   - `alexpate/awesome-design-systems` — real-world design systems index
   - `thedaviddias/Front-End-Checklist` / design checklists
   - Real design systems with written principles: Shopify Polaris, IBM Carbon,
     GOV.UK Design System, Atlassian — their *typography scale, spacing system,
     color-role, content-voice* docs are the senior-designer canon.
   - Also search: "Refactoring UI"-style summaries, practical typography,
     landing-page teardown collections.
3. **License discipline**: adopt *principles* (ideas), not copied prose. If quoting
   or adapting text/assets, only from permissive licenses, with attribution noted
   in the resulting core doc.

## Phase B — Synthesis

Adversarially filter Phase A output: keep only principles that are (a) actionable at
build time in a single static HTML page, (b) checkable — by machine where possible,
by LLM checklist otherwise, (c) not already covered by `core/design-tells.md`.
Resolve conflicts between sources; prefer what real design systems converge on
(type scale ratios, spacing tokens, single accent color, hierarchy by size+weight+space).

## Phase C — Integration (full scope, approved by owner)

1. **New core doc `core/design-principles.md`** (Korean, per repo convention) —
   the positive counterpart to `design-tells.md`: typography scale & pairing,
   spacing/rhythm system, color roles & restraint, visual hierarchy, asymmetry
   with intent, real-content-first. Each principle: `id / 원칙 / 빌드 적용법 / 출처`.
2. **Extend `core/design-tells.md`** with new tells found in research. Every tell
   judged by a machine lane lands with fixture + `tests/quality/baseline.json`
   update **in the same commit** (ROADMAP operating principle). LLM-lane tells go
   into the SKILL.md Phase 5 checklist — never both lanes (no double scoring).
3. **SKILL.md upgrades**: Phase 3 build discipline references `core/design-principles.md`
   as a *positive* requirement (not just the forbidden list); Phase 2 concept sheet
   gains the principle commitments; Phase 5 checklist updated for any lane changes.
4. **Proposal page type**: `--page proposal` alongside landing/detail — Phase 0
   option parsing, interview dimension nuances (audience = 심사자/결재자, conversion
   = 승인), `templates/concept-sheet.md` proposal section, build guidance.
5. **Machine lane promotion** (ROADMAP M3 backlog): promote L2 (center-everything)
   and L3 (uniform section rhythm) to `src/geometry.js` if a deterministic geometric
   criterion survives red-team scrutiny (add `tests/redteam/` fixtures for each
   heuristic). On promotion: update `core/design-tells.md` lanes, remove from
   SKILL.md LLM checklist, update baseline — all in one commit.
6. **ROADMAP.md**: add the new milestone with code-verifiable acceptance criteria.

## Invariants (do not weaken)

- Exit-code discipline (`src/cli.js`): input error → 2 no stack; audit fail → 1;
  visual-lane fallback ONLY on `ERR_PUPPETEER_MISSING`.
- puppeteer stays optional; everything non-visual works without it.
- Intake SSRF guard and inert preview security models untouched.
- Claims immutable; copy rewrite allowed but bounded (meaning/polarity/causality survive).
- Pure ESM, `node:test`, no new runtime dependencies without owner approval.
- Korean comments/core docs/skill prompts, English identifiers, English commit messages.

## Verification (gate before any commit)

- `npm test` green (unit + e2e; puppeteer-dependent tests may skip if not installed —
  check `node_modules/puppeteer` exists first and run the visual tests).
- `npm run benchmark` green — if baseline changes are intended, same commit.
- `node src/cli.js audit examples/slop-source.html --visual` still fails as expected;
  clean fixtures still pass.
- Commit in logical units (tell + fixture + baseline together), English messages.

## Process

Use the Workflow tool (multi-agent): research fan-out → adversarial synthesis →
implementation → verify. Multiple sequential workflows are fine; read results
between phases. Report a final summary: sources used, principles adopted/rejected
(with why), lanes changed, new fixtures, test/benchmark status.
