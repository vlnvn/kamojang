# Documentation

Kamojang separates day-to-day instructions, system reference and research decisions. Start with the task you need to complete rather than reading every document in order.

## Use the application

| Task                                               | Where to start                                    |
| -------------------------------------------------- | ------------------------------------------------- |
| Install, start or build the frontend               | [Project README](../README.md#get-started)        |
| Import a workbook and inspect sensor readings      | [Project README](../README.md#what-it-does)       |
| Enable the optional local research service         | [Project README](../README.md#get-started)        |
| Run multivariate screening or a manual candidate   | [Multivariate workflow](multivariate-research.md) |
| Understand file validation and estimator behavior  | [Data methodology](data-methodology.md)           |
| Report a vulnerability or handle restricted inputs | [Security policy](../SECURITY.md)                 |

The public examples use generated synthetic measurements. The original workbook and any exports containing actual measurements must remain outside public issues, commits and documentation assets.

## Understand the system

| Reference                                                    | Contents                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [Architecture](architecture.md)                              | Import worker, state, scoring, viewer, localhost service and trust boundaries      |
| [ADR 0001](decisions/0001-local-analysis.md)                 | Why robust screening runs in the browser                                           |
| [ADR 0002](decisions/0002-genuine-viewer-and-local-gpr.md)   | Why the turbine asset is self-hosted and GPR runs through optional loopback Python |
| [ADR 0003](decisions/0003-separate-multivariate-research.md) | Why multivariate research is separate from robust scores and GPR                   |
| [Data methodology](data-methodology.md)                      | Source precedence, robust estimator, edge cases and forecasting protocol           |
| [Asset provenance](asset-provenance.md)                      | Source, license, integrity hashes, model optimization and rendering limitations    |

## Verify a change

| Reference                                    | Contents                                                             |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [Verification matrix](testing.md)            | Commands, observed checks, CI, known gaps and scoped pass conditions |
| [Design fidelity](design-fidelity.md)        | Figma references, comparison method and unresolved visual signoff    |
| [Continuation audit](continuation-audit.md)  | Defects investigated during 3D and GPR implementation                |
| [Engineering report](laporan-engineering.md) | Dated Indonesian implementation and verification record              |
| [Contributing](../CONTRIBUTING.md)           | Review expectations, commit conventions and disclosure boundaries    |

Use `npm ci` before running local checks. The CI workflow is `/.github/workflows/ci.yml`; its results apply to the tested commit only. Screenshots captured from restricted research data must not be uploaded as CI artifacts or committed.

## Current release boundary

The application code is on [draft PR #1](https://github.com/vlnvn/kamojang/pull/1), not the default `main` branch. The verified turbine viewer and optional GPR integration are available in that branch. Final visual approval, software licensing and real-device/assistive-technology testing remain unresolved. There is no public deployment or released version.

The screening method flags retrospective statistical deviations; it is not a validated diagnostic or predictive maintenance system. Forecast evaluation metrics are not fault-detection accuracy.

For historical verification details, follow the dated testing record instead of assuming the status of an older commit still applies.
