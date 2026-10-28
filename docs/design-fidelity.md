# Design fidelity

Reference: [current Figma](https://www.figma.com/design/gY9jfZPlSrbRfoo2FwJE81/Untitled?node-id=18-8), inspected during the 27–28 October 2026 execution session. Read design context and screenshots for `18:8` (overview), `18:84` (pressure), `18:428` (methods), `18:672` and `24:2` (inspection angles), and `16:2` (SDLC board). Page metadata discovered the remaining sensor, GPR, sensitivity and dialog frames. Additional detailed contexts were inspected for `18:156`, `18:224`, `18:292`, `18:360`, `43:5` and `43:50`.

The implementation uses CSS variables, responsive grid/flex, a 236 px desktop navigation rail, ceramic canvas, forest/graphite surfaces and copper indications. Instrument Sans and IBM Plex Sans are bundled with their actual licenses. SVG icons are exported locally into their corresponding interface slots. Charts are computed from measurements rather than flattened Figma assets. The original pseudo-3D vector is excluded as instructed.

Screenshots were captured at **1600×960, device scale 1**, with real loaded fonts and reduced motion. Private-source captures were compared directly to latest Figma PNG exports. `scripts/visual_diff.py` computes a full unmasked comparison: a pixel differs when its maximum absolute RGB channel error exceeds 16; mean absolute channel error is also recorded. No chart, layout or turbine region is masked. This is a simple defined image metric, not perceptual equivalence or a tolerance tuned to claim acceptance.

| Screen             | Baseline different pixels | Current different pixels | Current mean channel error | Gate                               |
| ------------------ | ------------------------: | -----------------------: | -------------------------: | ---------------------------------- |
| Ringkasan          |                   10.442% |                  13.038% |                     12.837 | FAIL: full-frame pixel equivalence |
| Analisis / Tekanan |                    7.530% |                   7.149% |                      6.676 | FAIL: full-frame pixel equivalence |
| Metode             |                   10.289% |                   9.913% |                      7.475 | FAIL: full-frame pixel equivalence |

Private references, actuals, overlays, difference images, browser geometry/font checks and `comparison.json` are saved under `.private/visual/`. They contain restricted measurements and are not committed. Public documentation screenshots show only the independently generated synthetic example.

The current revision was inspected again on 28 October 2026 (Figma session `abb5cf0f-bf0d-4582-99f7-0bab0ef1ff9a`). Frozen reference SHA-256 values are stored privately in `.private/continuation/frozen-references.json`. Canonical chart titles now follow the owner's requested wording: **Tekanan, NCG, Kualitas uap, TDS, Suhu**. This intentionally differs from prototype titles using “Perubahan” and lowercased acronyms.

`node scripts/geometry-audit.mjs` records expected and observed rectangles/computed fonts, line heights, padding, radii and shadows. At 1600×960 the sidebar is exactly 236 px; header is `[283,0,1260,75]`; stage is approximately `[863.42,110,695.56,728]` against `[864,110,695,728]`; chart, inspector and method/source panel positions differ by less than 1 px. All 11 named critical alignment checks pass the explicit 2 CSS px criterion. Natural CSS heading boxes differ from fixed Figma text-box dimensions; their positions are audited separately. This is an alignment check, not proof of identical component appearance.

A fixed-coordinate diagnostic (`scripts/component_diff.py`) preserves the full-frame metric and additionally reports: sidebar 2.410–2.508%, header 3.008%, hero title 4.728%, sensor controls 7.037%, chart heading 9.853%, source heading 7.171%, source card 12.454%. These are diagnostic cropped differences, not a replacement acceptance score. Removing invented negative heading letter spacing corrected a visible typography discrepancy; parameter widths and header geometry follow measured design coordinates.

Intentional differences requiring final owner visual approval include the authentic representative mesh replacing Figma's illustration, visible attribution and controls, minimum 44 px hit targets, truthful source/date disclosures, canonical titles, traceability and executable GPR controls. Private-data plot differences are assessed separately from interface structure. No hidden chart values or fake mesh were used to improve a score. **A5 remains BLOCKED for final visual signoff; raw pixel-equivalence remains FAIL.**

Responsive screenshots, no horizontal page overflow and axe A/AA checks cover all three main routes at 1600×960, 1440×900, 1280×800, 390×844 and 430×932. Actual touch orbit/pinch is tested at emulated DPR 2 (renderer capped to 1.5), plus pointer and keyboard camera interaction. Mobile stacks panels and changes navigation. These tests do not replace real-phone or assistive-technology user testing.

Reproduce local captures with a running dev server: `node scripts/capture.mjs` writes safe synthetic screenshots to `docs/images/`. Set `KAMOJANG_PRIVATE_SOURCE` only for authorized local comparison, then run that command again; private captures go to `.private/visual/`. Obtain fresh Figma exports in that private folder before running the diff script with a Python/Pillow environment. Never move private images into public documentation.

## Research and turbine-navigation extension

The method frame 18:428 was re-read for this task in session 77530218-cbcf-4307-861c-3a2a1af284ec. Existing tokens, typefaces, buttons, panels and tables are reused. The new research launcher is below the existing method/import content, and the research component is deferred until opened. The 11 critical geometry checks still pass their recorded 2 px alignment criteria; this does not replace the earlier unmasked pixel comparison.

At the owner's explicit usability correction, Jelajahi turbin and Lihat objek now expose a dedicated heading and full-width inspection scene, with keyboard focus and return-focus behavior. This is an intentional new interaction rather than a claim that Figma's alternate illustrative view has become pixel-identical. The genuine asset, credit and fallback are retained. New synthetic captures are docs/images/isolation.png and docs/images/turbin-inspeksi.png, generated by scripts/capture-research.mjs. Existing pixel-equivalence FAIL / final visual-signoff BLOCKED status remains open.
