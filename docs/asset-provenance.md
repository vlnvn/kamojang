# Asset provenance

Verified 28 October 2026, Asia/Jakarta. The owner supplied `steam_turbine.zip`; this resolves the earlier authenticated-download blocker. No unofficial downloader or viewer-cache extraction was used. The embedded `license.txt` and glTF `asset.extras` agree on work, author, source and **CC BY 4.0**. The notice permits commercial use with attribution. This is license evidence from the delivered package, not a claim to have independently established the author's title chain.

## Genuine steam-turbine mesh

- Work: [Steam Turbine](https://sketchfab.com/3d-models/steam-turbine-bcc264eafbe4412d9c061d6d97f30b99), by [landinweaver](https://sketchfab.com/landinweaver).
- Exact license: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Redistribution and adaptation are allowed subject to credit, license link and indication of modifications. No endorsement is implied.
- Acquisition: owner-provided archive inspected 2026-10-28; 48,108,578 bytes, 24 members (notice, glTF, binary geometry and 20 images).
- Original ZIP SHA-256: `e53794fc2548973690a9c38e1d8a04e70aba148ecb85d2cb0082058cace0d3ad`.
- Original `scene.gltf` SHA-256: `a79974004a6bdd2c2178102d975287b8805a76f8e5e38213b8782c1a65cfb3d5`.
- Inspected original: 206 nodes, 101 meshes/primitives, 18 materials, 20 textures, **173,703 rendered triangles**, no animations.
- Two identified backdrop planes only (`Object_44` floor and `Object_46` wall) were removed: four triangles. No turbine geometry simplification was performed.
- glTF Transform 4.5.1 merges/welds/prunes/instances geometry, limits textures to 1024 px WebP and applies Meshopt compression. Materials are consolidated; texture conversion may change appearance. Original and optimized renders were compared locally.
- Optimized `public/models/steam-turbine.glb`: **1,215,756 bytes**, SHA-256 `4446fc0d98782dbd343868b578339878ee7a868173f35f04b5620d2637b92591`.
- Optimized: 17 meshes/primitives, 8 materials, 16 images; 52,645 unique stored triangles and **173,699 rendered triangles after instancing**. These are different counts, not a claimed 70% geometry reduction.
- Curated, unoptimized source GLB: 52,061,840 bytes, retained privately. Delivered bytes are approximately 97.66% smaller; network timings depend on caching/device.
- glTF Validator 2.0.0-dev.3.10 reports zero errors and zero warnings for both variants. The optimized report has 45 informational messages, including unsupported extension validation for instancing, Meshopt and WebP. Browser decoding/rendering is verified separately; zero validator errors do not imply complete extension coverage.

`npm run build:model` reproduces conversion from the ignored original archive and writes its manifest and notice. Raw extraction, source preview, validator reports, rendered comparisons and measurements stay in `.private/`. The public source-preview path is explicitly ignored. `scripts/viewer-evidence.mjs` captures the actual rendered optimized mesh and produces its licensed WebP fallback. No generated or flattened imitation of a turbine is substituted.

The UI and credits dialog show work, author, source, license and modifications; `public/models/LICENSE.txt` carries the delivered notice, and `manifest.json` carries reproducible hashes/statistics. Three.js 0.186.1 and glTF Transform are MIT licensed. The mesh is **representative steam equipment, not Kamojang Unit 5 hardware or a plant-accurate digital twin**. The camera orbits; no rotor animation or simulated operating state is claimed.

## Fonts

Both packages are pinned to Fontsource **5.3.0**, downloaded on the local execution session beginning 27 October 2026. License text is bundled under `public/licenses/` and copied by Vite into the production output.

| Font            | Author / source                                                                          | Rights      | Shipped weights                                |
| --------------- | ---------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| Instrument Sans | Instrument Sans Project Authors; [source](https://github.com/Instrument/instrument-sans) | SIL OFL 1.1 | Variable normal, 400–700; display uses 500/600 |
| IBM Plex Sans   | IBM; [source](https://github.com/IBM/plex)                                               | SIL OFL 1.1 | Normal 400, 500, 600                           |

Font files are resolved locally from package imports; no font CDN is needed at runtime. Browser font availability is checked during screenshot capture. No font outlines were modified.

## Interface icons and screenshots

Seven SVG icons were exported from the supplied current Figma design: overview `38:5`, analysis `38:10`, methods `38:13`, inspect `38:17`, arrow `72:20`, source review `67:5`, and quality review `38:32`. They are used as interface assets at their intended sizes; no temporary MCP asset URL remains in runtime code. Their origin is the user-supplied design, not a newly asserted third-party open license. No pseudo-3D turbine or flattened chart asset is included.

Public screenshots under `docs/images/` show the actual running application with the independently generated synthetic fixture. Current Figma reference images, private-workbook screenshots, overlays and differences remain under ignored `.private/visual/`. They must not be committed without the necessary rights.

## Comparison implementation boundary

The multivariate capability review used hamzbriel/sensor-anomaly-detection at 2c72d1d7b09995947548e5d74c4eb1853566fd80. No explicit code license was present in that tree. Only product ideas were adopted; the estimator integration was written independently from primary research and the public scikit-learn API. No source code, workbook, cached results or Streamlit assets from that repository are shipped. Synthetic research and expanded-view screenshots were captured from this application. The turbine GLB/license/manifest are unchanged by the navigation extension.
