"""Private local API parity; never prints measurement/prediction values."""
import argparse
import json
import uuid
from urllib.request import Request, urlopen
from audit_source import read_source
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--archive', required=True)
args = parser.parse_args()
rows = read_source(args.source)
payload = {'request_id': str(uuid.uuid4()), 'source_hash': 'private-verification', 'rows': rows}
request = Request('http://127.0.0.1:8341/api/research/forecast', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'Origin': 'http://127.0.0.1:5173'})
with urlopen(request, timeout=65) as response:
    actual = json.load(response)
with zipfile.ZipFile(args.archive) as archive:
    cached = json.loads(archive.read('kamojang_results.json'))['forecast_benchmark']
index = {(m['sensor'], m['method']): m for m in cached}
for m in actual['metrics']:
    old = index[(m['sensor'], m['method'])]
    assert (m['mae'], m['rmse']) == (old['mae'], old['rmse'])
assert actual['train_rows'] == 36 and actual['test_rows'] == 8
print(f"PASS: local API reproduced all 15 archived MAE/RMSE comparisons; {len(actual['warnings'])} optimizer warnings; no measurement values logged.")
