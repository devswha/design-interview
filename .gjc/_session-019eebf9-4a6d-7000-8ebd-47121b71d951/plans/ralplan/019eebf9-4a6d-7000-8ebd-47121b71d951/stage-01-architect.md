## Summary
The slice is not clear. `src/text.js` is intentionally linear for tag stripping, `auditHtml` caps the primary input to 2 MB, and the normal static score denominator is nonzero, but several blocking detectors can be bypassed and two regex paths still have unbounded scans over untrusted input.
The main recommendation is to replace the remaining regex-shaped parsing seams with the existing forward-scanner style and to tighten gate severity merging before this auditor is treated as a deterministic delivery gate.

## Analysis
- Scope inspected: only `src/audit.js` and `src/text.js`.
- Regex DoS review: `stripTags`, `removeRawBlocks`, `splitFlatRules`, and `boundedTagInner` are forward scans and terminate on malformed input; `auditHtml` slices input at `HTML_SCAN_LIMIT`, and tag bodies are capped at `TAG_BODY_LIMIT` for T1 and T4. The risky remaining regexes are C1 gradient extraction at `src/audit.js:136` and the Hangul inline-style warning at `src/audit.js:747`; both are bounded only by the 2 MB audit slice, not by match-local limits.
- Score review: `auditHtml` always builds findings from nine `MACHINE_CHECKS`, so `failed.length / findings.length` and `blockingFailed.length / findings.length` stay in 0..1 for the static lane. `combineAudits` keeps scores in 0..1 when at least one finding exists and dedupes duplicate visual IDs, but an empty caller-provided result still produces NaN.
- Gate review: static advisory findings and warnings do not block, and new visual findings without severity default to advisory. The duplicate-ID merge does not merge severity, so a future blocking same-ID arm can be accidentally held at advisory severity.
- Malformed HTML review: `stripTags` consumes unclosed `script` and `style` raw text to EOF and `extractCss` captures unclosed `style` content to EOF, so an unclosed style tag does not by itself hide C1 CSS from the static lane. The heading/list scanner has a tag-boundary bug that can truncate visible T1/T4 text early.
- Detector review: C1, T1/T2/T4, S5, and DE3 have concrete correctness gaps below. S3 is not implemented in the two target files, so it was not reviewed here.

## Root Cause
The auditor mixes careful hand-written scanners with several local regex parsers that do not share one HTML/CSS tokenization contract. Those seams create inconsistent handling of inline attributes, entity-visible text, malformed tag boundaries, and merged severity semantics.

## Findings
1. HIGH — `src/audit.js:136` — Problem: C1 uses `linear-gradient` plus an unbounded no-right-paren regex, which can scan quadratically with many unterminated gradient starts and misses valid nested color functions such as rgb, rgba, hsl, and hsla stops, so a blocking purple-gradient tell can be both a CPU sink and a false negative. Fix: Replace it with a single-pass CSS function scanner over relevant background declarations, cap each gradient body, track parentheses, and feed every stop token through `parseColor`.

2. MEDIUM — `src/audit.js:110`, `src/audit.js:224` — Problem: Both CSS extractors only read quoted style attributes, so valid unquoted inline CSS such as `style=background:linear-gradient(#8a2be2,#fff)` or `style=transition:all` bypasses C1, S5, TY4, CO1, DE1, and DE3. Fix: Centralize an attribute scanner that accepts quoted and HTML-valid unquoted values, then reuse it from `extractCss`, `extractCssRules`, and warning collection.

3. MEDIUM — `src/audit.js:39-40` — Problem: `boundedTagInner` treats any prefix match as a close or reopen boundary, so tags such as `<h10>`, `</h10>`, `<link>`, or `<buttonish>` can prematurely truncate h, li, or button bodies and hide T1 or T4 blocking text. Fix: Require a tag-name boundary after close and reopen candidates before cutting the body.

4. MEDIUM — `src/audit.js:668-674` — Problem: DE3 focus handling is fail-open because any visible `:focus-visible` rule globally excuses all outline kills, and the kill search only handles `outline` shorthand values `none`, `0`, and `0px`, missing more specific overrides, `outline-width:0`, and `outline:0 solid transparent`. Fix: Evaluate each focus or focus-visible outline removal against a same-selector or provably covering replacement and expand outline-kill recognition to outline-width and zero shorthand forms.

5. MEDIUM — `src/audit.js:156`, `src/audit.js:170`, `src/audit.js:185`, `src/text.js:22` — Problem: Visible-text detectors consume `stripTags` output without HTML entity decoding, so `&#x1F680;` in a list item, `seam&#108;ess`, or encoded sentence punctuation can evade T1, T2, and T4 while rendering visibly. Fix: Add a bounded shared visible-text helper that strips tags, decodes numeric and common named entities, normalizes whitespace, and use it for text detectors and warnings.

6. MEDIUM — `src/audit.js:747` — Problem: The Hangul inline-italic warning uses a global lazy backreference regex over full HTML, so many styled tags without matching close tags force repeated scans to EOF despite the audit input cap. Fix: Replace it with the existing forward tag-scanner pattern or bound each candidate body before searching for the matching close tag while keeping the result warning-only.

7. MEDIUM — `src/audit.js:854-857` — Problem: `combineAudits` merges duplicate IDs without merging severity, so a blocking visual or deterministic arm that shares an advisory static ID remains advisory and cannot block delivery. Fix: Normalize merged severity as blocking when either side is blocking and advisory only when both sides are advisory or severityless.

8. LOW — `src/audit.js:868-869` — Problem: `combineAudits` divides by `findings.length` without guarding zero, so an empty static result plus no visual findings produces NaN scores that format as `NaN%`. Fix: Use a guarded denominator or reject empty audit inputs before scoring.

9. LOW — `src/audit.js:196` — Problem: S5 scans raw CSS for `border-radius` substrings, so comments and custom properties such as `--border-radius` can produce advisory false positives and the detector duplicates declaration parsing differently from TY, CO, and DE. Fix: Reuse `extractCssRules` and `parseDeclarations`, require property equality with `border-radius`, and strip comments consistently.

## Recommendations
1. Replace C1 gradient regex parsing first because it is both the highest regex-DoS risk and a blocking false-negative path.
2. Centralize HTML attribute and visible-text extraction so audit and text utilities agree on quoted, unquoted, entity-decoded, and malformed cases.
3. Tighten DE3 focus kill matching and duplicate-ID severity merging before relying on pass or exit status for delivery decisions.
4. Add focused adversarial fixtures for unterminated gradients, unquoted style attributes, entity-encoded visible text, malformed h/li/button descendants, empty combine results, and advisory-only warnings.

## Architectural Status
BLOCK

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs
| Option | Pros | Cons |
| --- | --- | --- |
| Small forward scanners for gradients, attributes, and inline warning tags | Linear behavior, one parsing contract, no runtime dependency | More code and more fixtures |
| Keep regexes with only global input caps | Minimal patch size | Retains false negatives and match-local CPU spikes |
| Use a full HTML and CSS parser | Best semantic fidelity | Violates the zero-runtime-dependency shape unless implemented as optional or vendored logic |
