import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  dateLabel,
  format,
  parameters,
  quantile,
  sensors,
  type Dataset,
  type Sensor,
} from "./domain";
import {
  isolationCSV,
  validateIsolation,
  type IsolationResult,
} from "./isolation";

type Pending = { id: string; controller: AbortController };
function cancelPending(ref: MutableRefObject<Pending | null>) {
  const pending = ref.current;
  if (!pending) return;
  ref.current = null;
  pending.controller.abort();
  void fetch("/api/research/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: pending.id }),
    keepalive: true,
  }).catch(() => {});
}
function initialManual(dataset: Dataset | null) {
  return Object.fromEntries(
    sensors.map((s) => [
      s,
      dataset?.rows.length
        ? String(
            quantile(
              dataset.rows.map((r) => r.values[s]),
              0.5,
            ),
          )
        : "",
    ]),
  ) as Record<Sensor, string>;
}
function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ObservationTable({
  points,
  caption,
}: {
  points: IsolationResult["reference"]["observations"];
  caption: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Baris sumber</th>
            <th>Skor keputusan</th>
            <th>Hasil model</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.source_row}>
              <td>{dateLabel(p.date)}</td>
              <td>{p.source_row}</td>
              <td>{format(p.score, 8)}</td>
              <td>{p.flagged ? "Ditandai" : "Tidak ditandai"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function IsolationPanel({
  dataset,
  visible,
}: {
  dataset: Dataset | null;
  visible: boolean;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const pending = useRef<Pending | null>(null);
  const [contamination, setContamination] = useState(0.05);
  const [trees, setTrees] = useState(100);
  const [manualEnabled, setManualEnabled] = useState(false);
  const [manual, setManual] = useState(() => initialManual(dataset));
  const [result, setResult] = useState<{
    key: string;
    value: IsolationResult;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
  const key = JSON.stringify([
    dataset?.hash,
    contamination,
    trees,
    manualEnabled,
    manual,
  ]);
  const current = result?.key === key ? result.value : null;
  useEffect(() => {
    if (visible) {
      title.current?.focus({ preventScroll: true });
      title.current?.scrollIntoView({ block: "start" });
    }
  }, [visible]);
  useEffect(() => {
    setManual(initialManual(dataset));
  }, [dataset]);
  useEffect(() => {
    cancelPending(pending);
    setRunning(false);
    setError("");
    setNotice("");
    setResult(null);
    return () => cancelPending(pending);
  }, [key]);
  const run = async () => {
    if (!dataset || !local) return;
    const candidate = manualEnabled
      ? (Object.fromEntries(
          sensors.map((s) => [s, Number(manual[s])]),
        ) as Record<Sensor, number>)
      : null;
    if (
      candidate &&
      sensors.some(
        (s) =>
          manual[s].trim() === "" ||
          !Number.isFinite(candidate[s]) ||
          Math.abs(candidate[s]) > 1e50,
      )
    ) {
      setError(
        "Isi lima angka berhingga dalam batas komputasi (maksimum absolut 1e50).",
      );
      return;
    }
    cancelPending(pending);
    const id = crypto.randomUUID(),
      controller = new AbortController();
    pending.current = { id, controller };
    setRunning(true);
    setResult(null);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/research/isolation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          request_id: id,
          source_hash: dataset.hash,
          contamination,
          n_estimators: trees,
          manual: candidate,
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
      const value = validateIsolation(
        await response.json(),
        dataset,
        id,
        { contamination, n_estimators: trees },
        candidate,
      );
      if (pending.current?.id === id) setResult({ key, value });
    } catch (e) {
      if (!controller.signal.aborted && pending.current?.id === id)
        setError(
          e instanceof TypeError
            ? "Layanan lokal tidak dapat dihubungi. Periksa proses riset lalu coba lagi."
            : e instanceof Error
              ? e.message
              : "Eksperimen gagal.",
        );
    } finally {
      if (pending.current?.id === id) {
        pending.current = null;
        setRunning(false);
      }
    }
  };
  return (
    <section
      className="panel isolation-panel"
      hidden={!visible}
      aria-labelledby="isolation-title"
    >
      <h2 id="isolation-title" ref={title} tabIndex={-1}>
        Eksperimen Isolation Forest
      </h2>
      <p>
        Periksa kombinasi lima sensor dalam satu model. Hasil ini terpisah dari
        acuan median/MAD dan prediksi GPR.
      </p>
      <p className="muted">
        Referensi dilatih ulang hanya saat Anda menjalankan eksperimen. Skor
        negatif ditandai oleh model; skor bukan probabilitas kerusakan. Input
        manual tidak ditambahkan ke dataset.
      </p>
      <p>
        <a
          href="https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/icdm08b.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Liu, Ting dan Zhou (2008)
        </a>
        {" · "}
        <a
          href="https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html"
          target="_blank"
          rel="noreferrer"
        >
          Kontrak estimator scikit-learn
        </a>
      </p>
      <p>
        {dataset?.synthetic
          ? "Referensi: contoh sintetis, bukan data Kamojang."
          : dataset
            ? "Referensi: data unggahan lokal."
            : "Impor data atau gunakan contoh sintetis untuk melanjutkan."}
      </p>
      {!local && (
        <p role="alert">
          Eksperimen hanya tersedia pada localhost dengan layanan riset lokal.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <fieldset disabled={running}>
          <legend>Konfigurasi model</legend>
          <div className="isolation-inputs">
            <label>
              Contamination
              <input
                aria-describedby="contamination-help"
                type="number"
                min="0.01"
                max="0.30"
                step="0.01"
                required
                value={contamination}
                onChange={(e) => setContamination(Number(e.target.value))}
              />
            </label>
            <label>
              Jumlah pohon
              <select
                aria-label="Jumlah pohon"
                value={trees}
                onChange={(e) => setTrees(Number(e.target.value))}
              >
                {[50, 100, 200, 300].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p id="contamination-help">
            Rentang 0,01–0,30 mengatur ambang dari skor referensi; bukan tingkat
            akurasi atau fraksi kerusakan yang diketahui. Nilai skor yang sama
            dapat menghasilkan jumlah flag berbeda dari kuota ini.
          </p>
        </fieldset>
        <fieldset disabled={running}>
          <legend>Satu pengukuran manual</legend>
          <label className="isolation-toggle">
            <input
              type="checkbox"
              checked={manualEnabled}
              onChange={(e) => setManualEnabled(e.target.checked)}
            />
            Uji pengukuran manual
          </label>
          <p>
            Nilai awal adalah median tiap parameter, bukan pembacaan sensor
            baru. Pemeriksaan manual menggunakan model seluruh referensi dan
            tidak memengaruhi pelatihannya.
          </p>
          <div className="isolation-inputs">
            {sensors.map((s) => (
              <label key={s}>
                {parameters[s].label} ({parameters[s].unit})
                <input
                  type="number"
                  step="any"
                  required
                  disabled={!manualEnabled}
                  value={manual[s]}
                  onChange={(e) =>
                    setManual((v) => ({ ...v, [s]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
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
          >
            Jalankan Isolation Forest
          </button>
          {running && (
            <button
              type="button"
              onClick={() => {
                cancelPending(pending);
                setRunning(false);
                setNotice("Eksperimen dibatalkan. Data referensi tetap utuh.");
              }}
            >
              Batalkan eksperimen
            </button>
          )}
        </div>
      </form>
      <p className="muted">
        Memerlukan 12–256 observasi. Perhitungan melalui layanan Python pada
        perangkat ini, maksimum 60 detik. Tidak ada penyimpanan model atau
        pengiriman ke cloud.
      </p>
      {running && (
        <p role="status">
          Melatih model referensi dan holdout, lalu menghitung skor…
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {current && (
        <>
          <p role="status">
            Eksperimen selesai: {current.reference.fit_rows} referensi; holdout{" "}
            {current.holdout.train_rows} latih / {current.holdout.test_rows}{" "}
            uji.
          </p>
          <p>
            Model seluruh referensi menandai{" "}
            {current.reference.observations.filter((p) => p.flagged).length}{" "}
            observasi pada data pelatihannya. Model holdout menandai{" "}
            {current.holdout.observations.filter((p) => p.flagged).length}{" "}
            observasi uji. Kedua jumlah ini bukan ukuran akurasi.
          </p>
          <p>
            Holdout memakai 20% observasi terakhir (dibulatkan ke atas).
            StandardScaler, forest, dan ambang holdout dipasang hanya pada data
            latih: {dateLabel(current.holdout.train_last_date)} →{" "}
            {dateLabel(current.holdout.test_first_date)}.
          </p>
          <p className="muted">
            Seed {current.seed}; NumPy {current.versions.numpy}; scikit-learn{" "}
            {current.versions.scikit_learn}. Skor keputusan = skor sampel −
            offset; keputusan menggunakan nilai penuh sebelum pembulatan
            tampilan.
          </p>
          {current.manual && (
            <div className="isolation-manual-result">
              <h3>Hasil input manual</h3>
              <p>
                {current.manual.flagged ? "Ditandai" : "Tidak ditandai"} · skor{" "}
                {format(current.manual.score, 8)} terhadap model seluruh
                referensi.
              </p>
            </div>
          )}
          <ObservationTable
            caption="Pemeriksaan referensi (in-sample)"
            points={current.reference.observations}
          />
          <ObservationTable
            caption="Pemeriksaan holdout kronologis (di luar pelatihan)"
            points={current.holdout.observations}
          />
          <div className="table-scroll">
            <table>
              <caption>
                Sensitivitas ambang pada forest referensi yang sama
              </caption>
              <thead>
                <tr>
                  <th>Contamination</th>
                  <th>Offset</th>
                  <th>Observasi ditandai</th>
                </tr>
              </thead>
              <tbody>
                {current.sensitivity.map((s) => (
                  <tr key={s.contamination}>
                    <td>{format(s.contamination, 2)}</td>
                    <td>{format(s.offset, 8)}</td>
                    <td>{s.flagged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Tanpa label insiden terverifikasi, precision, recall, F1 dan tingkat
            false alarm operasional tidak dapat dihitung. Holdout kecil ini
            memeriksa pemisahan waktu; belum membuktikan kemampuan diagnosis
            atau generalisasi.
          </p>
          <p>
            Ekspor memuat nilai referensi, hash sumber, scope model, konfigurasi
            dan input manual jika digunakan. Lindungi seperti sumber aslinya.
          </p>
          <div className="export-actions">
            <button
              onClick={() =>
                save(
                  "eksperimen-isolation.csv",
                  isolationCSV(current),
                  "text/csv;charset=utf-8",
                )
              }
            >
              Unduh CSV eksperimen
            </button>
            <button
              onClick={() =>
                save(
                  "eksperimen-isolation.json",
                  JSON.stringify(current, null, 2),
                  "application/json",
                )
              }
            >
              Unduh JSON eksperimen
            </button>
          </div>
        </>
      )}
    </section>
  );
}
