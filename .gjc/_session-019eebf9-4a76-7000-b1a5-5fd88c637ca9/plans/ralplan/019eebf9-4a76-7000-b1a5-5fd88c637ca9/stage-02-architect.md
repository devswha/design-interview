## Summary
The inert-HTML slice is not clear: board rendering escapes the normal parsed option fields and the board atomic write path is structurally sound, but the security boundary still has sanitizer and image-path holes. The blocking item is `imageFile` path containment/symlink handling; the preview sanitizer also relies on CSP for several constructs that the stated contract says must be stripped or neutralized before emission.

## Analysis
- Board markup escaping is mostly correct on the validated path: `esc()` escapes ampersand, angle brackets, quotes, and apostrophes (`src/board.js:45`), labels/rationale/question/recommend reason/alt text are escaped at render sites (`src/board.js:254`, `src/board.js:266`, `src/board.js:278`, `src/board.js:287`, `src/board.js:300`, `src/board.js:315`), CSS color contexts are hex-validated before render (`src/board.js:73`, `src/board.js:94`), and attribute values are quoted.
- The shared CSP blocks script execution and remote subresources in practice: `default-src none`, `script-src none`, `img-src data:`, `style-src unsafe-inline`, `font-src data:`, and `frame-src none` are set in `src/inert-html.js:7`; `connect-src` is not explicit but falls back to `default-src none`.
- Active-content stripping is not parser-equivalent. The code removes simple scripts/base/meta refresh/link/media/event/javascript patterns (`src/inert-html.js:48`), but it leaves several browser-parsed variants in the serialized output and then relies on CSP to stop execution or loading.
- Board image handling validates extension plus magic bytes (`src/board.js:184`), requires a sidecar (`src/board.js:191`), enforces a per-image cap before reading (`src/board.js:217`), and enforces a total HTML cap before writing (`src/board.js:344`). The path itself is not contained to the options directory or an approved asset root, and symlinks are followed.
- Board file output is atomic for the inspected implementation: validation and image resolution happen before `atomicWrite` (`src/board.js:341`-`src/board.js:348`), the temp file is same-directory and exclusive (`src/board.js:355`-`src/board.js:358`), rename is used (`src/board.js:359`), and temp cleanup is attempted on errors (`src/board.js:361`). `preview.js` contains only an HTML builder in this reviewed slice, so no preview file-write implementation is present in the requested files.
- Schema validation covers the requested discriminants and coupling: `visual.type` is restricted to the declared union (`src/board.js:20`, `src/board.js:65`), `dimension` is restricted to the six core dimensions (`src/board.js:19`, `src/board.js:134`), and `recommendedNumber`/`recommendReason` are coupled (`src/board.js:160`-`src/board.js:169`).

## Root Cause
The slice mixes deterministic serialization with regex-based HTML/CSS sanitization and filesystem path resolution without canonical containment. CSP is doing useful defense-in-depth, but several code paths treat CSP as the primary enforcement mechanism even though the slice contract requires active content and remote references to be removed or neutralized before the inert HTML is emitted.

## Findings
1. HIGH — `src/board.js:209`: `imageFile.path` is resolved with `resolve(baseDir, v.path)` and then read through `stat`/`readFile`, so absolute paths, `..` traversal, and symlink escapes can embed image bytes outside the board/options asset tree when magic bytes and a sidecar happen to pass. Fix: reject absolute/up-level paths or, better, compare `realpath` of the image and accepted sidecar against an approved base/asset root and use `lstat`/open-handle `fstat` to reject or safely pin symlinks before reading.
2. MEDIUM — `src/inert-html.js:62`: Event-handler stripping only matches whitespace-delimited `on*=` attributes, so HTML parser-equivalent forms such as slash-delimited SVG/HTML attributes can survive in the serialized preview even though CSP should block execution. Fix: replace this regex pass with a start-tag/attribute walker that normalizes separators and removes every case-insensitive `on*` attribute before serialization.
3. MEDIUM — `src/inert-html.js:63`: `javascript:` URL neutralization checks raw attribute text and misses browser-decoded schemes such as entity-encoded or control-character-obfuscated `javascript:` values, leaving forbidden URLs in the inert document and relying on CSP for execution blocking. Fix: parse attributes, decode HTML entities/control characters, trim URL values, and neutralize unsafe schemes across all URL-bearing attributes, including SVG aliases such as `xlink:href`.
4. MEDIUM — `src/preview.js:66`: Preview panes emit `extractBody(built)`/`extractBody(original)` after `stripActiveContent`, but `stripActiveContent` does not sanitize `<style>` tags, so body or fragment styles containing `@import`/remote `url()` survive despite `collectHeadStyles()` sanitizing copied head styles at `src/preview.js:86`. Fix: sanitize every `<style>` tag before pane insertion, ideally in `stripActiveContent`, and make the CSS sanitizer cover all emitted style contexts.
5. MEDIUM — `src/inert-html.js:88`: The `@import` remover only deletes semicolon-terminated imports within a 4096-character window, so EOF-terminated or long `@import` rules can survive the head-style sanitizer. Fix: strip `@import` rules through semicolon, block start, or EOF without a length-based survival branch, or use a CSS parser/tokenizer for this lane.
6. MEDIUM — `src/inert-html.js:28`: Remote link detection does not trim or canonicalize `href` values before checking `http(s)://` or `//`, so whitespace/control-character/entity-obfuscated remote stylesheet links can survive link stripping and preview collection. Fix: canonicalize parsed URL attributes before scheme checks and remove remote links after decoding/trimming rather than checking the raw regex capture.
7. LOW — `src/preview.js:76`: `title` is interpolated directly into `<title>` without HTML escaping, so a caller-controlled title can close the title element and inject inert markup or style into the preview head. Fix: HTML-escape `title` with the same escaping primitive used by the board serializer or make the preview title constant.

## Recommendations
1. Block release of this slice until image path containment/symlink handling is fixed in `resolveBoardImages`.
2. Move from regex-only HTML stripping to a small deterministic tag/attribute sanitizer for start tags used in previews; keep CSP as defense-in-depth rather than the primary sanitizer.
3. Apply style sanitization globally to preview body/fragment content, and harden `@import`/`url()` handling with canonicalization or tokenization.
4. Escape the preview `title` parameter and canonicalize URL attributes before remote/javascript scheme decisions.
5. Add explicit `connect-src none` only for audit clarity if desired; functionally it is already covered by `default-src none`.

## Architectural Status
BLOCK

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs
| Option | Pros | Cons |
| --- | --- | --- |
| Keep regex sanitizer + rely on CSP | Smallest code, current tests likely remain simple | Violates the stated strip/neutralize contract and leaves parser-evasion variants serialized |
| Deterministic tag/attribute walker + CSS token handling | Maintains zero runtime deps and makes behavior explicit/testable | More code to own; must cover HTML/CSS edge cases deliberately |
| Pull in a full sanitizer/parser | Stronger parser equivalence | Conflicts with the zero-runtime-dependency constraint and increases supply-chain surface |
| Reject symlinks and require realpath containment | Simple, safe image embedding boundary | Less flexible for shared asset directories unless approved roots are modeled explicitly |
| Allow approved external asset roots | Supports shared curated assets | Requires explicit configuration and tests for each root boundary |
