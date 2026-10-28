import copy
import unittest
from isolation import experiment, prepare_request
from test_research import synthetic


class IsolationTests(unittest.TestCase):
    def test_determinism_and_manual_cannot_train(self):
        request = {'rows': synthetic(), 'contamination': .1, 'n_estimators': 50}
        first = experiment(request)
        manual = {k: first['reference']['observations'][0]['values'][k] for k in first['features']}
        second = experiment({**request, 'manual': manual})
        self.assertEqual(first['reference'], second['reference'])
        self.assertEqual(first['holdout'], second['holdout'])
        self.assertEqual(second['manual']['score'], first['reference']['observations'][0]['score'])
        self.assertEqual(first['holdout']['train_rows'], 9)
        self.assertEqual(first['holdout']['test_rows'], 3)
        self.assertTrue(all(p['flagged'] == (p['score'] < 0) for p in first['reference']['observations']))

    def test_holdout_does_not_fit_future_values(self):
        request = {'rows': synthetic(), 'n_estimators': 50}
        baseline = experiment(request)
        changed = copy.deepcopy(request)
        for r in changed['rows'][-3:]:
            r['pressure_bara'] += 20
        actual = experiment(changed)
        self.assertEqual(baseline['holdout']['offset'], actual['holdout']['offset'])
        self.assertEqual(baseline['holdout']['train_last_date'], actual['holdout']['train_last_date'])
        # Unchanged test input must retain its score when other test inputs change.
        changed['rows'][-1] = request['rows'][-1]
        self.assertEqual(baseline['holdout']['observations'][-1]['score'], experiment(changed)['holdout']['observations'][-1]['score'])

    def test_sensitivity_matches_independent_sklearn_fits(self):
        import numpy as np
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
        from audit_source import KEYS
        rows = synthetic()
        actual = experiment({'rows': rows, 'n_estimators': 50})
        x = StandardScaler().fit_transform([[r[k] for k in KEYS] for r in rows])
        for s in actual['sensitivity']:
            estimator = IsolationForest(n_estimators=50, contamination=s['contamination'], random_state=42).fit(x)
            self.assertEqual(int(np.sum(estimator.predict(x) == -1)), s['flagged'])
            self.assertAlmostEqual(float(estimator.offset_), s['offset'])

    def test_constant_ties_are_not_forced_to_quota(self):
        from audit_source import KEYS
        rows = [{**r, **dict.fromkeys(KEYS, 1.0)} for r in synthetic()]
        result = experiment({'rows': rows, 'n_estimators': 50, 'contamination': .3})
        self.assertFalse(any(p['flagged'] for p in result['reference']['observations']))

    def test_invalid_configuration_identity_and_split(self):
        bad = [{'contamination': True}, {'contamination': 10**1000}, {'n_estimators': 51},
               {'manual': {}}, {'manual': {'pressure_bara': float('inf')}}]
        for change in bad:
            with self.assertRaises(ValueError):
                prepare_request({'rows': synthetic(), **change})
        for value in ['1', True, -1, 10**1000]:
            rows = synthetic(); rows[0]['source_excel_row'] = value
            with self.assertRaises(ValueError): prepare_request({'rows': rows})
        rows = synthetic(); rows[9]['date'] = rows[8]['date']
        with self.assertRaises(ValueError): prepare_request({'rows': rows})

        rows = synthetic(); rows[0]['source_excel_row'] = rows[1]['source_excel_row']
        with self.assertRaises(ValueError): prepare_request({'rows': rows})

    def test_manual_unrepresentable_range_is_rejected_not_clipped(self):
        from audit_source import KEYS
        with self.assertRaisesRegex(ValueError, 'representasi'):
            experiment({'rows': synthetic(), 'n_estimators': 50, 'manual': dict.fromkeys(KEYS, 1e50)})


if __name__ == '__main__':
    unittest.main()
