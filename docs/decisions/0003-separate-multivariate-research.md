# ADR 0003: Separate multivariate reference and holdout research

Status: accepted for implementation, 28 October 2026, following the owner's explicit request to adopt useful capabilities from an inspected comparison repository.

Keep `src/domain.ts`, import contracts and the GPR benchmark as the existing independent paths. Add an opt-in Isolation Forest experiment to the loopback service. This prevents silently changing 220 verified robust scores or rebranding multivariate outlier scores as forecast errors. Reuse already installed/pinned NumPy and scikit-learn; no new frontend or Python dependency is needed.

Independently implement the public estimator API. The comparison repository lacks an explicit code license; do not copy its source, assets or data. Acknowledge the capability inspiration and cite primary scientific/API sources in the canonical multivariate guide.

Fit separate full-reference and chronological 80/20 models. The full-reference model scores manual candidates without adding them to training. Fit all holdout preprocessing and the decision offset on training data only. Preserve source identities, reject an ambiguous same-date boundary, expose configuration/seed/versions/scope in exports and invalidate results after inputs change.

Use the existing one-job, 60-second subprocess and cancellation boundary. Validate the result in TypeScript against the exact dataset, request ID and selected configuration before rendering or exporting. No pickle, persistent training session, cloud endpoint, synthetic accuracy percentage or causal sensor attribution is introduced.

The new launcher and panel follow existing CSS, typography and accessible form/table patterns below the existing method/import workflow. The overview, original parameter charts and 3D asset remain independent. The turbine route separately expands the real viewer in response to an explicit usability defect; it preserves model bytes, camera controls and attribution.
