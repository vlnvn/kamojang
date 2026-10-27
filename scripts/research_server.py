"""Loopback-only, memory-only research endpoint. No measurement logging/storage."""
import argparse
import json
import re
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8341
MAX_BODY = 256 * 1024
JOBS = {}
CANCELLED = set()
LOCK = threading.Lock()
CAPACITY = threading.BoundedSemaphore(1)
ROOT = Path(__file__).resolve().parents[1]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log request paths/bodies or source values.

    def reply(self, code, payload):
        encoded = json.dumps(payload, allow_nan=False).encode('utf-8')
        try:
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(encoded)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(encoded)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def trusted(self):
        hosts = {f'127.0.0.1:{PORT}', f'localhost:{PORT}'}
        origins = {f'http://127.0.0.1:{PORT}', f'http://localhost:{PORT}', 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'}
        return self.headers.get('Host') in hosts and self.headers.get('Origin') in origins

    def do_GET(self):
        if self.path == '/api/research/health' and self.headers.get('Host') in {f'127.0.0.1:{PORT}', f'localhost:{PORT}'}:
            self.reply(200, {'service': 'local-gpr', 'protocol': 'gpr-chronological-holdout/1.0.0'})
        else:
            self.reply(404, {'error': 'Rute tidak tersedia.'})

    def do_POST(self):
        if not self.trusted():
            self.reply(403, {'error': 'Hanya origin aplikasi lokal yang diizinkan.'}); return
        if self.headers.get('Content-Type') != 'application/json':
            self.reply(415, {'error': 'Gunakan JSON.'}); return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY:
                self.reply(413, {'error': 'Permintaan melebihi batas 256 KiB.'}); return
            self.connection.settimeout(10)
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('Objek JSON diperlukan.')
            request_id = data.get('request_id', '')
            if not isinstance(request_id, str) or not re.fullmatch(r'[a-f0-9-]{36}', request_id):
                raise ValueError('Identitas permintaan tidak valid.')
            if self.path == '/api/research/cancel':
                with LOCK:
                    process = JOBS.get(request_id)
                    if process and process.poll() is None:
                        process.kill()
                    if len(CANCELLED) > 100:
                        CANCELLED.clear()
                    CANCELLED.add(request_id)
                self.reply(200, {'cancelled': True}); return
            if self.path != '/api/research/forecast':
                self.reply(404, {'error': 'Rute tidak tersedia.'}); return
            from benchmark import validate_rows
            rows = validate_rows(data.get('rows'))
            source_hash = data.get('source_hash')
            if not isinstance(source_hash, str) or len(source_hash) > 128:
                raise ValueError('Hash sumber tidak valid.')
        except (ValueError, TypeError, json.JSONDecodeError, TimeoutError):
            self.reply(400, {'error': 'Data GPR tidak valid: 12–256 baris lengkap, angka berhingga, tanggal ISO dan batas latih/uji berbeda tanggal diperlukan.'}); return
        if not CAPACITY.acquire(blocking=False):
            self.reply(429, {'error': 'Satu benchmark sedang berjalan. Tunggu atau batalkan proses sebelumnya.'}); return
        process = None
        try:
            with LOCK:
                if request_id in CANCELLED:
                    self.reply(409, {'error': 'Benchmark dibatalkan.'}); return
                process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--compute'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=ROOT)
                JOBS[request_id] = process
            output, _ = process.communicate(json.dumps(rows).encode(), timeout=60)
            if process.returncode != 0:
                self.reply(422, {'error': 'Benchmark dihentikan atau dependensi NumPy/scikit-learn belum tersedia. Periksa instalasi riset lokal.'}); return
            result = json.loads(output)
            result.update(source_hash=source_hash, request_id=request_id)
            self.reply(200, result)
        except subprocess.TimeoutExpired:
            process.kill(); process.communicate()
            self.reply(504, {'error': 'Benchmark melewati batas 60 detik. Kurangi jumlah pengukuran.'})
        except (OSError, ValueError):
            self.reply(503, {'error': 'Pemroses riset lokal tidak tersedia.'})
        finally:
            with LOCK:
                JOBS.pop(request_id, None); CANCELLED.discard(request_id)
            CAPACITY.release()


if __name__ == '__main__':
    if '--compute' in sys.argv:
        from benchmark import benchmark
        result = benchmark(json.load(sys.stdin))
        print(json.dumps(result, allow_nan=False))
    else:
        parser = argparse.ArgumentParser()
        parser.add_argument('--port', type=int, default=8341)
        args = parser.parse_args()
        PORT = args.port
        server = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
        server.daemon_threads = True
        print(f'Local research service: http://127.0.0.1:{PORT}; no input persistence', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()
