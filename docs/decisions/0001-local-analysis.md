# ADR 0001: Browser-local ingestion and one application scorer

Status: accepted, 28 October 2026.

The source inputs are restricted until redistribution permission is established. The exhibition needs a simple reproducible setup, but there is no authorized cloud data store, live sensor API or guaranteed Python web hosting environment. The prior package depends on artifact_tool, unavailable in this environment.

Choose a static Vite/React frontend, read-excel-file with streamed ZIP checks in a cancellable worker, and a pure TypeScript robust scorer. Verify it against both a standard-library Python OOXML reader and the source archive, observation by observation. Do not add a Python server or canned real-data JSON to the frontend.

A Python service would simplify direct reuse of the research stack, but introduces host, lifecycle and privacy responsibilities that are unnecessary here. A precomputed public JSON bundle would be simple but cannot analyze new files and lacks redistribution authorization. Both alternatives were rejected for the application path. Python remains useful only for independent audit and chronological GPR research.

Consequences: uploads need modern browser File/Worker/Web Crypto support and localhost or a secure hosted context. All uploaded data disappears on refresh. The public app uses an independent synthetic example. A future backend or live ingestion would require a new explicit decision and authorization.
