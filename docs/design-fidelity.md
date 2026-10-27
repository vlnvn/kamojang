# Design fidelity

Reference: [current Figma](https://www.figma.com/design/gY9jfZPlSrbRfoo2FwJE81/Untitled?node-id=18-8), inspected during the 27–28 October 2026 execution session. Read design context and screenshots for `18:8` (overview), `18:84` (pressure), `18:428` (methods), `18:672` and `24:2` (inspection angles), and `16:2` (SDLC board). Page metadata discovered the remaining sensor, GPR, sensitivity and dialog frames. Additional detailed contexts were inspected for `18:156`, `18:224`, `18:292`, `18:360`, `43:5` and `43:50`.

The implementation uses CSS variables, responsive grid/flex, a 236 px desktop navigation rail, ceramic canvas, forest/graphite surfaces and copper indications. Instrument Sans and IBM Plex Sans are bundled with their actual licenses. SVG icons are exported locally into their corresponding interface slots. Charts are computed from measurements rather than flattened Figma assets. The original pseudo-3D vector is excluded as instructed.

Screenshots were captured at **1600×960, device scale 1**, with real loaded fonts and reduced motion. Private-source captures were compared directly to latest Figma PNG exports. `scripts/visual_diff.py` computes a full unmasked comparison: a pixel differs when its maximum absolute RGB channel error exceeds 16; mean absolute channel error is also recorded. No chart, layout or missing turbine region is masked. This is a simple defined image metric, not perceptual equivalence or a tolerance tuned to claim acceptance.

| Screen             | Different pixels | Mean channel error (0–255) | Gate |
| ------------------ | ---------------: | -------------------------: | ---- |
| Ringkasan          |          10.442% |                     11.437 | FAIL |
| Analisis / Tekanan |           7.530% |                      7.493 | FAIL |
| Metode             |          10.289% |                      8.262 | FAIL |

Private references, actuals, overlays, difference images, browser geometry/font checks and `comparison.json` are saved under `.private/visual/`. They contain restricted measurements and are not committed. Public documentation screenshots show only the independently generated synthetic example.

Remaining differences include the missing licensed turbine, additional traceability and method controls, truthful source/date disclosures, chart selection/bounds and residual typography/spacing. Some functional additions intentionally extend below the prototype's first viewport, including the keyboard-accessible table and import-management panel. These differences are disclosed and **do not establish pixel-accuracy**. Resolve unapproved visual differences and repeat the same comparison after acquiring the genuine 3D asset; do not replace the missing mesh with the Figma vector to reduce error artificially.

Responsive screenshots at 1440×900, 1280×800 and 390×844 are exercised by Playwright with no horizontal page overflow. Mobile intentionally reorganizes the sidebar and stacked panels. Axe WCAG A/AA checks cover all three routes at all four sizes. Automated accessibility checks do not replace an independent assistive-technology audit.

Reproduce local captures with a running dev server: `node scripts/capture.mjs` writes safe synthetic screenshots to `docs/images/`. Set `KAMOJANG_PRIVATE_SOURCE` only for authorized local comparison, then run that command again; private captures go to `.private/visual/`. Obtain fresh Figma exports in that private folder before running the diff script with a Python/Pillow environment. Never move private images into public documentation.
