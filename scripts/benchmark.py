"""Optional local-only chronological forecast experiment, separate from application scoring."""
import argparse
import json
import warnings
from datetime import date
from pathlib import Path
from audit_source import KEYS, read_source


def benchmark(rows):
    import numpy as np
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import ConstantKernel, RBF, WhiteKernel
    from sklearn.metrics import mean_absolute_error, root_mean_squared_error
    if len(rows) < 12:
        raise ValueError('At least 12 chronological rows required')
    cut = len(rows)-8
    x = np.array([(date.fromisoformat(r['date'])-date.fromisoformat(rows[0]['date'])).days/365.25 for r in rows]).reshape(-1, 1)
    output = []
    recorded_warnings = []
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
        forecasts = {'median': np.repeat(np.median(train), 8), 'last_observation': np.repeat(train[-1], 8), 'gpr': center+spread*model.predict(x[cut:])}
        for method, predictions in forecasts.items():
            output.append({'sensor': key, 'method': method, 'train_rows': cut, 'test_rows': 8, 'mae': round(float(mean_absolute_error(test, predictions)), 6), 'rmse': round(float(root_mean_squared_error(test, predictions)), 6)})
    return {'purpose': 'Forecast benchmark; not anomaly accuracy', 'metrics': output, 'warnings': recorded_warnings}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    args = parser.parse_args()
    result = benchmark(read_source(args.source))
    private = Path('.private')
    private.mkdir(exist_ok=True)
    (private/'forecast-benchmark.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(f"Saved 15 forecast comparisons and {len(result['warnings'])} optimizer warnings to .private/forecast-benchmark.json")
