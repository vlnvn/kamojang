# Contributing to Kamojang

Kamojang is an independent research application with strict data-handling boundaries. Changes should be small enough to review and accompanied by evidence of the behavior they affect.

The active implementation is on `feat/initial-platform` in [draft PR #1](https://github.com/vlnvn/kamojang/pull/1). Open a focused branch from the current implementation branch when contributing to that work. Do not assume the default branch contains the application before the PR has merged.

## Development environment

Use the Node and npm versions recorded in [README](README.md#get-started), then install from the lockfile:

```sh
npm ci
npm run dev
```

The optional GPR and multivariate paths require the pinned Python dependencies and `npm run dev:research`. The default browser-only screening must remain usable when Python or WebGL is unavailable.

## Change boundaries

- Keep scoring and source identity logic in `src/domain.ts`; do not hardcode source measurements or introduce a second inconsistent scorer.
- Keep import parsing, limits and validation in `src/import.ts` and the worker. Preserve source rows, repeated dates and hash provenance.
- Keep GPR forecasting separate from retrospective anomaly screening. Forecast MAE and RMSE cannot be presented as fault-detection accuracy.
- Keep Isolation Forest outputs in the separate research protocol; never overwrite robust flags or claim manual candidates train the model. Test train-only preprocessing and result invalidation.
- Keep the 3D model's attribution, licensing and integrity record synchronized with any changes to model geometry, material, texture or packaging.
- Maintain keyboard access, mobile layout, reduced-motion support and failure handling when changing presentation components.
- Make documentation changes in the same pull request as the behavior they describe.

Read [architecture](docs/architecture.md), [data methodology](docs/data-methodology.md) and [asset provenance](docs/asset-provenance.md) before changing the relevant subsystem.

## Before opening a pull request

Run the applicable checks locally:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
python -m unittest discover -s scripts -p 'test_*.py' -v
npm run build
npm run test:e2e
npm run scan
```

Install Playwright's Chromium browser if necessary with `npx playwright install chromium`. For changes to the local research service, run its actual service-dependent tests using the environment documented in [testing](docs/testing.md). Do not mark skipped tests as passes.

Add or update tests when changing user behavior, schema handling, source provenance, safety boundaries, navigation, rendering or model lifecycle. For UI changes, capture the running app with synthetic data and report design differences. A passing screenshot baseline alone does not establish pixel equivalence.

## Commits and review

Use Conventional Commits with a clear, factual subject. Examples:

```text
fix(import): retain dataset after a worker failure
test(viewer): cover missing mesh fallback
docs(methodology): distinguish screening from forecasting
```

Do not invent commit history, co-authors, benchmarks or validation claims. Prefer focused commits whose changes are understandable without reconstructing an unrelated work session.

Before a push, stage explicit paths, inspect `git diff --cached` and run `npm run scan -- --staged`. Review the outgoing Git history as well. The scanner is a bounded guard, not a proof that secrets are absent.

A useful pull request contains:

- What changed and why, referencing the relevant issue or decision.
- How the change was tested, including actual commands, results and skipped checks.
- Before/after screenshots for visual changes, using only public synthetic data.
- Privacy, security, licensing and performance implications where applicable.
- Remaining gaps and conditions that must be met before release.

Keep a pull request in draft while its required acceptance gates remain unresolved. Do not force-push shared work or merge around failing checks.

## Confidentiality

Do not commit or attach the source workbook, research PDF, original archive, private screenshots, actual measurement exports, credentials or local audit files. The repository's public examples are intentionally synthetic. An imported measurement retains the distribution restrictions of its source even when transformed into a chart or JSON export.

Report security concerns privately where GitHub's private vulnerability reporting is enabled. Otherwise use the maintainer's [GitHub profile](https://github.com/vlnvn) to agree on a private channel. Follow [SECURITY.md](SECURITY.md); do not post sensitive data in public issues.

## Documentation conventions

Use descriptive sentence-case headings and short, precise sentences. Separate task instructions from architectural explanations and verification evidence. Prefer links to canonical documents rather than repeating dated results in several places. Distinguish measured behavior, assumptions and unverified limitations. The [documentation index](docs/README.md) identifies the primary source for each topic.

The repository's code license remains undecided. Contributing does not change the rights of third-party models, fonts or research data.
