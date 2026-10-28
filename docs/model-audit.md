# Comparing model suitability

The three application methods answer different questions. Robust Z-score labels deviations in each sensor against a historical reference; Isolation Forest scores joint five-sensor observations; GPR forecasts each sensor from elapsed time. The current GPR implementation fits five independent regressions, not a cross-sensor multivariate model. None has verified equipment-fault classification accuracy.

This audit was requested on 28 October 2026. It preserves the supplied workbook, source PDF, archived calculations, production scoring, model settings and existing UI. It adds a reproducible local comparison rather than selecting an algorithm from unrelated benchmark rankings. It does not introduce a new model, ensemble, synthetic fault labels or an operational alarm.

## What the evidence can establish

| Question                                                 | Available evidence                                                                    | Interpretation                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Does the implementation reproduce the source analysis?   | Independent workbook reparse, every robust assessment, archived GPR MAE/RMSE          | Numerical reproducibility, not fault accuracy       |
| Which forecast has lower error?                          | Chronological GPR, training-median and last-value forecasts on identical observations | Per-sensor, per-period comparison in native units   |
| Do sensor observations look unusual jointly?             | Isolation Forest with explicit fit population, seed, tree count and contamination     | Exploratory outlier score, not a fault probability  |
| Are results sensitive to the reference or configuration? | Training-only robust reference, multiple IF seeds/tree counts/offsets                 | Stability and disagreement, not correctness         |
| Is one detector more accurate, earlier or safer?         | No independent incident labels, event times or calibrated alarm costs                 | **BLOCKED**; no universal winner can be established |

The source PDF selects GPR for forecasting with an RBF plus white-noise kernel. Its stated data coverage and holdout differ from the supplied workbook, as recorded in [data methodology](data-methodology.md). The PDF's forecast metrics cannot be substituted for this workbook's results. Its correlation/VIF discussion does not by itself establish controller causality, nonlinear dependence, or superiority over every alternative. The report does not supply an independently labeled three-detector comparison.

## Reproduce privately

Install the existing pinned [research requirements](../scripts/requirements-research.txt). From the repository root:

```powershell
$env:OPENBLAS_NUM_THREADS = '1'
$env:OMP_NUM_THREADS = '1'
python scripts/model_audit.py --source 'Data Steam Quality, TDS & NCG Unit 5 Kamojang-1.xlsx' --archive Paket_Kamojang_Analisis_Sensor_Lengkap.zip --report 'Unpad Report.pdf'
```

The command reads originals without modification and checks source/archive parity before producing a completed report. It checks archived forecast metrics at their recorded six-decimal precision. It writes only to the fixed, Git-ignored `.private/model-comparison/` directory:

- `audit.json`: source/PDF/archive fingerprints, audit-script hash, repository snapshot, runtime versions, model outputs, warnings, intervals, configuration comparisons and timing samples.
- `laporan-audit-model.md`: Indonesian findings, native-unit forecast comparisons, suitability matrix and unresolved gates.

These outputs contain restricted derived results and source-row identities. Keep them local; do not attach them to public PRs, issues, CI artifacts or external services. Console output contains only aggregate reproduction gates. Public CI runs synthetic unit tests and never receives the workbook, PDF, archive or real model outputs.

## Protocol `model-suitability-audit/1.0.0`

1. Reproduce the original application protocols first. Do not replace the global historical robust reference, Isolation Forest's 80/20 observation split, or GPR's final-eight-observation holdout.
2. For a separate matched comparison, reserve the last eight observations for all three methods. Fit robust median/scale, IF standardization/forest/offset, and GPR target normalization/kernel exclusively on preceding observations. Preserve duplicate dates and reject any split that divides one date.
3. Compare GPR against training median and last-observation baselines on the same sensor, dates and units. IF has no point-forecast output, so an IF MAE/RMSE is **not applicable**. Never average errors in bara, degrees, percentages and ppm into an unsupported overall score. Retain metric ties at archived precision.
4. Examine additional expanding prefixes with at least 20 training observations and eight-observation test blocks, anchored to the final observation. This rule is fixed before reading comparative results; it is an exploratory audit design, not a report requirement or optimized statistical minimum. Do not search for favorable folds or tune on them.
5. Record actual calendar horizons. These samples are irregular, so equal observation counts do not imply equal durations. Earlier observations become training data in later folds; the folds are not independent replications. A previously inspected holdout is not a fresh prospective confirmation.
6. Keep IF's default 100 trees, contamination 0.05 and seed 42 as the comparison anchor. Examine seeds `42, 0–8`, tree counts `50, 100, 200, 300`, and contamination offsets `0.01, 0.05, 0.10, 0.15, 0.20, 0.30`. These are sensitivity checks, not a search for an optimal fault detector. Offset sensitivity reuses the fitted forest and training scores, matching sklearn's numeric-contamination contract.
7. Compare robust row flags (any sensor flagged) with IF row flags only at the same evaluation unit. Record intersection/union and Jaccard as **agreement, not accuracy**. Jaccard for two empty sets is undefined and serialized as null, rather than perfect agreement.
8. Count held-out points inside GPR's mean ±1.95996 posterior predictive SD separately for each sensor. This describes pointwise nominal 95% bands; it neither proves operational calibration nor defines an anomaly detector. Retain optimizer warnings. Do not infer failure probability, simultaneous coverage or diagnostic accuracy.
9. Measure three warm Python calls for each existing application calculation and retain all samples. Workloads differ: one robust calculation, two IF fits, five GPR regressions. This measures local computation, not browser/API latency, cold start, peak memory or production hardware performance. The browser's TypeScript robust runtime is not timed by this script.

The training-only robust scorer preserves all original degeneracy fallbacks for audit parity. A constant reference produces a null scale and zero scores; it cannot establish the normality of a different future value. This limits prospective use and must be handled as unassessable before an operational rollout. No production behavior is silently changed by this audit.

## Decision boundary

Retain robust screening as the explainable historical per-sensor baseline. Keep IF as a distinct joint-pattern investigation tool and GPR as a separately evaluated forecast experiment. These roles are engineering suitability decisions, **not a ranking of fault accuracy**. More complex methods, more flags, fewer flags, stable seeds or agreement with another unlabeled detector do not establish a stronger model.

A defensible anomaly-model selection needs an independently reviewed event definition, operation/maintenance records, event timestamps, measurement-method clarification and alarm costs. Freeze development thresholds, then evaluate a genuinely new chronological period. Report precision/recall, false alarms per time and event-level lead time where sampling supports it; do not derive ground truth from one model's own flags. Without those inputs, replacement of the main detector or automatic maintenance recommendations remains unsupported.

## Verification and references

`python -m unittest discover -s scripts -p test_model_audit.py -v` uses independently generated synthetic observations. It checks robust arithmetic/fallback parity, absence of future-value leakage, shared holdout identities, duplicate-date rejection, fixed fold boundaries, metric ties, interval counting, undefined empty-set agreement and refusal to fabricate accuracy. See the dated [verification record](testing.md).

The scientific/API references were checked on 28 October 2026. The installed research runtime remains pinned to sklearn 1.9.0; the live stable documentation identified itself as 1.9.1. No dependency upgrade was made for this audit.

- [NIST: outlier detection](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm): potential outliers require investigation and distribution context.
- [NIST: median absolute deviation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/mad.htm): robust scale and its normal-distribution interpretation.
- [IsolationForest API](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html): score direction, contamination offsets and random-state controls.
- [GaussianProcessRegressor API](https://scikit-learn.org/stable/modules/generated/sklearn.gaussian_process.GaussianProcessRegressor.html): predictive mean and standard deviation.
- [TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html): time ordering and the equal-spacing condition for equal-duration fold comparison. The audit uses explicit observation blocks and reports unequal durations instead.
- [Common pitfalls: data leakage](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage): fitting transformations on training observations only.
- [Evaluation of outlier detection estimators](https://scikit-learn.org/stable/auto_examples/miscellaneous/plot_outlier_detection_bench.html): labeled evaluation and dataset-dependent performance.
