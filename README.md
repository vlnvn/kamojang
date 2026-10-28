# Kamojang

An Indonesian-language application for inspecting historical geothermal sensor measurements, reviewing data quality and screening retrospective statistical deviations.

**Development status:** the implemented application is available in [draft PR #1](https://github.com/vlnvn/kamojang/pull/1) on `feat/initial-platform`. The default `main` branch remains the project baseline until the implementation is approved and merged. There is no public deployment or tagged release.

![Kamojang interface with independently generated synthetic measurements](https://raw.githubusercontent.com/vlnvn/kamojang/feat/initial-platform/docs/images/ringkasan.png)

*The screenshot uses synthetic measurements. No confidential Kamojang data appears in this repository.*

## Current implementation

The PR branch contains:

- Local CSV/XLSX import with schema checks, provenance, preserved duplicate dates and cancellable worker processing.
- Time-scaled review of pressure, temperature, steam quality, NCG and TDS, with a keyboard-accessible table and source-row inspector.
- Recomputed median/MAD screening, sensitivity controls and CSV/JSON exports.
- A self-hosted, attributed CC BY 4.0 steam-turbine model with interactive camera controls and failure fallback.
- Optional Gaussian Process Regression forecasting through a loopback-only Python service.

The application uses historical files, not live telemetry. Retrospective deviation flags do not establish equipment faults. GPR reports forecasting evaluation, not diagnostic accuracy.

## Run the application

Use Node.js 24.11.0 and npm 11.6.1, as recorded in the implementation's verification environment:

```sh
git clone https://github.com/vlnvn/kamojang.git
cd kamojang
git switch feat/initial-platform
npm ci
npm run dev
```

The built-in sample uses independently generated synthetic readings and does not require private research files. For the optional local GPR service:

```sh
python -m pip install -r scripts/requirements-research.txt
npm run dev:research
```

The research service runs on localhost only. It must not be deployed as a public API.

## Documentation and verification

The following links point to the implementation branch, because these files are not yet part of `main`:

- [Full README and architecture overview](https://github.com/vlnvn/kamojang/blob/feat/initial-platform/README.md)
- [Documentation index](https://github.com/vlnvn/kamojang/blob/feat/initial-platform/docs/README.md)
- [Data methodology](https://github.com/vlnvn/kamojang/blob/feat/initial-platform/docs/data-methodology.md)
- [3D asset provenance and attribution](https://github.com/vlnvn/kamojang/blob/feat/initial-platform/docs/asset-provenance.md)
- [Verification matrix and CI boundaries](https://github.com/vlnvn/kamojang/blob/feat/initial-platform/docs/testing.md)
- [Design fidelity and remaining signoff](https://github.com/vlnvn/kamojang/blob/feat/initial-platform/docs/design-fidelity.md)
- [Engineering report (Indonesian)](https://github.com/vlnvn/kamojang/blob/feat/initial-platform/docs/laporan-engineering.md)

The implementation PR has documented passing unit, browser, production-build and research-service checks. Final visual approval, real-device and assistive-technology testing, and project code licensing remain unresolved. GitHub Actions results apply only to the commit on which they ran.

## Rights and maintenance

The included steam-turbine asset is by [landinweaver](https://sketchfab.com/landinweaver) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the implementation branch documents its modifications and notice. Fonts have separate SIL OFL licenses. Original research inputs and outputs containing real measurements are not published.

**No software license has yet been granted for the project source code.** Public repository access does not imply permission to reuse it. Kamojang is research software, not a certified industrial safety or maintenance system.

Maintained by [vlnvn](https://github.com/vlnvn). Contributions and security guidance are in the linked implementation documentation.
