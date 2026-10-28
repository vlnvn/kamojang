"""Read-only model comparison. Measurement-bearing results stay in ignored .private/."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import statistics
from datetime import date, datetime, timezone
from pathlib import Path
from time import perf_counter

from audit_source import KEYS, audit, percentile, robust
from benchmark import benchmark, validate_rows
from isolation import experiment

PROTOCOL = 'model-suitability-audit/1.0.0'
THRESHOLDS = (3.0, 3.5, 4.0)
SEEDS = (42, 0, 1, 2, 3, 4, 5, 6, 7, 8)
TREE_COUNTS = (50, 100, 200, 300)
CONTAMINATIONS = (.01, .05, .10, .15, .20, .30)
UNITS = dict(zip(KEYS, ('bara', 'degC', '%', '% massa', 'ppm')))


def fit_robust(rows):
    """Training-only counterpart of the published browser estimator; never changes it."""
    refs = {}
    for key in KEYS:
        values = [r[key] for r in rows]
        center = statistics.median(values)
        scale = 1.4826022185 * statistics.median(abs(v-center) for v in values)
        estimator = 'MAD'
        if scale <= 1e-12:
            scale = (percentile(values, .75)-percentile(values, .25))/1.349
            estimator = 'IQR'
        if scale <= 1e-12:
            scale = statistics.stdev(values)
            estimator = 'SD'
        if scale <= 1e-12:
            scale, estimator = None, 'constant'
        refs[key] = {'median': center, 'scale': scale, 'estimator': estimator}
    return refs


def score_robust(refs, rows, threshold=3.5):
    return [{'source_row': r['source_excel_row'], 'date': r['date'],
             'scores': {k: (r[k]-refs[k]['median'])/refs[k]['scale']
                        if refs[k]['scale'] is not None else 0.0 for k in KEYS},
             'flagged_sensors': [k for k in KEYS if refs[k]['scale'] is not None
                                 and abs((r[k]-refs[k]['median'])/refs[k]['scale']) > threshold]}
            for r in rows]


def isolation_holdout(rows, cut, seed=42, trees=100, contamination=.05):
    import numpy as np
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    # Same-date boundary checks and validation precede any fitting.
    rows = validate_rows(rows, test_rows=len(rows)-cut)
    matrix = np.asarray([[r[k] for k in KEYS] for r in rows])
    scaler = StandardScaler().fit(matrix[:cut])
    train, test = scaler.transform(matrix[:cut]), scaler.transform(matrix[cut:])
    forest = IsolationForest(n_estimators=trees, contamination=contamination,
                             random_state=seed, n_jobs=1, max_samples='auto',
                             max_features=1.0, bootstrap=False).fit(train)
    raw_train = forest.score_samples(train)
    raw_test = forest.score_samples(test)
    scores = raw_test-float(forest.offset_)
    return {'seed': seed, 'trees': trees, 'contamination': contamination,
            'offset': float(forest.offset_),
            'observations': [{'source_row': r['source_excel_row'], 'date': r['date'],
                              'score': float(s), 'flagged': bool(s < 0)}
                             for r, s in zip(rows[cut:], scores)],
            'sensitivity': [{'contamination': c,
                             'offset': float(np.percentile(raw_train, 100*c)),
                             'test_flagged': int(np.sum(raw_test < np.percentile(raw_train, 100*c)))}
                            for c in CONTAMINATIONS]}


def agreement(a, b):
    """Set overlap is agreement only. Empty-union Jaccard is undefined, not perfect."""
    union = a | b
    return {'intersection': len(a & b), 'union': len(union),
            'jaccard': len(a & b)/len(union) if union else None}


def forecast_summary(result):
    """Native-unit errors stay separate. No average across incompatible sensor units."""
    summary = []
    for key in KEYS:
        metrics = [m for m in result['metrics'] if m['sensor'] == key]
        points = result['series'][key]
        # Pointwise predictive bands, not a simultaneous interval or fault probability.
        inside = sum(abs(p['actual']-p['predicted']) <= 1.959963984540054*p['posterior_sd']
                     for p in points)
        row = {'sensor': key, 'unit': UNITS[key], 'metrics': metrics,
               'gpr_pointwise_95_band_inside': inside, 'band_denominator': len(points)}
        # Archived metrics have six-decimal precision; retain ties at that precision.
        for metric in ('mae', 'rmse'):
            best = min(m[metric] for m in metrics)
            row[f'lowest_{metric}_methods'] = [m['method'] for m in metrics if m[metric] == best]
        summary.append(row)
    return summary


def matched_fold(rows):
    rows = validate_rows(rows)
    cut = len(rows)-8
    refs = fit_robust(rows[:cut])
    rpoints = score_robust(refs, rows[cut:])
    iforest = isolation_holdout(rows, cut)
    gpr = benchmark(rows)
    rset = {p['source_row'] for p in rpoints if p['flagged_sensors']}
    iset = {p['source_row'] for p in iforest['observations'] if p['flagged']}
    first = date.fromisoformat(rows[cut]['date'])
    last_train = date.fromisoformat(rows[cut-1]['date'])
    last = date.fromisoformat(rows[-1]['date'])
    return {'train_rows': cut, 'test_rows': 8, 'train_last_date': last_train.isoformat(),
            'test_first_date': first.isoformat(), 'test_last_date': last.isoformat(),
            'test_span_days': (last-first).days, 'last_forecast_horizon_days': (last-last_train).days,
            'robust_training_references': refs, 'robust_holdout': rpoints,
            'isolation_holdout': iforest, 'row_flag_agreement_not_accuracy': agreement(rset, iset),
            'forecasts': forecast_summary(gpr), 'gpr_warnings': gpr['warnings'],
            'gpr_series': gpr['series']}


def rolling_prefixes(rows):
    """Eight-observation blocks, ending at the final row; minimum 20 training rows.

    Not equal-duration folds, not independent experiments, and never used for tuning.
    Reject a duplicate-date boundary instead of silently dropping or moving rows.
    """
    return [n for n in range(len(rows), 27, -8)][::-1]


def timed(call, repeats=3):
    samples = []
    for _ in range(repeats):
        start = perf_counter()
        call()
        samples.append((perf_counter()-start)*1000)
    return {'samples_ms': samples, 'median_ms': statistics.median(samples),
            'max_ms': max(samples), 'repeats': repeats,
            'scope': 'warm Python function including fitting/scoring; not browser/API latency or peak memory'}


def compare(rows, measure=True):
    import numpy as np
    import scipy
    import sklearn
    rows = validate_rows(rows)
    cut = len(rows)-8
    application_if = experiment({'rows': rows})
    application_gpr = benchmark(rows)
    reference = robust(rows)
    full_refs = fit_robust(rows)
    full_scores = score_robust(full_refs, rows)
    index = {(p['source_row'], k): z for p in full_scores for k, z in p['scores'].items()}
    if not all(math.isclose(index[e['source_excel_row'], e['sensor']], e['z'], abs_tol=1e-12)
               for e in reference):
        raise AssertionError('Training-only scorer does not reproduce independent robust reference')
    folds = [matched_fold(rows[:n]) for n in rolling_prefixes(rows)]
    if not folds:  # The supported 12–27-row range can still reproduce a single holdout.
        folds = [matched_fold(rows)]
    common = folds[-1]
    baseline = common['isolation_holdout']
    base_flags = {p['source_row'] for p in baseline['observations'] if p['flagged']}
    seed_runs = []
    for seed in SEEDS:
        run = baseline if seed == 42 else isolation_holdout(rows, cut, seed=seed)
        flags = {p['source_row'] for p in run['observations'] if p['flagged']}
        seed_runs.append({'seed': seed, 'flagged': len(flags),
                          'vs_seed_42': agreement(base_flags, flags), 'observations': run['observations']})
    tree_runs = []
    for trees in TREE_COUNTS:
        run = baseline if trees == 100 else isolation_holdout(rows, cut, trees=trees)
        tree_runs.append({'trees': trees, 'flagged': sum(p['flagged'] for p in run['observations']),
                          'observations': run['observations']})
    flags_by_threshold = []
    for t in THRESHOLDS:
        events = robust(rows, t)
        flags_by_threshold.append({'threshold': t, 'assessments_flagged': sum(e['flagged'] for e in events),
                                   'rows_flagged': len({e['source_excel_row'] for e in events if e['flagged']}),
                                   'per_sensor': {k: sum(e['flagged'] for e in events if e['sensor'] == k)
                                                  for k in KEYS}})
    future_only = rows[cut:]
    original_rows = {p['source_row'] for p in full_scores if p['flagged_sensors']}
    prospective_rows = {p['source_row'] for p in common['robust_holdout'] if p['flagged_sensors']}
    changed = []
    for r in future_only:
        old = next(p for p in full_scores if p['source_row'] == r['source_excel_row'])
        new = next(p for p in common['robust_holdout'] if p['source_row'] == r['source_excel_row'])
        if old['flagged_sensors'] != new['flagged_sensors']:
            changed.append({'source_row': r['source_excel_row'], 'retrospective': old['flagged_sensors'],
                            'training_only': new['flagged_sensors']})
    intervals = [(date.fromisoformat(b['date'])-date.fromisoformat(a['date'])).days
                 for a, b in zip(rows, rows[1:])]
    output = {'protocol': PROTOCOL, 'recorded_at_utc': datetime.now(timezone.utc).isoformat(),
              'versions': {'python': platform.python_version(), 'numpy': np.__version__,
                           'scipy': scipy.__version__, 'scikit_learn': sklearn.__version__,
                           'platform': platform.platform(),
                           'thread_environment': {k: os.environ.get(k) for k in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS')}},
              'dataset': {'rows': len(rows), 'unique_dates': len({r['date'] for r in rows}),
                          'first_date': rows[0]['date'], 'last_date': rows[-1]['date'],
                          'consecutive_gap_days': {'min': min(intervals), 'median': statistics.median(intervals),
                                                   'max': max(intervals)},
                          'steam_quality_above_100': sum(r['steam_quality_percent'] > 100 for r in rows),
                          'verified_fault_labels': False},
              'application_protocols': {'robust': {'fit_rows': len(rows), 'thresholds': flags_by_threshold},
                                        'isolation': application_if, 'gpr': application_gpr},
              'matched_chronological_folds': folds,
              'robust_reference_dependence': {'changed_test_sensor_flags': changed,
                                              'test_row_flag_agreement': agreement(
                                                  original_rows & {r['source_excel_row'] for r in future_only},
                                                  prospective_rows)},
              'isolation_stability_not_accuracy': {'seed_runs': seed_runs, 'tree_runs': tree_runs},
              'anomaly_accuracy': {'status': 'BLOCKED', 'reason': 'No verified independent fault/anomaly labels',
                                   'precision': None, 'recall': None, 'f1': None,
                                   'false_alarm_rate': None, 'winner': None},
              'gpr_anomaly_classifier': {'status': 'NOT IMPLEMENTED',
                                         'reason': 'Forecast posterior bands are not a calibrated anomaly decision rule'},
              'recommendation': {'historical_per_sensor_review': 'retain robust baseline',
                                 'joint_sensor_review': 'Isolation Forest as separate exploratory adjunct',
                                 'forecast': 'compare each sensor and period with median/last-value baselines',
                                 'universal_winner': None}}
    if measure:
        output['timing'] = {'robust_python_reference': timed(lambda: robust(rows)),
                            'isolation_application_two_fits': timed(lambda: experiment({'rows': rows})),
                            'gpr_application_five_fits': timed(lambda: benchmark(rows))}
    # Validate that the private report is serializable without nonstandard NaN/Infinity.
    json.dumps(output, allow_nan=False)
    return output


def markdown(result):
    data = result['dataset']
    final = result['matched_chronological_folds'][-1]
    lines = ['# Audit tiga model Kamojang', '',
             'Hasil lokal terbatas. Jangan unggah laporan ini ke GitHub/CI atau layanan eksternal.', '',
             f"Protokol: `{PROTOCOL}`. Waktu UTC: {result['recorded_at_utc']}. Potret kode: `{result.get('code_snapshot', 'not recorded')}`.", '',
             '## Kesimpulan', '',
             '**Belum ada pemenang akurasi deteksi/prediksi anomali yang terverifikasi.** Tidak tersedia label insiden independen. '
             'Kesepakatan model, sedikit/banyak tanda, stabilitas seed, dan galat prediksi bukan pengganti label kebenaran.', '',
             'Pertahankan Robust Z-score untuk tinjauan historis per sensor. Isolation Forest melengkapi pemeriksaan gabungan '
             'lima sensor. GPR tetap eksperimen prediksi nilai sensor; jangan mengganti model utama berdasarkan satu split.', '',
             '## Sumber dan batas', '',
             f"- Dataset asli: {data['rows']} observasi / {data['unique_dates']} tanggal, {data['first_date']} sampai {data['last_date']}.",
             f"- Jarak observasi (hari): {data['consecutive_gap_days']}; data tidak diinterpolasi atau dipaksa bulanan.",
             f"- Kualitas uap >100%: {data['steam_quality_above_100']} observasi; dipertahankan sebagai masalah definisi/metode pengukuran yang perlu ditinjau.",
             '- PDF Juli 2026 (halaman PDF 5, 9–12) menyebut sekitar 42 observasi sampai pertengahan 2026 dan split 36/6. '
             'Workbook berbeda: hasil PDF tidak dipindahkan sebagai hasil workbook ini.',
             '- Tabel PDF 4.1 tidak menyediakan baseline pembanding, label insiden, atau evaluasi klasifikasi anomali. '
             'Klaim kausal tentang PID, hubungan nonlinier, dan kelayakan model lain belum dibuktikan oleh korelasi rendah saja.',
             '- GPR aplikasi adalah lima regresi terpisah dengan masukan waktu, bukan model multivariat antarsensor.',
             '- Tidak ada penghapusan nilai, penyatuan tanggal duplikat, penambahan label sintetis, tuning menggunakan holdout, atau perubahan model produksi.', '',
             '## Reproduksi protokol asli', '',
             f"- Paritas arsip: {result.get('archive_parity', 'not requested')}.",
             '- Robust: ' + '; '.join(f"ambang {r['threshold']}: {r['assessments_flagged']} tanda parameter pada {r['rows_flagged']} baris"
                                      for r in result['application_protocols']['robust']['thresholds']) + '.',
             f"- Isolation Forest: referensi {data['rows']}, holdout {result['application_protocols']['isolation']['holdout']['train_rows']}/"
             f"{result['application_protocols']['isolation']['holdout']['test_rows']}; contamination 0,05, 100 pohon, seed 42.",
             f"- GPR: {result['application_protocols']['gpr']['train_rows']}/8; {len(result['application_protocols']['gpr']['warnings'])} peringatan optimizer disimpan di JSON.", '',
             '## Perbandingan dengan batas waktu yang sama', '',
             f"Semua model memakai {final['train_rows']} observasi pertama sebagai referensi dan delapan terakhir untuk pemeriksaan. "
             'Versi robust khusus audit memakai statistik latih saja. IF memakai preprocessing/offset latih saja. '
             'GPR mempertahankan kernel/seed/normalisasi aslinya. IF bukan regresor sehingga tidak diberi MAE/RMSE buatan.', '',
             '| Sensor | Satuan | MAE median | MAE nilai terakhir | MAE GPR | MAE terendah | RMSE terendah | Dalam pita GPR nominal 95% |',
             '|---|---|---:|---:|---:|---|---|---:|']
    for row in final['forecasts']:
        metrics = {m['method']: m for m in row['metrics']}
        lines.append(f"| {row['sensor']} | {row['unit']} | {metrics['median']['mae']:.6f} | "
                     f"{metrics['last_observation']['mae']:.6f} | {metrics['gpr']['mae']:.6f} | "
                     f"{', '.join(row['lowest_mae_methods'])} | {', '.join(row['lowest_rmse_methods'])} | "
                     f"{row['gpr_pointwise_95_band_inside']}/{row['band_denominator']} |")
    lines += ['', 'MAE/RMSE dinilai per satuan sensor, bukan dirata-ratakan lintas satuan. '
              'Pita adalah mean ±1,95996 SD posterior prediktif; cakupan delapan titik ini bersifat deskriptif, '
              'bukan akurasi anomali atau bukti kalibrasi operasional.', '',
              '## Pemeriksaan periode tambahan', '',
              'Prefix ditetapkan berdasarkan jumlah observasi sebelum membaca hasil: minimum 20 latih, blok uji delapan observasi, '
              'berakhir pada observasi terakhir. Tidak ada pencarian hyperparameter atau pemilihan periode terbaik. '
              'Durasi kalender berbeda, training saling bertumpang tindih, dan periode akhir sudah pernah dipakai penelitian '
              'sehingga ini bukan konfirmasi prospektif independen.', '',
              '| Latih/uji | Batas latih → awal uji | Rentang uji (hari) | Horizon akhir (hari) | Pemenang MAE per sensor | Peringatan GPR |',
              '|---|---|---:|---:|---|---:|']
    for fold in result['matched_chronological_folds']:
        winners = '; '.join(r['sensor']+': '+','.join(r['lowest_mae_methods']) for r in fold['forecasts'])
        lines.append(f"| {fold['train_rows']}/8 | {fold['train_last_date']} → {fold['test_first_date']} | "
                     f"{fold['test_span_days']} | {fold['last_forecast_horizon_days']} | {winners} | {len(fold['gpr_warnings'])} |")
    seed_runs = result['isolation_stability_not_accuracy']['seed_runs']
    lines += ['', '## Sensitivitas dan kestabilan', '',
              f"- Robust: {len(result['robust_reference_dependence']['changed_test_sensor_flags'])} baris uji berubah daftar tanda parameternya "
              'ketika acuan global diganti acuan latih saja. Skor historis memang bergantung pada jendela referensi.',
              '- IF, seed berbeda (100 pohon, contamination 0,05, split sama): ' +
              '; '.join(f"{r['seed']} → {r['flagged']} tanda" for r in seed_runs) + '.',
              '- IF, jumlah pohon berbeda (seed 42): ' + '; '.join(f"{r['trees']} → {r['flagged']} tanda"
                  for r in result['isolation_stability_not_accuracy']['tree_runs']) + '.',
              '- IF, contamination berbeda pada forest tetap (offset dihitung hanya dari skor latih): ' +
              '; '.join(f"{r['contamination']} → {r['test_flagged']} tanda uji" for r in final['isolation_holdout']['sensitivity']) + '.',
              '- Kesepakatan tanda baris robust/IF: ' + json.dumps(final['row_flag_agreement_not_accuracy']) +
              '. Ini bukan precision, recall, atau validasi silang terhadap kebenaran.',
              '- Kasus tanpa variasi: estimator robust produksi memakai scale null dan skor nol. '
              'Jika acuan latih konstan lalu nilai baru berbeda, skor nol tetap tidak cukup untuk menilai penyimpangan. '
              'Audit mempertahankan kontrak ini untuk paritas; gunakan status tidak dapat dinilai sebelum penerapan prospektif.',
              '- Semua observasi, skor, warning, referensi, dan hasil sensitivitas tersedia di audit.json lokal untuk penelusuran.', '',
              '## Biaya komputasi lokal', '',
              'Pengukuran fungsi Python setelah impor/model warm-up. Beban berbeda: robust satu perhitungan, IF dua forest, '
              'GPR lima regresi. Tidak mencakup browser/network, peak memory, atau perangkat produksi.', '']
    for name, timing in result.get('timing', {}).items():
        lines.append(f"- {name}: median {timing['median_ms']:.3f} ms, maksimum {timing['max_ms']:.3f} ms, "
                     f"n={timing['repeats']}. Semua sampel disimpan.")
    lines += ['', '## Matriks keputusan', '',
              '| Aspek | Robust Z-score | Isolation Forest | GPR |',
              '|---|---|---|---|',
              '| Tinjauan historis per sensor | Metode utama, transparan | Skor gabungan; bukan penjelasan kausal sensor | Bukan fungsi utama implementasi |',
              '| Kombinasi lima sensor | Tidak dimodelkan | Dimodelkan tanpa label | Tidak dimodelkan; input hanya waktu |',
              '| Perubahan terhadap waktu | Urutan waktu tidak masuk skor | Urutan waktu tidak masuk skor | Waktu masuk regresi; bukan simulator fisik |',
              '| Prediksi nilai masa depan | Median dapat menjadi baseline | Tidak tersedia | Tersedia; bandingkan dengan baseline per sensor |',
              '| Acuan dan pengaturan | Median/MAD, ambang belum dikalibrasi risiko | Contamination/pohon/seed belum dioptimasi independen | Kernel/noise/normalisasi dan warning harus diperiksa |',
              '| Penerapan | Browser lokal, tanpa layanan Python | Layanan loopback Python opsional | Layanan loopback Python opsional |',
              '| Akurasi anomali/peringatan dini | BLOCKED: tanpa label/waktu kejadian | BLOCKED: tanpa label/waktu kejadian | BLOCKED: tanpa aturan dan label terverifikasi |', '',
              '## Keputusan dan gate berikutnya', '',
              '**Tidak mengganti model utama.** Tidak ada dasar terverifikasi untuk juara universal atau ensemble yang lebih akurat. '
              'Pilih fungsi sesuai pertanyaan, simpan ketidaksetujuan model sebagai bahan tinjauan engineer.', '',
              'Diperlukan definisi kejadian independen, log maintenance/operasi, waktu awal kejadian, metode/kalibrasi pengukuran, '
              'dan biaya alarm palsu versus kejadian terlewat. Tetapkan ambang pada data pengembangan, bekukan protokol, '
              'lalu uji periode baru berdasarkan tanggal. Ukur precision/recall dan alarm palsu per waktu, serta lead time '
              'hanya bila waktu kejadian dan frekuensi sampel mendukungnya. Data ini belum membenarkan klaim monitoring cepat.', '',
              'Referensi metode: NIST outlier detection; dokumentasi resmi sklearn IsolationForest, GaussianProcessRegressor, '
              'TimeSeriesSplit dan common pitfalls (tautan di docs/model-audit.md).', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--report', default='Unpad Report.pdf', help='Locally reviewed PDF; fingerprint only, never uploaded')
    args = parser.parse_args()
    report_hash = hashlib.sha256(Path(args.report).read_bytes()).hexdigest()
    rows = audit(args.source, args.archive)  # Prints aggregate parity only, never measurements.
    import zipfile
    result = compare(rows)
    with zipfile.ZipFile(args.archive) as archive:
        cached = json.loads(archive.read('kamojang_results.json'))['forecast_benchmark']
    expected = {(m['sensor'], m['method']): (m['mae'], m['rmse']) for m in cached}
    actual = result['application_protocols']['gpr']['metrics']
    if len(actual) != len(expected) or any(expected[m['sensor'], m['method']] != (m['mae'], m['rmse']) for m in actual):
        raise AssertionError('Archived GPR metrics do not match; no completed report written')
    result['archive_parity'] = 'PASS: 220 source values, 220 robust scores/flags, 15 forecast MAE/RMSE pairs'
    result['input_sha256'] = {name: hashlib.sha256(Path(path).read_bytes()).hexdigest()
                             for name, path in [('workbook', args.source), ('archive', args.archive)]}
    result['input_sha256']['reviewed_pdf'] = report_hash
    import subprocess
    result['code_snapshot'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    result['audit_script_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    private = Path(__file__).resolve().parents[1]/'.private'/'model-comparison'
    # Fixed ignored destination; no option to accidentally publish real derived outputs.
    subprocess.run(['git', 'check-ignore', '--quiet', str(private/'audit.json')], check=True,
                   cwd=Path(__file__).resolve().parents[1])
    private.mkdir(parents=True, exist_ok=True)
    (private/'audit.json').write_text(json.dumps(result, indent=2, allow_nan=False), encoding='utf-8', newline='\n')
    (private/'laporan-audit-model.md').write_text(markdown(result), encoding='utf-8', newline='\n')
    print('PASS: source/archive reproduction and comparison completed. Private JSON and Indonesian report: .private/model-comparison/.')
    print('BLOCKED: anomaly accuracy ranking requires independent incident labels. No accuracy winner asserted.')


if __name__ == '__main__':
    main()
