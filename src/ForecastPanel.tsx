import { useEffect, useRef, useState } from "react";
import {
  dateLabel,
  format,
  parameters,
  sensors,
  type Dataset,
  type Sensor,
} from "./domain";
type Metric = {
  sensor: Sensor;
  method: "median" | "last_observation" | "gpr";
  train_rows: number;
  test_rows: number;
  mae: number;
  rmse: number;
};
type Point = {
  date: string;
  source_row: number;
  actual: number;
  predicted: number;
  posterior_sd: number;
};
type Result = {
  protocol: string;
  source_hash: string;
  request_id: string;
  train_rows: number;
  test_rows: number;
  train_last_date: string;
  test_first_date: string;
  seed: number;
  versions: { numpy: string; scikit_learn: string };
  metrics: Metric[];
  warnings: { sensor: Sensor; category: string; message: string }[];
  series: Record<Sensor, Point[]>;
};
function validateResult(value: unknown, hash: string): Result {
  const r = value as Result;
  if (
    !r ||
    r.protocol !== "gpr-chronological-holdout/1.0.0" ||
    r.source_hash !== hash ||
    r.test_rows !== 8 ||
    !Array.isArray(r.metrics) ||
    r.metrics.length !== 15 ||
    !Array.isArray(r.warnings)
  )
    throw Error("Respons riset tidak sesuai kontrak.");
  for (const m of r.metrics)
    if (
      !sensors.includes(m.sensor) ||
      !["median", "last_observation", "gpr"].includes(m.method) ||
      ![m.mae, m.rmse].every((n) => Number.isFinite(n) && n >= 0)
    )
      throw Error("Metrik prediksi tidak valid.");
  for (const s of sensors)
    if (
      !Array.isArray(r.series?.[s]) ||
      r.series[s].length !== 8 ||
      r.series[s].some(
        (p) => ![p.actual, p.predicted, p.posterior_sd].every(Number.isFinite),
      )
    )
      throw Error("Deret prediksi tidak valid.");
  return r;
}
export default function ForecastPanel({
  dataset,
  visible,
}: {
  dataset: Dataset | null;
  visible: boolean;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [sensor, setSensor] = useState<Sensor>("pressure_bara");
  const request = useRef<{ controller: AbortController; id: string } | null>(
    null,
  );
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
  const cancel = () => {
    const pending = request.current;
    if (pending) {
      request.current = null;
      pending.controller.abort();
      void fetch("/api/research/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: pending.id }),
      }).catch(() => {});
    }
    setRunning(false);
  };
  useEffect(() => {
    setResult(null);
    setError("");
    const pending = request.current;
    request.current = null;
    pending?.controller.abort();
    if (pending)
      void fetch("/api/research/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: pending.id }),
      }).catch(() => {});
    setRunning(false);
    return () => {
      request.current?.controller.abort();
    };
  }, [dataset]);
  const run = async () => {
    if (!dataset || !local) return;
    cancel();
    const controller = new AbortController();
    const id = crypto.randomUUID();
    request.current = { controller, id };
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/research/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          request_id: id,
          source_hash: dataset.hash,
          rows: dataset.rows.map((r) => ({
            source_excel_row: r.source_row,
            date: r.date,
            ...r.values,
          })),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw Error(
          body?.error ??
            "Layanan riset tidak aktif. Jalankan npm run dev:research atau npm run preview:research.",
        );
      }
      const value = validateResult(await response.json(), dataset.hash);
      if (request.current?.id === id) setResult(value);
    } catch (e) {
      if (!controller.signal.aborted && request.current?.id === id)
        setError(e instanceof Error ? e.message : "Benchmark gagal.");
    } finally {
      if (request.current?.id === id) {
        request.current = null;
        setRunning(false);
      }
    }
  };
  return (
    <section
      className="panel forecast-panel"
      hidden={!visible}
      aria-labelledby="forecast-title"
    >
      <h2 id="forecast-title">Evaluasi prediksi GPR</h2>
      <p>
        Uji delapan observasi terakhir terhadap prediksi GPR, median latih, dan
        nilai latih terakhir.{" "}
        {dataset
          ? `${dataset.rows.length - 8} observasi pertama digunakan untuk pelatihan.`
          : ""}{" "}
        Ini evaluasi prediksi retrospektif pada data uji, bukan deteksi
        kerusakan.
      </p>
      <p className="muted">
        Kernel RBF + white noise, optimasi hyperparameter pada data latih, seed
        1729. Perhitungan hanya di layanan Python pada perangkat ini; tidak
        disimpan atau dikirim ke cloud.
      </p>
      {!local && (
        <p role="alert">
          GPR hanya diaktifkan pada localhost. Jalankan aplikasi beserta layanan
          riset secara lokal.
        </p>
      )}
      <div className="export-actions">
        <button
          className="primary"
          disabled={
            !local ||
            !dataset ||
            dataset.rows.length < 12 ||
            dataset.rows.length > 256 ||
            running
          }
          onClick={() => void run()}
        >
          Jalankan benchmark GPR
        </button>
        {running && <button onClick={cancel}>Batalkan benchmark</button>}
      </div>
      {dataset && (dataset.rows.length < 12 || dataset.rows.length > 256) && (
        <p role="status">
          GPR memerlukan 12–256 pembacaan agar evaluasi dan biaya komputasi
          tetap dibatasi.
        </p>
      )}
      {running && (
        <p role="status">
          Melatih lima model dan menghitung galat pada data uji…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <p role="status">
            Benchmark selesai: {result.train_rows} latih dan {result.test_rows}{" "}
            uji. Batas waktu: {dateLabel(result.train_last_date)} →{" "}
            {dateLabel(result.test_first_date)}.
          </p>
          <p className="muted">
            NumPy {result.versions.numpy}; scikit-learn{" "}
            {result.versions.scikit_learn}. MAE dan RMSE memakai satuan asli
            setiap parameter; nilai lebih kecil berarti galat prediksi lebih
            kecil pada split ini.
          </p>
          <div className="table-scroll">
            <table>
              <caption>
                Perbandingan prediksi pada delapan observasi uji
              </caption>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Model</th>
                  <th>MAE</th>
                  <th>RMSE</th>
                </tr>
              </thead>
              <tbody>
                {result.metrics.map((m) => (
                  <tr key={m.sensor + m.method}>
                    <th>
                      {parameters[m.sensor].label} ({parameters[m.sensor].unit})
                    </th>
                    <td>
                      {
                        {
                          gpr: "GPR",
                          median: "Median latih",
                          last_observation: "Nilai latih terakhir",
                        }[m.method]
                      }
                    </td>
                    <td>{format(m.mae, 6)}</td>
                    <td>{format(m.rmse, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="forecast-sensor">
            Rincian prediksi
            <select
              value={sensor}
              onChange={(e) => setSensor(e.target.value as Sensor)}
            >
              {sensors.map((s) => (
                <option key={s} value={s}>
                  {parameters[s].label}
                </option>
              ))}
            </select>
          </label>
          <div className="table-scroll">
            <table>
              <caption>
                Nilai aktual dan prediksi GPR ({parameters[sensor].unit})
              </caption>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Baris sumber</th>
                  <th>Aktual</th>
                  <th>Prediksi</th>
                  <th>Simpangan posterior</th>
                </tr>
              </thead>
              <tbody>
                {result.series[sensor].map((p, i) => (
                  <tr key={i}>
                    <td>{dateLabel(p.date)}</td>
                    <td>{p.source_row}</td>
                    <td>{format(p.actual, 6)}</td>
                    <td>{format(p.predicted, 6)}</td>
                    <td>{format(p.posterior_sd, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Ketidakpastian posterior belum dikalibrasi terhadap kejadian
            operasional. Satu split tidak membuktikan model terbaik secara umum;
            tidak tersedia label kegagalan untuk precision, recall, atau F1.
          </p>
          {result.warnings.length > 0 && (
            <details>
              <summary>{result.warnings.length} peringatan optimizer</summary>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    {parameters[w.sensor].label}: {w.category} — {w.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
