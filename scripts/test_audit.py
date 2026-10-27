import math
import unittest
from audit_source import KEYS, percentile, robust


def rows(values):
    return [dict(source_excel_row=i+2, date='2024-01-01', **{k: x for k in KEYS}) for i, x in enumerate(values)]


class AuditTests(unittest.TestCase):
    def test_linear_quantile(self):
        self.assertEqual(percentile([1, 2, 3, 4], .25), 1.75)

    def test_constant(self):
        self.assertTrue(all(e['z'] == 0 and not e['flagged'] for e in robust(rows([2, 2, 2]))))

    def test_fallback_and_determinism(self):
        data = rows([1]*9+[100])
        self.assertEqual(robust(data), robust(data))
        self.assertTrue(all(math.isfinite(e['z']) for e in robust(data)))

    def test_reject_nonfinite(self):
        with self.assertRaises(ValueError):
            robust(rows([1, 2, math.nan]))

    def test_small_sample(self):
        with self.assertRaises(ValueError):
            robust(rows([1, 2]))

    def test_strict_threshold(self):
        self.assertEqual(sum(e['flagged'] for e in robust(rows([0, 1, 2, 3, 100]))), 5)


if __name__ == '__main__':
    unittest.main()
