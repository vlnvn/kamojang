# Data methodology and reproduction

## Scope and source priority

The supplied workbook was independently parsed with read-excel-file 9.3.12 and Python's standard-library OOXML reader. Both preserve the original rows. The workbook in the accompanying ZIP is byte-identical (SHA-256 `3446f0a50ace972b8afa05225904a93ff7de7d199c95410744b4c9c791ec1109`). Only one source workbook and one analysis archive were present; the originals were not modified.

Local checks reproduced 44 complete observations, 43 unique dates, source rows 4–47, five parameters, and 19 steam-quality values above 100%. Two observations share one date and remain separate. All 220 source values and all 220 standard-threshold scores/flags matched the archive at its recorded precision. Counts at thresholds 3.0, 3.5 and 4.0 were 9, 7 and 6. No individual real measurement or derived assessment is distributed in this repository.

The July 2026 PDF discusses approximately 42 monthly observations through mid-2026 and a 36/6 forecast split. The supplied workbook instead covers January 2022 through July 2025 and its independent benchmark uses 36/8 observations. The PDF's confidence intervals and forecast errors do not establish anomaly detection performance here. No verified incident labels or live sensor endpoint are provided. Source acknowledgements do not establish public redistribution permission.

## Estimator contract

For each parameter, compute median, MAD and scale `1.4826022185 × MAD` over the entire imported historical sample. Calculate signed `Z = (value − median) / scale`; flag strictly when `abs(Z) > threshold`. Do not round before deciding. Serialization retains source hash, source row, stable ID, unit, threshold and estimator version `robust-retrospective/1.0.0`.

If MAD scale is at most 1e-12, use the linearly interpolated sample IQR divided by 1.349, then sample standard deviation (n−1 denominator). If still degenerate, represent the scale as null, scores as zero, and estimator as `constant`. This is an explicit lack of detectable variation, not evidence of healthy equipment. Require at least three finite complete records; no missing=0 substitution. Extreme values beyond 1e100 are rejected to bound arithmetic.

The window is global and in-sample. It is retrospective and can change when more records are imported. It must not be presented as a prospective predictor, safe operating envelope, calibrated false positive rate or fault probability. Negative statistical bounds are retained and explained. Duplicate dates and values beyond physical expectations are quality-review categories, not equipment diagnoses.

## Public reproduction

`npm test` validates deterministic scoring, degeneracy, parser schema, malformed values, date validation, duplicate preservation, limits and export guards using synthetic data. `python -m unittest discover -s scripts -p test_audit.py -v` independently exercises robust arithmetic using the standard library. Public CI requires no workbook or private archive.

## Authorized local source workflow

Keep the four original handoff files in the repository root, where ignore rules protect them. Extract the analysis archive only into `.private/original/`. Never stage it. Then run:

```sh
python scripts/audit_source.py --source "Data Steam Quality, TDS & NCG Unit 5 Kamojang-1.xlsx" --archive Paket_Kamojang_Analisis_Sensor_Lengkap.zip
npm run audit:private
```

The Python command checks workbook/archive hashes, every source value, every standard score/flag and sensitivity counts. The TypeScript command independently reparses the original XLSX and checks the same parity. Neither writes public measurements. Use `Metode` to upload the source into the actual browser app. To automate that optional browser gate:

```powershell
$env:KAMOJANG_PRIVATE_SOURCE = (Resolve-Path 'Data Steam Quality, TDS & NCG Unit 5 Kamojang-1.xlsx').Path
npm run test:e2e -- --grep 'authorized private'
Remove-Item Env:KAMOJANG_PRIVATE_SOURCE
```

The original package tests initially failed before executing their assertions because `artifact_tool` was absent. A **private copy** replaced only that reader with the standard-library `read_source`; all six unchanged source tests passed. Original files were preserved. Application and independent parser parity close the ingestion reproducibility issue; they do not turn the failed original import into a pass.

## Independent forecast benchmark

Optional Python dependencies are pinned in `scripts/requirements-research.txt`; they are unnecessary for robust screening and the standard-library audit tests; the GPR test suite requires them. Use a local virtual environment and install them with `python -m pip install -r scripts/requirements-research.txt`. Then:

```sh
python scripts/benchmark.py --source "Data Steam Quality, TDS & NCG Unit 5 Kamojang-1.xlsx"
```

The output is written only to `.private/forecast-benchmark.json`. It trains the RBF + white-noise GPR on the first 36 chronological observations and evaluates the last eight, using training-only centering/scaling and random seed 1729. Median and last-value baselines use training data only. Same-day ties are not presented as a known intraday sequence.

Local execution with Python 3.14.0, NumPy 2.4.4 and scikit-learn 1.9.0 reproduced all 15 archived MAE/RMSE comparisons to six decimals. GPR had the lowest MAE for NCG only. Two optimizer-bound convergence warnings were recorded and remain a limitation. No accuracy claim for equipment anomaly classification follows from these results.

## Application GPR path

Run `npm run dev:research` after installing the pinned research requirements; use **Metode → GPR · prediksi → Jalankan benchmark GPR**. The UI invokes the same benchmark implementation, displays all fifteen MAE/RMSE comparisons and eight held-out points per sensor, and retains optimizer warnings. The posterior standard deviation is a model quantity, not a validated equipment-failure probability or calibrated operational confidence interval. Any variable imported dataset uses its first n−8 observations for fitting; training requires at least four rows. Duplicate dates are retained, but the split is rejected if it divides a shared date. All target centering/scaling and hyperparameter fitting use training observations only. The source PDF's split is not silently substituted.

`python -m unittest discover -s scripts -p test_research.py -v` checks protocol, chronological validation and absence of target leakage. With the local service running, `python scripts/verify-research.py --source "Data Steam Quality, TDS & NCG Unit 5 Kamojang-1.xlsx" --archive Paket_Kamojang_Analisis_Sensor_Lengkap.zip` imports the authorized workbook privately and compares all fifteen returned MAE/RMSE pairs with the research archive. On 28 October 2026 it passed, retaining two optimizer warnings. No individual actual or predicted private measurement is committed. `KAMOJANG_RESEARCH=1 npx playwright test tests/forecast.spec.ts` exercises actual service fitting plus rejection/failure behavior using synthetic observations (set the environment variable with PowerShell syntax on Windows).

## Separate multivariate protocol

The optional Isolation Forest path is specified in [Multivariate research](multivariate-research.md). It uses a 35/9 chronological split for the 44-row source, separate from GPR's 36/8 split. Robust scores and sensitivity counts remain authoritative in the original sensor views. Joint-model scores, manual-candidate decisions and contamination sensitivity are not merged into those per-sensor flags. No new fault-accuracy claim is implied.
