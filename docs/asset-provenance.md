# Asset provenance

Audit date: 28 October 2026 (Asia/Jakarta). No turbine model has been acquired or redistributed. The genuine-mesh acceptance gate is **BLOCKED**.

## Steam Turbine candidate

- Work: [Steam Turbine](https://sketchfab.com/3d-models/steam-turbine-bcc264eafbe4412d9c061d6d97f30b99)
- Author shown in the listing: **landinweaver**.
- Listing metadata found through the official indexed Sketchfab page: CC Attribution, 173.7k triangles, published 29 January 2021. This is listing metadata, not a local mesh inspection.
- Direct page retrieval returned HTTP 403 in this environment. The official `api.sketchfab.com/v3/models/bcc264eafbe4412d9c061d6d97f30b99/download` request returned HTTP **401**, `Authentication credentials were not provided.`
- [Official download API guidance](https://sketchfab.com/developers/download-api/guidelines) requires authenticated downloads. No credentials were available, no login was fabricated and no private viewer cache or unofficial download URL was used.
- Exact license version: **not verified**. Original filename, acquisition date, SHA-256, local bytes, textures, actual geometry, draw calls, load time and FPS: **not available**.
- Transformations: none. No GLB, glTF, STL, screenshot or substitute turbine vector is shipped.

A final Windows browser attempt was halted by the Computer Use policy mechanism because it could not determine the current browser URL confidently enough to enforce policy. No further UI automation was attempted. This does not establish that the user's browser is signed into Sketchfab; authenticated acquisition remains unverified.

The [Scottish Maritime Museum turbine-pattern comparator](https://sketchfab.com/3d-models/qe2-starboard-high-pressure-turbine-pattern-8e135c1a917c476a98f011a48c4192c7) also returned HTTP 403 for direct retrieval. It was not adopted: a historical marine casting pattern would need truthful identification and suitability review, in addition to lawful acquisition. Other search results did not supply a verified, appropriate, unauthenticated steam-turbine download; a boiler or wind turbine is not a faithful substitution.

Next gate: obtain a permitted genuine mesh through the official authenticated download or an owner-provided lawful file, verify the individual license/version and redistribution terms, record original filename/hash/date and transformations, then implement loading, PBR lighting, bounded controls, disposal, context loss, 404/slow-loading behavior, actual-mesh fallback and measured optimization/performance. Add visible author/work/license/modification attribution. Do not call it a plant-accurate digital twin. No code license can override mesh licensing obligations.

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
