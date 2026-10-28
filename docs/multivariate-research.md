# Multivariate research workflow

This optional workflow adds joint five-sensor outlier screening, explicit model tuning and a manual candidate check. It does not replace the browser's median/MAD estimator or the GPR forecast experiment. It is an exploratory analysis tool, not an operational alarm or a validated fault classifier.

## Motivation and implementation provenance

The owner requested a comparison with [hamzbriel/sensor-anomaly-detection](https://github.com/hamzbriel/sensor-anomaly-detection/tree/2c72d1d7b09995947548e5d74c4eb1853566fd80), inspected at commit `2c72d1d7b09995947548e5d74c4eb1853566fd80` on 28 October 2026. Its useful additions were a multivariate Isolation Forest, contamination/tree controls and manual measurement evaluation. No software license was present in that inspected tree. This implementation was written independently against the scientific paper and public scikit-learn API; no reference source code, workbook, CSV or Streamlit UI is redistributed here. The repository is acknowledged as product inspiration, not as a licensed code dependency or a co-author.

| Capability                        | Existing Kamojang                                | Added workflow and boundary                                                                                 |
| --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Individual sensor screening       | Deterministic median/MAD, independently verified | Retained unchanged                                                                                          |
| Joint sensor model                | Not available                                    | Isolation Forest across all five values; no invented per-sensor causal attribution                          |
| Model settings                    | Robust threshold; separate GPR kernel            | Explicit contamination and tree controls; changes invalidate old results                                    |
| New manual observation            | Not available                                    | A separate candidate scored against the full-reference model; never appended to training data               |
| Reference and holdout distinction | GPR forecast holdout                             | Separate in-sample and chronological holdout models for multivariate screening                              |
| Result trace                      | Robust CSV/JSON with source hash/row             | Separate scoped CSV/JSON including model parameters, seed, source identity, values and full-precision score |
| Limits and validation             | Strict importer and bounded loopback service     | Existing safeguards retained; identity/configuration/manual validation added                                |

## Run an experiment

1. Install the pinned research requirements and run `npm run dev:research` (or build, then `npm run preview:research`).
2. Use the synthetic example or import an authorized reference file through the existing worker.
3. In **Metode**, open **Isolation Forest · riset** under **Eksperimen multivariat**. Focus and scroll move to the experiment panel.
4. Select contamination in 0.01–0.30 and 50, 100, 200 or 300 trees. Defaults are 0.05 / 100 for comparison with the inspected reference, not claimed optimal settings.
5. Optionally enable **Uji pengukuran manual** and supply five values with displayed units. The initial values are separate per-feature medians; they are not an actual observation or a physically validated joint operating point.
6. Click **Jalankan Isolation Forest**. Review the fitted-reference table, chronological holdout and sensitivity table. Export deliberately if needed; exports inherit the source's confidentiality requirements.

The experiment accepts 12–256 complete observations. These are application/resource guards, not evidence of statistical sample sufficiency. Standardized values outside the estimator’s float32 representation are rejected rather than clipped. The service remains bound to 127.0.0.1:8341. Data is sent only by the explicit run action, with no cloud request, measurement log, model pickle or persistence. Navigation preserves a completed result; a reference, setting or candidate change invalidates it. Cancellation aborts the request and terminates the corresponding local subprocess. Missing-service and invalid-input errors preserve the core dataset.

## Scientific and numerical contract

Feature order is pressure, temperature, steam quality, NCG and TDS. `StandardScaler` precedes scikit-learn `IsolationForest`, with seed 42, `max_samples="auto"`, all features, no bootstrap and one worker. Scaling is included for a declared, reproducible comparison contract; it is not claimed to make a tree model more accurate.

Two models are fitted independently:

- **Reference model:** fit all reference observations, then score those same observations. This is in-sample screening. A manual candidate uses this model without refitting on the candidate.
- **Holdout model:** reserve the last `ceil(0.20 × n)` chronological observations. Fit scaler, forest and decision threshold only on earlier observations. Reject a boundary that divides a shared date. For 44 rows this produces 35 training / 9 testing; GPR's separate 36/8 split remains unchanged.

Decision score is `score_samples − offset_`; a strictly negative score is flagged using full precision. Display rounding never determines the flag. A nonnegative score is described as **Tidak ditandai**, not evidence of healthy equipment. The sensitivity table recalibrates offsets on the same fitted reference forest at preset contamination values and the selected value. It does not claim to retrain a different forest for every offset. Tied scores can yield fewer flagged rows than a nominal fraction.

Contamination is a threshold-setting input, not ground-truth fault prevalence, accuracy or calibrated operational false-alarm rate. Holdout counts and scores measure application of a frozen earlier model, not diagnostic correctness. No incident labels, precision/recall/F1, prospective maintenance reliability or optimal parameter selection are asserted. Correlated operating regimes, small samples, temporal drift and physical plausibility need domain review before operational use.

## Sources and verification

- Liu, Ting and Zhou, [Isolation Forest (2008), original author-hosted paper](https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/icdm08b.pdf), DOI 10.1109/ICDM.2008.17: scientific algorithm source. Its published benchmark results are not transferred to Kamojang.
- [Official scikit-learn IsolationForest API](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html): score direction, numeric contamination, offset and parameter semantics. Runtime remains pinned to scikit-learn 1.9.0; the live stable documentation may be newer.
- [Official scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage): preprocessing and fitting must not learn from held-out observations.

`python -m unittest discover -s scripts -p test_isolation.py -v` checks determinism, unchanged reference results when a candidate is added, held-out-value leakage, tied-score behavior, invalid identities/configuration and sensitivity against independent estimator fits. TypeScript contract tests reject stale/misaligned/nonfinite responses and guard CSV formula prefixes. Service/browser tests exercise actual fitting, both exports, cancellation/unavailable service, 403/400/413/409 handling, reference reset and axe/overflow checks at desktop/mobile widths.

An authorized private local comparison with the inspected reference matched 44 reference and 9 holdout decisions and serialized scores at its five-decimal precision. This is compatibility evidence, not accuracy validation. No per-observation output is published. Current dated commands and CI evidence are in [testing](testing.md).

[Actual UI capture with independently synthetic inputs](images/isolation.png).

## Loopback API reference

| Method and path              | Request / response boundary                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GET /api/research/health     | Metadata only; existing service/protocol identifiers retained with additional supported_protocols                                    |
| POST /api/research/forecast  | Existing request ID, source hash and normalized rows; GPR protocol unchanged                                                         |
| POST /api/research/isolation | Same identity/rows plus contamination, n_estimators and optional five-field manual object; returns isolation-reference-holdout/1.0.0 |
| POST /api/research/cancel    | Request ID only; can cancel an active or not-yet-started request                                                                     |

POST requires exact permitted localhost Host/Origin and application/json. Requests are capped at 256 KiB, one compute job across both protocols and 60 seconds per subprocess. Statuses include 400 invalid schema/configuration/split, 403 untrusted origin, 413 oversized body, 409 pre-cancelled request, 429 occupied slot, 422 computation/dependency/range failure and 504 timeout. Responses are no-store. These are engineering safeguards for a local utility, not authorization for public hosting. Row identities must be unique positive integers; dates must be canonical ISO. No file path or executable name can be supplied by a client.
