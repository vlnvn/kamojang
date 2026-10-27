"""Independent, read-only local research audit. Never writes source measurements to public paths."""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import statistics as stats
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

KEYS = ['pressure_bara', 'temperature_degC', 'steam_quality_percent', 'ncg_percent_mass', 'tds_ppm']
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_source(path):
    """Read original six-column Sheet1 OOXML without evaluating formulas."""
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            strings = [''.join(node.itertext()) for node in root]
        root = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        table = []
        for row in root.findall('.//s:row', NS):
            number = int(row.attrib['r'])
            cells = {}
            for cell in row:
                if cell.find('s:f', NS) is not None:
                    raise ValueError('Formula not allowed')
                value = cell.find('s:v', NS)
                text = value.text if value is not None else ''
                if cell.attrib.get('t') == 's':
                    text = strings[int(text)]
                elif cell.attrib.get('t') == 'inlineStr':
                    text = ''.join(cell.find('s:is', NS).itertext())
                elif text:
                    text = float(text)
                column = ''.join(c for c in cell.attrib['r'] if c.isalpha())
                cells[column] = text
            table.append((number, [cells.get(c) for c in 'ABCDEF']))
        header = next(values for n, values in table if n == 3)
        assert [str(x).strip() for x in header] == ['Tanggal', 'Pressure (bara)', 'Temperature (deg-C)', 'Steam Quality (%)', 'NCG (%berat)', 'TDS (ppm)']
        rows = []
        for n, values in table:
            if 4 <= n <= 47:
                assert all(isinstance(v, (float, int)) and math.isfinite(v) for v in values), n
                date = (datetime(1899, 12, 30) + timedelta(days=values[0])).date().isoformat()
                rows.append({'source_excel_row': n, 'date': date, **dict(zip(KEYS, values[1:]))})
        return sorted(rows, key=lambda r: (r['date'], r['source_excel_row']))


def percentile(values, p):
    values = sorted(values)
    index = (len(values) - 1) * p
    low, high = math.floor(index), math.ceil(index)
    return values[low] + (values[high] - values[low]) * (index - low)


def robust(rows, threshold=3.5):
    if len(rows) < 3 or not math.isfinite(threshold) or not 1 <= threshold <= 10:
        raise ValueError('Invalid sample count or threshold')
    result = []
    for key in KEYS:
        values = [row[key] for row in rows]
        if not all(math.isfinite(v) for v in values):
            raise ValueError('Nonfinite value')
        median = stats.median(values)
        scale = 1.4826022185 * stats.median(abs(v-median) for v in values)
        if scale <= 1e-12:
            scale = (percentile(values, .75)-percentile(values, .25))/1.349
        if scale <= 1e-12:
            scale = stats.stdev(values)
        for row in rows:
            z = (row[key]-median)/scale if scale > 1e-12 else 0
            result.append({'source_excel_row': row['source_excel_row'], 'date': row['date'], 'sensor': key, 'actual': row[key], 'z': z, 'flagged': abs(z) > threshold})
    return result


def audit(source, archive):
    rows = read_source(source)
    assert len(rows) == 44
    assert len({r['date'] for r in rows}) == 43
    assert rows[0]['date'] == '2022-01-05' and rows[-1]['date'] == '2025-07-11'
    assert sorted(r['source_excel_row'] for r in rows) == list(range(4, 48))
    assert sum(r['steam_quality_percent'] > 100 for r in rows) == 19
    assert len([r for r in rows if r['date'] == '2025-02-13']) == 2
    counts = {t: sum(e['flagged'] for e in robust(rows, t)) for t in [3, 3.5, 4]}
    assert counts == {3: 9, 3.5: 7, 4: 6}, counts
    with zipfile.ZipFile(archive) as z:
        source_hash = hashlib.sha256(Path(source).read_bytes()).hexdigest()
        assert source_hash == hashlib.sha256(z.read(Path(source).name)).hexdigest()
        saved = list(csv.DictReader(io.StringIO(z.read('kamojang_clean_rows.csv').decode('utf-8'))))
        assert len(saved) == len(rows)
        for original, cached in zip(rows, saved):
            assert original['source_excel_row'] == int(cached['source_excel_row'])
            assert original['date'] == cached['date']
            for key in KEYS:
                assert math.isclose(original[key], float(cached[key]), abs_tol=1e-12)
        cached_events = list(csv.DictReader(io.StringIO(z.read('kamojang_anomaly_screen.csv').decode('utf-8'))))
        index = {(int(e['source_excel_row']), e['sensor']): e for e in cached_events}
        for event in robust(rows):
            cached = index[(event['source_excel_row'], event['sensor'])]
            assert event['flagged'] == (cached['candidate_anomaly'] == 'True')
            assert math.isclose(event['z'], float(cached['signed_robust_z']), abs_tol=0.0000051)
    summary = {'source_sha256': source_hash, 'rows': len(rows), 'unique_dates': 43, 'row_value_parity': 'PASS: all 220 values', 'assessment_parity': 'PASS: all 220 scores and flags', 'threshold_counts': counts}
    print(json.dumps(summary, indent=2))
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--archive', required=True)
    args = parser.parse_args()
    audit(args.source, args.archive)
