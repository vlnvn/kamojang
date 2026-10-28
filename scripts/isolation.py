"""Independent sklearn-based multivariate research protocol; no model persistence."""
import math
from benchmark import validate_rows
from audit_source import KEYS

PROTOCOL = 'isolation-reference-holdout/1.0.0'


def prepare_request(data):
    rows = data.get('rows')
    if not isinstance(rows, list):
        raise ValueError('Baris referensi diperlukan.')
    rows = validate_rows(rows, test_rows=max(1, math.ceil(len(rows) * .2)))
    contamination = data.get('contamination', .05)
    trees = data.get('n_estimators', 100)
    if isinstance(contamination, bool) or not isinstance(contamination, (int, float)) or not .01 <= contamination <= .30 or not math.isfinite(contamination):
        raise ValueError('Contamination harus antara 0,01 dan 0,30.')
    if isinstance(trees, bool) or not isinstance(trees, int) or trees not in (50, 100, 200, 300):
        raise ValueError('Jumlah pohon harus 50, 100, 200 atau 300.')
    manual = data.get('manual')
    if manual is not None:
        if not isinstance(manual, dict) or set(manual) != set(KEYS):
            raise ValueError('Lima parameter lengkap diperlukan untuk input manual.')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or abs(v) > 1e50 or not math.isfinite(v) for v in manual.values()):
            raise ValueError('Input manual harus berupa angka berhingga dalam batas komputasi.')
    return {'rows': rows, 'contamination': contamination, 'n_estimators': trees, 'manual': manual}


def experiment(data):
    import numpy as np
    import sklearn
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    request = prepare_request(data)
    rows, fraction, trees = request['rows'], request['contamination'], request['n_estimators']
    matrix = np.asarray([[r[k] for k in KEYS] for r in rows], dtype=float)

    def transform(scaler, x):
        scaled = scaler.transform(x)
        if not np.isfinite(scaled).all() or np.any(np.abs(scaled) > np.finfo(np.float32).max):
            raise ValueError('Rentang numerik di luar representasi estimator.')
        return scaled

    def fit(x):
        scaler = StandardScaler().fit(x)
        forest = IsolationForest(n_estimators=trees, contamination=fraction,
                                 max_samples='auto', max_features=1.0, bootstrap=False,
                                 random_state=42, n_jobs=1).fit(transform(scaler, x))
        return scaler, forest

    def points(scaler, forest, x, source):
        scores = forest.decision_function(transform(scaler, x))
        return [{'source_row': r['source_excel_row'], 'date': r['date'],
                 'values': {k: r[k] for k in KEYS}, 'score': float(score),
                 'flagged': bool(score < 0)} for r, score in zip(source, scores)]

    scaler, forest = fit(matrix)
    reference = points(scaler, forest, matrix, rows)
    cut = len(rows) - math.ceil(len(rows) * .2)
    train_scaler, train_forest = fit(matrix[:cut])
    holdout = points(train_scaler, train_forest, matrix[cut:], rows[cut:])
    raw_scores = forest.score_samples(transform(scaler, matrix))
    sensitivity = []
    # sklearn's numeric contamination calibrates the offset on training scores.
    # Keep forest and seed fixed; ties mean the fraction is not an exact quota.
    for c in sorted({.01, .05, .10, .15, .20, .30, fraction}):
        offset = float(np.percentile(raw_scores, 100 * c))
        sensitivity.append({'contamination': c, 'offset': offset,
                            'flagged': int(np.sum(raw_scores < offset))})
    manual = None
    if request['manual'] is not None:
        candidate = np.asarray([[request['manual'][k] for k in KEYS]], dtype=float)
        score = float(forest.decision_function(transform(scaler, candidate))[0])
        manual = {'values': request['manual'], 'score': score, 'flagged': bool(score < 0)}
    return {'protocol': PROTOCOL, 'features': KEYS, 'seed': 42,
            'config': {'contamination': fraction, 'n_estimators': trees, 'max_samples': 'auto',
                       'max_features': 1.0, 'bootstrap': False, 'preprocessing': 'StandardScaler'},
            'versions': {'numpy': np.__version__, 'scikit_learn': sklearn.__version__},
            'reference': {'fit_rows': len(rows), 'offset': float(forest.offset_), 'observations': reference},
            'holdout': {'train_rows': cut, 'test_rows': len(rows)-cut,
                        'train_last_date': rows[cut-1]['date'], 'test_first_date': rows[cut]['date'],
                        'offset': float(train_forest.offset_), 'observations': holdout},
            'sensitivity': sensitivity, 'manual': manual}
