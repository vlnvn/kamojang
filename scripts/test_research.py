import unittest
from benchmark import benchmark, validate_rows


def synthetic():
    import math
    return [{'date': f'2024-{i+1:02}-01', 'source_excel_row': i+2, 'pressure_bara': 7+math.sin(i)*.1, 'temperature_degC': 170+math.cos(i), 'steam_quality_percent': 99.5+math.sin(i)*.2, 'ncg_percent_mass': .3+math.cos(i)*.02, 'tds_ppm': 1+math.sin(i)*.3} for i in range(12)]


class ResearchTests(unittest.TestCase):
    def test_contract(self):
        result = benchmark(synthetic())
        self.assertEqual(len(result['metrics']), 15)
        self.assertEqual(result['train_rows'], 4)
        self.assertEqual(result['test_rows'], 8)
        self.assertEqual(result['seed'], 1729)
        self.assertTrue(all(len(p) == 8 for p in result['series'].values()))

    def test_invalid_bounds_and_dates(self):
        for data in [[], synthetic()*22, [{**r, 'date': '2024-02-30'} for r in synthetic()], [{**r, 'pressure_bara': True} for r in synthetic()]]:
            with self.assertRaises(ValueError):
                validate_rows(data)

    def test_no_future_leakage(self):
        rows = synthetic()
        original = benchmark(rows)
        for row in rows[-8:]:
            row['pressure_bara'] += 50
        changed = benchmark(rows)
        self.assertEqual([p['predicted'] for p in original['series']['pressure_bara']], [p['predicted'] for p in changed['series']['pressure_bara']])

    def test_duplicate_boundary_rejected(self):
        rows = synthetic(); rows[4]['date'] = rows[3]['date']
        with self.assertRaises(ValueError):
            validate_rows(rows)


if __name__ == '__main__':
    unittest.main()
