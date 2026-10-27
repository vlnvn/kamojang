# Kamojang

A local-first interface for historical sensor review and retrospective robust outlier screening, with an executable local research forecasting benchmark and a licensed interactive steam-turbine mesh.

![Running application with independently generated synthetic measurements](docs/images/analisis.png)

The Indonesian interface explores pressure, temperature, steam quality, non-condensable gases (NCG), and total dissolved solids (TDS). The public example is explicitly **synthetic and does not represent Kamojang measurements**. There is no live sensor connection, validated equipment-failure detector, or production deployment.

## Capabilities

- Parse actual XLSX or UTF-8 CSV files locally in a cancellable worker. Validate columns, units, dates, finite numbers, size and row limits; reject formulas, extra sheets and excessive decompression.
- Preserve repeated dates, original source rows, SHA-256 provenance and distinct measurement identities.
- Recompute median/MAD screening at thresholds 3.0, 3.5 and 4.0. Review selected observations in a time-scaled chart and accessible table; export traceable CSV/JSON assessments.
- Separate duplicate-date and physical-data review warnings from statistical indications. Uploaded data stays in memory and is discarded on refresh.
- Navigate responsive overview, analysis and method views with keyboard-accessible dialogs, local fonts and reduced-motion support.

**Open acceptance gate:** Figma visual comparison is measured but does not pass full-frame pixel-equivalence. The genuine mesh intentionally replaces the prototype illustration; final visual approval remains pending. See [testing](docs/testing.md), [design fidelity](docs/design-fidelity.md) and [asset provenance](docs/asset-provenance.md). This is a research prototype, not a safety system.

## Architecture

```text
XLSX / CSV → local worker → strict schema → in-memory measurements
                                              ↓
                                  TypeScript median/MAD scoring
                                              ↓
                             chart + inspector + table + export

Optional loopback Python service → train-only GPR fit → holdout evaluation
Licensed GLB → lazy Three.js viewer → bounded orbit / actual-mesh fallback
```

React 19.3.1, TypeScript 5.9.3 and Vite 8.3.5 provide a static frontend. `read-excel-file` 9.3.12 parses XLSX; `fflate` 0.8.3 guards archive expansion. No database, external telemetry or cloud data storage is required. The optional GPR service binds only to loopback; robust screening works without it. [Architecture and decisions](docs/architecture.md) explain the boundaries.

## Requirements and setup

Use Node.js **24.11.0** and npm **11.6.1**, as verified locally. Python **3.14.0** runs the independent standard-library checks. A current Chromium browser is used for automated verification.

```sh
git clone https://github.com/vlnvn/kamojang.git
cd kamojang
# Check out the implementation PR branch if it has not merged:
git switch feat/initial-platform
npm ci
npm run dev
```

Open the localhost address printed by Vite, normally `http://127.0.0.1:5173`. On Windows use PowerShell; the same npm commands work on Linux. The public example runs without research inputs or Python packages. For a production bundle:

```sh
npm run build
npm run preview
```

To enable **Metode → GPR · prediksi**, install the pinned research dependencies and start both local processes:

```sh
python -m pip install -r scripts/requirements-research.txt
npm run dev:research
# Or, after building:
npm run preview:research
```

Python 3.14.0, NumPy 2.4.4 and scikit-learn 1.9.0 were verified. `KAMOJANG_PYTHON` can select a virtual-environment interpreter. The GPR action fits five models on demand; it requires 12–256 observations and reserves the final eight for testing. Missing dependencies produce an actionable error. Measurements reach only the local process after an explicit request; no cloud service is used.

All fonts, model files and icons are local. Running a local server with dependencies installed avoids an internet dependency during an exhibition. There is no service worker or guarantee of browser-offline reload support.

## Import and reproduce

Open **Metode → Impor dan kelola data**. Download the CSV template and fill its six columns in their original order, using ISO dates and decimal points. Alternatively, import the original six-column, single-sheet Kamojang workbook. Files are limited to 2 MiB, 5,000 observations and 16 MiB decompressed content. No formulas or macros are executed. Invalid imports retain the previous dataset.

Public tests generate independent synthetic inputs. Authorized researchers can follow [the private source audit](docs/data-methodology.md) to compare the supplied workbook with the separate analysis archive. The workbook, PDF, ZIP, actual measurements and derived outputs are excluded from Git; local processing does not grant redistribution rights. Do not attach research data to issues, pull requests or public screenshots. Exports contain input measurements and require the same handling as their source.

## Method and limitations

Each sensor uses its global historical median and `scale = 1.4826022185 × median(abs(x − median))`. An indication occurs when `abs((x − median) / scale) > threshold`. Zero-MAD fallback uses IQR/1.349, then sample standard deviation; constant data has zero scores and an explicit non-detectable scale. At least three complete observations are required.

This is in-sample **retrospective screening**, not forecasting or diagnosis. Thresholds have not been calibrated to operating risk. Statistical bounds may be nonphysical, including a negative lower TDS bound. Steam quality above 100% warrants methodological review rather than automatic deletion. No verified incident labels are available, so precision, recall, F1 and failure probabilities cannot be reported.

The optional chronological GPR experiment evaluates forecast MAE/RMSE against median and last-observation baselines, using 36 training and 8 held-out observations for the private source. Its metrics and actual/predicted held-out points are available in the application. It remains separate from screening and is not offered as a detector. The source PDF has a different temporal scope and cannot establish performance for this workbook. [Methodology](docs/data-methodology.md) records the evidence and warnings.

## Testing and CI

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
python -m unittest discover -s scripts -p 'test_*.py' -v
npm run build
npx playwright install chromium
npm run test:e2e
npm run scan
```

CI installs from the lockfile and runs code, Python, build, browser, responsive and axe checks without confidential inputs. A deliberately optional private-source browser check is skipped publicly. Screenshots and traces are captured on browser failure. [The test matrix](docs/testing.md) distinguishes local results, CI results and outstanding gates; passing automated checks does not establish universal performance or pixel-equivalence. The separate GPR CI job installs research dependencies and exercises actual fitting; the public browser job skips those two service-dependent tests and one private-workbook test.

## Sources and credits

UI reference: [current Figma design](https://www.figma.com/design/gY9jfZPlSrbRfoo2FwJE81/Untitled?node-id=18-8). The application uses semantic HTML, CSS and computed charts; it does not embed design screenshots. Original prototype turbine vectors are deliberately excluded.

Instrument Sans by the Instrument Sans Project Authors and IBM Plex Sans by IBM are bundled from Fontsource 5.3.0 under SIL OFL 1.1, with licenses in `public/licenses/`. Seven interface icons were exported from the supplied Figma design. Dependency licenses are retained in installed packages; no third-party work is relicensed as project code.

[Steam Turbine by landinweaver](https://sketchfab.com/3d-models/steam-turbine-bcc264eafbe4412d9c061d6d97f30b99) is included under **CC BY 4.0**, verified from the owner-provided archive notice and matching glTF metadata. Changes: backdrop planes removed, instancing/compression and WebP textures; no turbine geometry simplification. Visible attribution and a render from the actual mesh accompany the viewer. It is representative equipment, not a Kamojang digital twin. Three.js is MIT licensed. See [asset provenance](docs/asset-provenance.md).

## Contributing, security and licensing

An evidence-based [Indonesian engineering report](docs/laporan-engineering.md) records implemented behavior and remaining acceptance gates.

Maintainer: [vlnvn](https://github.com/vlnvn). Read [CONTRIBUTING](CONTRIBUTING.md) and [SECURITY](SECURITY.md). Code license selection is pending owner authorization; public availability alone does not grant an open-source license. Research sources and third-party assets have separate rights. No release, customer deployment, industrial certification or security SLA is claimed.
