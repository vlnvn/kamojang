# Architecture

The application is a static React frontend. No backend, authentication, database, broker or simulated live sensor service is introduced. It can run on localhost or a static host once publication rights and acceptance gates are cleared.

`src/import.worker.ts` accepts the user's File, reports actual processing phases and returns a normalized dataset. The UI can cancel by terminating the worker. `src/import.ts` validates extensions/MIME, 2 MiB input, ZIP signature and streamed expansion (16 MiB, at most 200 entries), then rejects formula/macro/external-link contents and noncanonical schemas. It parses one sheet with read-excel-file 9.3.12, or parses strict UTF-8 CSV. No formula evaluation or silent imputation occurs. Source row and SHA-256 survive sorting.

`src/domain.ts` is the authoritative application scorer. Pure typed functions compute retrospective median/MAD references, deterministic scores, flags, quality warnings and guarded CSV output. Python is an independent verification and optional forecast path, not an application API or competing UI result source.

`src/App.tsx` owns in-memory dataset, per-sensor selection, dialogs and worker lifecycle. URL hash parameters hold route, sensor and threshold for browser back/forward and refresh. Reselecting a route preserves selection and settings. Refresh intentionally discards uploaded measurements and reloads the synthetic example; no source data enters localStorage, IndexedDB or the URL. `src/Chart.tsx` maps actual dates to a continuous time axis; same-date observations remain distinct points and table rows. The source row order breaks display ties without implying intraday chronology.

Native dialog modal behavior is supplemented with explicit Tab wrapping and focus return. Backdrop clicks do not dismiss dialogs; Close or Escape does. One modal is rendered at a time. Chart selection also has an accessible table alternative. CSS adapts the 236 px desktop sidebar to a mobile navigation row. Fonts are bundled locally. No animation or remote fonts are required.

There is an application error boundary and explicit empty/import-failure/offline/model-unavailable states. The turbine route is a disclosure of a blocked asset gate, not a placeholder renderer. Adding a mesh requires a separately reviewable acquisition, license, loader, disposal, fallback and performance implementation.

Build and CI require no private inputs. Public examples and documentation screenshots originate only from `src/demo.ts`, an independently generated synthetic dataset. `.private/` contains local source audit output and restricted visual comparison artifacts and is excluded from all commits.
