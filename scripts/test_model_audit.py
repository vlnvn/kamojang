"""Synthetic-only audit checks: no private measurements or invented fault labels."""
import copy
import unittest
from datetime import date, timedelta

from audit_source import KEYS, robust
from model_audit import (agreement, compare, fit_robust, forecast_summary,
                         isolation_holdout, matched_fold, rolling_prefixes, score_robust)


def fixture(n=28):
    import math
    return [{'date': (date(2020, 1, 1)+timedelta(days=i*17)).isoformat(),
             'source_excel_row': i+4,
             **{k: 10+j+math.sin(i*.8+j)*(.1+j*.03) for j, k in enumerate(KEYS)}}
            for i in range(n)]


class ModelAuditTests(unittest.TestCase):
    def test_robust_reference_matches_existing_arithmetic_and_fallbacks(self):
        for values in ([1, 2, 3, 4, 99], [1, 1, 1, 2, 2], [1, 1, 1, 1, 99], [1]*5):
            rows = [{**r, **dict.fromkeys(KEYS, values[i])} for i, r in enumerate(fixture(5))]
            scored = score_robust(fit_robust(rows), rows)
            index = {p['source_row']: p for p in scored}
            for event in robust(rows):
                self.assertAlmostEqual(index[event['source_excel_row']]['scores'][event['sensor']], event['z'])
                self.assertEqual(event['flagged'], event['sensor'] in index[event['source_excel_row']]['flagged_sensors'])

    def test_training_only_robust_does_not_learn_future(self):
        rows = fixture()
        refs = fit_robust(rows[:20])
        original = score_robust(refs, rows[20:])
        changed = copy.deepcopy(rows)
        changed[-1]['pressure_bara'] += 100
        self.assertEqual(refs, fit_robust(changed[:20]))
        self.assertEqual(original[:-1], score_robust(refs, changed[20:])[:-1])
        self.assertNotEqual(original[-1]['scores'], score_robust(refs, changed[20:])[-1]['scores'])

    def test_shared_holdout_does_not_fit_future_isolation(self):
        rows = fixture()
        original = isolation_holdout(rows, 20, trees=50)
        changed = copy.deepcopy(rows)
        changed[-1]['pressure_bara'] += 100
        actual = isolation_holdout(changed, 20, trees=50)
        self.assertEqual(original['offset'], actual['offset'])
        self.assertEqual(original['sensitivity'], actual['sensitivity'])
        self.assertEqual(original['observations'][:-1], actual['observations'][:-1])

    def test_date_boundary_never_splits_same_day(self):
        rows = fixture()
        rows[20]['date'] = rows[19]['date']
        with self.assertRaises(ValueError):
            matched_fold(rows)

    def test_prefix_policy_is_fixed_and_nonoverlapping_in_test_rows(self):
        self.assertEqual(rolling_prefixes(fixture(44)), [28, 36, 44])
        self.assertEqual(rolling_prefixes(fixture(12)), [])
        test_sets = [set(range(n-8, n)) for n in rolling_prefixes(fixture(44))]
        self.assertFalse(any(a & b for i, a in enumerate(test_sets) for b in test_sets[i+1:]))

    def test_agreement_does_not_invent_accuracy_for_empty_sets(self):
        self.assertIsNone(agreement(set(), set())['jaccard'])
        self.assertEqual(agreement({1, 2}, {2, 3}), {'intersection': 1, 'union': 3, 'jaccard': 1/3})

    def test_forecast_summary_keeps_units_ties_and_coverage_separate(self):
        result = {'metrics': [{'sensor': k, 'method': m, 'mae': 1.0, 'rmse': 2.0}
                              for k in KEYS for m in ('median', 'last_observation', 'gpr')],
                  'series': {k: [{'actual': 0, 'predicted': 0, 'posterior_sd': 0},
                                 {'actual': 5, 'predicted': 0, 'posterior_sd': 1}] for k in KEYS}}
        for row in forecast_summary(result):
            self.assertEqual(row['lowest_mae_methods'], ['median', 'last_observation', 'gpr'])
            self.assertEqual(row['gpr_pointwise_95_band_inside'], 1)
            self.assertEqual(row['band_denominator'], 2)
            self.assertNotIn('accuracy', row)

    def test_complete_audit_never_uses_model_output_as_truth(self):
        result = compare(fixture(12), measure=False)
        self.assertEqual(result['anomaly_accuracy']['status'], 'BLOCKED')
        for key in ('precision', 'recall', 'f1', 'false_alarm_rate', 'winner'):
            self.assertIsNone(result['anomaly_accuracy'][key])
        self.assertIsNone(result['recommendation']['universal_winner'])
        self.assertEqual(result['gpr_anomaly_classifier']['status'], 'NOT IMPLEMENTED')
        self.assertNotIn('timing', result)
        fold = result['matched_chronological_folds'][0]
        ids = [p['source_row'] for p in fold['robust_holdout']]
        self.assertEqual(ids, [p['source_row'] for p in fold['isolation_holdout']['observations']])
        self.assertTrue(all(ids == [p['source_row'] for p in s] for s in fold['gpr_series'].values()))


if __name__ == '__main__':
    unittest.main()
