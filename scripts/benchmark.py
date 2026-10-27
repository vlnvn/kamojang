"""Optional local-only chronological forecast experiment, separate from application scoring."""
import argparse
import json
import warnings
from datetime import date
from pathlib import Path
from audit_source import KEYS, read_source
import math


def validate_rows(rows):
    if not isinstance(rows, list) or not 12 <= len(rows) <= 256:
        raise ValueError('GPR memerlukan 12–256 pembacaan lengkap; delapan observasi terakhir menjadi data uji.')
    clean = []
    for i, row in enumerate(rows):
        if not isinstance(row, dict) or not isinstance(row.get('date'), str):
            raise ValueError(f'Baris {i+1}: tanggal tidak valid.')
        day = date.fromisoformat(row['date'])
        if day.isoformat() != row['date']:
            raise ValueError(f'Baris {i+1}: gunakan tanggal ISO.')
        values = {k: row.get(k) for k in KEYS}
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or abs(v) > 1e50 for v in values.values()):
            raise ValueError(f'Baris {i+1}: lima angka berhingga diperlukan.')
        clean.append({'date': day.isoformat(), 'source_excel_row': row.get('source_excel_row', i+1), **values})
    clean.sort(key=lambda r:(r['date'], r['source_excel_row']))
    if clean[-9]['date'] >= clean[-8]['date']:
        raise ValueError('Batas latih/uji memisahkan tanggal yang sama. Unggah rentang dengan batas tanggal kronologis yang jelas.')
    return clean


def benchmark(rows):
    import numpy as np
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import ConstantKernel, RBF, WhiteKernel
    from sklearn.metrics import mean_absolute_error, root_mean_squared_error
    rows = validate_rows(rows)
    cut = len(rows)-8
    x = np.array([(date.fromisoformat(r['date'])-date.fromisoformat(rows[0]['date'])).days/365.25 for r in rows]).reshape(-1, 1)
    output = []
    recorded_warnings = []
    series = {}
    for key in KEYS:
        y = np.array([r[key] for r in rows])
        train, test = y[:cut], y[cut:]
        center, spread = train.mean(), train.std()
        spread = spread if spread > 1e-10 else 1.0
        kernel = ConstantKernel(1, (1e-2, 1e2))*RBF(.5, (.08, 8))+WhiteKernel(.2, (1e-4, 2))
        model = GaussianProcessRegressor(kernel=kernel, alpha=1e-6, normalize_y=False, n_restarts_optimizer=2, random_state=1729)
        with warnings.catch_warnings(record=True) as found:
            warnings.simplefilter('always')
            model.fit(x[:cut], (train-center)/spread)
            recorded_warnings.extend({'sensor': key, 'category': w.category.__name__, 'message': str(w.message)} for w in found)
        mean, deviation = model.predict(x[cut:], return_std=True)
        predicted = center+spread*mean
        series[key] = [{'date': rows[cut+i]['date'], 'source_row': rows[cut+i]['source_excel_row'], 'actual': float(test[i]), 'predicted': float(predicted[i]), 'posterior_sd': float(spread*deviation[i])} for i in range(8)]
        forecasts = {'median': np.repeat(np.median(train), 8), 'last_observation': np.repeat(train[-1], 8), 'gpr': predicted}
        for method, predictions in forecasts.items():
            output.append({'sensor': key, 'method': method, 'train_rows': cut, 'test_rows': 8, 'mae': round(float(mean_absolute_error(test, predictions)), 6), 'rmse': round(float(root_mean_squared_error(test, predictions)), 6)})
    import sklearn
    return {'protocol': 'gpr-chronological-holdout/1.0.0', 'purpose': 'Forecast benchmark; not anomaly accuracy', 'train_rows': cut, 'test_rows': 8, 'train_last_date': rows[cut-1]['date'], 'test_first_date': rows[cut]['date'], 'seed': 1729, 'kernel': 'ConstantKernel(1,[0.01,100])*RBF(0.5,[0.08,8])+WhiteKernel(0.2,[0.0001,2])', 'versions': {'numpy': np.__version__, 'scikit_learn': sklearn.__version__}, 'metrics': output, 'warnings': recorded_warnings, 'series': series}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    args = parser.parse_args()
    result = benchmark(read_source(args.source))
    private = Path('.private')
    private.mkdir(exist_ok=True)
    (private/'forecast-benchmark.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(f"Saved 15 forecast comparisons and {len(result['warnings'])} optimizer warnings to .private/forecast-benchmark.json")
