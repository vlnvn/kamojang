import {
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import {
  canonicalHeaders,
  dateLabel,
  exportCSV,
  format,
  parameters,
  quality,
  screen,
  sensors,
  VERSION,
  type Dataset,
  type Sensor,
} from "./domain";
import { demo } from "./demo";
import { Chart } from "./Chart";
import ForecastPanel from "./ForecastPanel";
import ViewerBoundary from "./ViewerBoundary";

const TurbineViewer = lazy(() => import("./TurbineViewer"));

type Page = "ringkasan" | "analisis" | "metode" | "turbin";
type Modal = "quality" | "source" | "robust" | "model" | null;
function readView() {
  const [path, search] = location.hash.slice(1)
    ? location.hash.slice(1).split("?")
    : ["/ringkasan", ""];
  const p = new URLSearchParams(search);
  const page = (
    ["ringkasan", "analisis", "metode", "turbin"].includes(path.slice(1))
      ? path.slice(1)
      : "ringkasan"
  ) as Page;
  const sensor = sensors.includes(p.get("sensor") as Sensor)
    ? (p.get("sensor") as Sensor)
    : "pressure_bara";
  const threshold = [3, 3.5, 4].includes(Number(p.get("z")))
    ? Number(p.get("z"))
    : 3.5;
  return { page, sensor, threshold };
}
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Icon({ name, size = 19 }: { name: string; size?: number }) {
  return (
    <img
      className="icon"
      src={`/icons/${name}.svg`}
      width={size}
      height={size}
      alt=""
    />
  );
}
function ModalDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const targets = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
          ),
        );
        const first = targets[0],
          last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <p className="eyebrow">Pemeriksaan sumber dan metode</p>
      <h2 id="dialog-title">{title}</h2>
      <div className="dialog-content">{children}</div>
      <form method="dialog">
        <button type="button" className="primary" autoFocus onClick={onClose}>
          Tutup
        </button>
      </form>
    </dialog>
  );
}
export default function App() {
  const [view, setView] = useState(readView);
  const [dataset, setDataset] = useState<Dataset | null>(demo);
  const [modal, setModal] = useState<Modal>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [selection, setSelection] = useState<Partial<Record<Sensor, string>>>(
    {},
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const worker = useRef<Worker | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const changed = () => setView(readView());
    const net = () => setOffline(!navigator.onLine);
    window.addEventListener("hashchange", changed);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      window.removeEventListener("hashchange", changed);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      worker.current?.terminate();
    };
  }, []);
  const navigate = (
    page: Page,
    sensor = view.sensor,
    threshold = view.threshold,
  ) => {
    location.hash = `/${page}?sensor=${sensor}&z=${threshold}`;
  };
  const result = useMemo(
    () => (dataset ? screen(dataset.rows, view.threshold) : null),
    [dataset, view.threshold],
  );
  const qa = useMemo(() => quality(dataset?.rows ?? []), [dataset]);
  const events =
    result?.assessments.filter((a) => a.sensor === view.sensor) ?? [];
  const current =
    events.find((a) => a.measurement_id === selection[view.sensor]) ??
    events
      .filter((a) => a.flagged)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0] ??
    events[0];
  const ref = result?.references[view.sensor];
  const upload = (file: File) => {
    worker.current?.terminate();
    setBusy(true);
    setError("");
    setStatus("Menyiapkan pemeriksaan lokal…");
    let w: Worker;
    try {
      w = new Worker(new URL("./import.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      setBusy(false);
      setStatus("");
      setError(
        "Browser menolak pemroses berkas lokal. Periksa izin worker lalu coba lagi.",
      );
      return;
    }
    worker.current = w;
    w.onmessage = ({
      data,
    }: {
      data: { type: string; message?: string; dataset?: Dataset };
    }) => {
      if (worker.current !== w) return;
      if (data.type === "progress") setStatus(data.message ?? "");
      else {
        w.terminate();
        worker.current = null;
        setBusy(false);
        if (data.type === "done" && data.dataset) {
          setDataset(data.dataset);
          setSelection({});
          setStatus(
            `${data.dataset.rows.length} pembacaan berhasil dianalisis secara lokal.`,
          );
        } else {
          setError(data.message ?? "Berkas gagal diproses.");
          setStatus("");
        }
      }
    };
    w.onerror = () => {
      if (worker.current !== w) return;
      w.terminate();
      worker.current = null;
      setBusy(false);
      setStatus("");
      setError(
        "Pemroses lokal gagal dimuat. Muat ulang aplikasi dan coba lagi.",
      );
    };
    w.postMessage(file);
  };
  const cancel = () => {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setStatus("Impor dibatalkan. Data sebelumnya dipertahankan.");
  };
  const rerun = () => {
    if (!dataset) return;
    const start = performance.now();
    const next = screen(dataset.rows, view.threshold);
    setStatus(
      `${next.assessments.length} penilaian dihitung ulang; ${next.flags.length} indikasi, ${(performance.now() - start).toFixed(1)} ms.`,
    );
  };
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Lewati navigasi
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span>K</span>
          <div>
            <strong>KAMOJANG</strong>
            <small>Pemantauan industri</small>
          </div>
        </div>
        <p className="nav-caption">Navigasi</p>
        <nav aria-label="Navigasi utama">
          {(["ringkasan", "analisis", "metode"] as const).map((page, i) => (
            <a
              key={page}
              href={`#/${page}?sensor=${view.sensor}&z=${view.threshold}`}
              aria-current={
                view.page === page ||
                (page === "ringkasan" && view.page === "turbin")
                  ? "page"
                  : undefined
              }
            >
              <Icon name={["overview", "analysis", "methods"][i]} />
              {["Ringkasan", "Analisis", "Metode"][i]}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>Analisis data sensor</p>
          <small>Data pengukuran historis</small>
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        <header className="topbar">
          <span>
            Kamojang Unit 5 <span aria-hidden="true"> · </span>{" "}
            {view.page === "analisis"
              ? "Analisis pengukuran"
              : view.page === "metode"
                ? "Pengaturan analisis"
                : "Pemantauan historis"}
          </span>
          <time>
            {new Date().toLocaleDateString("id-ID", {
              timeZone: "Asia/Jakarta",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </header>
        {offline && (
          <p className="notice" role="status">
            Perangkat luring. Analisis berkas tetap lokal; muat ulang memerlukan
            aplikasi yang sudah tersedia.
          </p>
        )}
        {(view.page === "ringkasan" || view.page === "turbin") && (
          <div className="overview">
            <section className="hero-copy">
              <p className="eyebrow">PLTP Kamojang · Unit 5</p>
              <h1>Kondisi uap.</h1>
              <p className="hero-body">
                Pantau pengukuran terdahulu dan telusuri pembacaan yang
                menyimpang dari pola historis.
              </p>
              <div className="hero-actions">
                <button
                  className="primary"
                  onClick={() => navigate("analisis")}
                >
                  Telusuri pengukuran <Icon name="arrow" />
                </button>
                <button onClick={() => navigate("turbin")}>
                  Jelajahi turbin <Icon name="inspect" />
                </button>
              </div>
              <p className="flag-note">
                ● {result?.flags.length ?? 0} indikasi penyimpangan pada ambang{" "}
                {format(view.threshold)}
              </p>
              <div className="stats">
                <div>
                  <strong>{dataset?.rows.length ?? 0}</strong>
                  <span>pembacaan</span>
                </div>
                <div>
                  <strong>5</strong>
                  <span>parameter</span>
                </div>
              </div>
              <div className="range">
                <p>Rentang data</p>
                <strong>
                  {dataset
                    ? `${dateLabel(dataset.rows[0].date)} – ${dateLabel(dataset.rows.at(-1)!.date)}`
                    : "Belum ada data"}
                </strong>
              </div>
              <button
                className="source-link"
                onClick={() => setModal("source")}
              >
                Sumber:{" "}
                {dataset?.synthetic
                  ? "contoh sintetis, bukan data Kamojang"
                  : (dataset?.name ?? "belum dimuat")}
              </button>
            </section>
            <section className="hero-model">
              <div className="model-stage">
                <div className="model-header">
                  <h2>Sistem turbin uap</h2>
                  {view.page === "turbin" ? (
                    <button onClick={() => navigate("ringkasan")}>
                      ← Ringkasan
                    </button>
                  ) : (
                    <button onClick={() => navigate("turbin")}>
                      Lihat objek
                    </button>
                  )}
                </div>
                <ViewerBoundary>
                  <Suspense fallback={<p role="status">Memuat mesin 3D…</p>}>
                    <TurbineViewer />
                  </Suspense>
                </ViewerBoundary>
                <p className="model-caption">
                  Visualisasi turbin uap representatif
                </p>
                <p className="model-credit">
                  “Steam Turbine” oleh{" "}
                  <a
                    href="https://sketchfab.com/landinweaver"
                    target="_blank"
                    rel="noreferrer"
                  >
                    landinweaver
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY 4.0
                  </a>
                  . Tekstur diperkecil dan geometri dikemas ulang.{" "}
                  <button onClick={() => setModal("model")}>Kredit aset</button>
                </p>
              </div>
              <p className="callout">
                Data historis · Tanpa koneksi sensor langsung
              </p>
            </section>
          </div>
        )}
        {view.page === "analisis" && (
          <>
            <div className="page-heading">
              <h1>Telusuri pengukuran</h1>
              <p>
                Bandingkan pembacaan, telusuri penyimpangan, dan periksa
                konteksnya.
              </p>
            </div>
            <div className="tabs" role="group" aria-label="Parameter">
              {sensors.map((s) => (
                <button
                  key={s}
                  aria-pressed={s === view.sensor}
                  onClick={() => navigate("analisis", s)}
                >
                  {parameters[s].label}
                </button>
              ))}
            </div>
            {result && ref && current ? (
              <>
                <div className="analysis-grid">
                  <section>
                    <div className="panel chart-panel">
                      <div className="chart-heading">
                        <h2>{parameters[view.sensor].label}</h2>
                        <span>Satuan: {parameters[view.sensor].unit}</span>
                      </div>
                      <p className="chart-note">
                        {dataset?.rows.length} pembacaan. Rentang acuan median ±{" "}
                        {format(view.threshold)} skala robust.
                      </p>
                      <Chart
                        events={events}
                        reference={ref}
                        selected={current.measurement_id}
                        onSelect={(id) =>
                          setSelection({ ...selection, [view.sensor]: id })
                        }
                      />
                    </div>
                    <p className="callout chart-legend">
                      Hijau: pembacaan · Tembaga: indikasi · Acuan statistik,
                      bukan batas keselamatan.
                    </p>
                  </section>
                  <aside
                    className="panel inspector"
                    aria-label="Rincian pengukuran"
                  >
                    <h2>
                      {current.flagged
                        ? "Indikasi penyimpangan"
                        : "Rincian pembacaan"}
                    </h2>
                    <p>{dateLabel(current.date)}</p>
                    <div className="reading">
                      {format(current.actual, 5)} <span>{current.unit}</span>
                    </div>
                    <p className={current.flagged ? "flag-note" : ""}>
                      {current.flagged
                        ? "Melewati ambang"
                        : "Tidak melewati ambang"}{" "}
                      |Z| &gt; {format(view.threshold)}
                    </p>
                    <dl>
                      <div>
                        <dt>Baris sumber</dt>
                        <dd>{current.source_row}</dd>
                      </div>
                      <div>
                        <dt>Skor Z</dt>
                        <dd>{format(current.z, 5)}</dd>
                      </div>
                      <div>
                        <dt>Median</dt>
                        <dd>{format(current.baseline, 5)}</dd>
                      </div>
                      <div>
                        <dt>Skala ({ref.estimator})</dt>
                        <dd>
                          {ref.scale === null
                            ? "Konstan / tidak terdeteksi"
                            : format(ref.scale, 5)}
                        </dd>
                      </div>
                    </dl>
                    <p className="muted">
                      Perbedaan nilai belum membuktikan kerusakan sensor atau
                      mesin.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setModal("quality")}
                    >
                      Periksa kualitas data <Icon name="quality" size={20} />
                    </button>
                  </aside>
                </div>
                {ref.lower < 0 && (
                  <p className="notice">
                    Batas bawah statistik {format(ref.lower)}{" "}
                    {parameters[view.sensor].unit} bernilai negatif. Ini bukan
                    rentang fisik yang sah atau batas operasi.
                  </p>
                )}
                <section className="panel data-table">
                  <h2>Tabel pengukuran</h2>
                  <p>
                    Pilih baris untuk melihat rincian. Tanggal yang sama tetap
                    memiliki identitas berbeda.
                  </p>
                  <div className="export-actions">
                    <button
                      onClick={() =>
                        download(
                          "penilaian.csv",
                          exportCSV(result.assessments),
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      Unduh CSV penilaian
                    </button>
                    <button
                      onClick={() =>
                        download(
                          "penilaian.json",
                          JSON.stringify(
                            {
                              version: VERSION,
                              source_file_hash: dataset?.hash,
                              threshold: view.threshold,
                              references: result.references,
                              assessments: result.assessments,
                            },
                            null,
                            2,
                          ),
                          "application/json",
                        )
                      }
                    >
                      Unduh JSON penilaian
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption>
                        {dataset?.synthetic
                          ? "Contoh sintetis · bukan data Kamojang"
                          : dataset?.name}
                      </caption>
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Baris</th>
                          <th>Nilai ({parameters[view.sensor].unit})</th>
                          <th>Skor Z</th>
                          <th>Status statistik</th>
                          <th>Rincian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((a) => (
                          <tr
                            key={a.measurement_id}
                            aria-selected={
                              current.measurement_id === a.measurement_id
                            }
                          >
                            <td>{dateLabel(a.date)}</td>
                            <td>{a.source_row}</td>
                            <td>{format(a.actual, 5)}</td>
                            <td>{format(a.z, 5)}</td>
                            <td>{a.flagged ? "● Indikasi" : "Dalam acuan"}</td>
                            <td>
                              <button
                                aria-label={`Pilih baris ${a.source_row}`}
                                onClick={() =>
                                  setSelection({
                                    ...selection,
                                    [view.sensor]: a.measurement_id,
                                  })
                                }
                              >
                                Pilih
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <section className="panel empty">
                <h2>Belum ada pengukuran</h2>
                <p>Unggah berkas untuk memulai analisis.</p>
                <button className="primary" onClick={() => navigate("metode")}>
                  Buka sumber data
                </button>
              </section>
            )}
          </>
        )}
        {view.page === "metode" && (
          <>
            <div className="page-heading">
              <h1>Siapkan analisis</h1>
              <p>Tinjau kualitas sumber dan atur metode pemeriksaan.</p>
            </div>
            <div className="methods-grid">
              <section className="panel source-panel">
                <h2>Sumber data</h2>
                <p>
                  {dataset?.synthetic
                    ? "Contoh sintetis untuk demonstrasi publik."
                    : "Berkas lokal diproses di perangkat Anda."}
                </p>
                <button
                  className="source-card"
                  onClick={() => setModal("source")}
                >
                  <strong>Periksa sumber data</strong>
                  <span className="source-icon">
                    <Icon name="source" size={28} />
                  </span>
                  <span>
                    {dataset
                      ? `${dataset.rows.length} pembacaan · 5 parameter`
                      : "Belum ada data"}
                  </span>
                </button>
                <h3>Pemeriksaan data</h3>
                <ol className="checks">
                  <li>Periksa format dan urutan tanggal</li>
                  <li>Pertahankan tanggal dengan lebih dari satu pembacaan</li>
                  <li>Tinjau nilai kosong serta batas fisik</li>
                  <li>Catat satuan dan asal pengukuran</li>
                </ol>
              </section>
              <section className="panel method-panel">
                <h2>Metode analisis</h2>
                <p>Pemeriksaan historis robust; GPR adalah riset terpisah.</p>
                <button
                  className="method-choice selected"
                  onClick={() => setModal("robust")}
                >
                  <strong>
                    <span aria-hidden="true">● </span>Acuan statistik robust
                  </strong>
                  <span>Rentang acuan yang dapat dijelaskan</span>
                </button>
                <button
                  className="method-choice"
                  onClick={() => setForecastOpen((v) => !v)}
                  aria-expanded={forecastOpen}
                >
                  <strong>GPR · prediksi</strong>
                  <span>Pemodelan prediksi; tidak aktif sebagai detektor</span>
                </button>
                <h3>Sensitivitas</h3>
                <div className="tabs" role="group" aria-label="Sensitivitas">
                  {[
                    [3.5, "Standar"],
                    [3, "Lebih sensitif"],
                    [4, "Lebih ketat"],
                  ].map(([t, label]) => (
                    <button
                      key={t}
                      aria-pressed={view.threshold === t}
                      onClick={() => navigate("metode", view.sensor, Number(t))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p aria-live="polite">
                  Ambang {format(view.threshold)} · {result?.flags.length ?? 0}{" "}
                  indikasi
                </p>
                <div className="export-actions">
                  <button
                    className="copper"
                    disabled={!dataset || busy}
                    onClick={rerun}
                  >
                    Hitung ulang analisis
                  </button>
                  <button
                    disabled={!dataset || busy}
                    onClick={() => navigate("analisis")}
                  >
                    Lihat hasil analisis
                  </button>
                </div>
              </section>
            </div>
          </>
        )}
        {view.page === "metode" && (
          <section className="panel import-panel">
            <h2>Impor dan kelola data</h2>{" "}
            <p className="method-caveat">
              Median seluruh riwayat adalah acuan retrospektif dalam sampel.
              Belum dikalibrasi terhadap label kegagalan.
            </p>{" "}
            <div className="messages" aria-live="polite">
              {status && <p role="status">{status}</p>}
              {error && (
                <p className="error" role="alert">
                  {error} Data sebelumnya dipertahankan.
                </p>
              )}
            </div>
            <label className="upload">
              Unggah Excel atau CSV
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="muted">
              Maksimum 2 MiB dan 5.000 baris. Tidak dikirim ke server, tidak
              disimpan otomatis.
            </p>
            {busy && <button onClick={cancel}>Batalkan impor</button>}
            <div className="export-actions">
              <button
                disabled={busy}
                onClick={() => {
                  setDataset(demo());
                  setSelection({});
                  setError("");
                  setStatus("Contoh sintetis dimuat.");
                }}
              >
                Muat contoh sintetis
              </button>
              <button
                disabled={busy || !dataset}
                onClick={() => {
                  setDataset(null);
                  setSelection({});
                  setStatus("Data dihapus dari memori aplikasi.");
                  setError("");
                }}
              >
                Hapus data
              </button>
              <button
                onClick={() =>
                  download(
                    "templat.csv",
                    canonicalHeaders.join(",") + "\n",
                    "text/csv",
                  )
                }
              >
                Unduh templat CSV
              </button>
            </div>
          </section>
        )}
        <ForecastPanel
          dataset={dataset}
          visible={forecastOpen && view.page === "metode"}
        />
        <footer>
          {dataset?.synthetic && (
            <strong>Contoh sintetis · bukan data Kamojang. </strong>
          )}
          Analisis berasal dari data historis. Hasil bukan diagnosis kegagalan
          peralatan.
        </footer>
      </main>
      {modal && (
        <ModalDialog
          onClose={() => setModal(null)}
          title={
            {
              quality: "Tinjau kualitas pengukuran",
              source: "Sumber dan kerahasiaan data",
              robust: "Acuan statistik robust",
              model: "Status model turbin 3D",
            }[modal]
          }
        >
          {modal === "quality" && (
            <>
              <p>
                Sebelum menyimpulkan adanya masalah, periksa data sumber dan
                kondisi operasi saat pengukuran.
              </p>
              <ul className="facts">
                <li>
                  {dataset?.rows.length ?? 0} pembacaan pada {qa.uniqueDates}{" "}
                  tanggal berbeda.
                </li>
                <li>
                  {qa.duplicates.length
                    ? qa.duplicates
                        .map(
                          ([d, n]) =>
                            `${dateLabel(d)}: ${n} pembacaan; semuanya dipertahankan.`,
                        )
                        .join(" ")
                    : "Tidak ditemukan tanggal berulang."}
                </li>
                <li>
                  {qa.over100.length} nilai kualitas uap melebihi 100%;
                  verifikasi definisi dan metodenya.
                </li>
                <li>
                  {qa.negative.length} baris memiliki nilai negatif; tinjau
                  satuan dan batas fisik.
                </li>
                <li>
                  Tidak ada label kerusakan terkonfirmasi dalam skema impor.
                </li>
              </ul>
            </>
          )}
          {modal === "source" && (
            <>
              <p>{dataset?.name ?? "Belum ada data."}</p>
              <p>
                {dataset?.synthetic
                  ? "Angka dibuat khusus untuk demonstrasi dan pengujian. Tidak mewakili pengukuran Kamojang."
                  : "Berkas dibaca hanya di perangkat. Izin publikasi atau redistribusi belum ditetapkan."}
              </p>
              <dl>
                <dt>Identitas sumber / SHA-256</dt>
                <dd className="hash">{dataset?.hash ?? "—"}</dd>
                <dt>Pembaca</dt>
                <dd>read-excel-file 9.3.12 untuk XLSX; parser CSV UTF-8</dd>
              </dl>
              <p>
                Tanggal disusun kronologis; baris sumber memecahkan ikatan hanya
                untuk tampilan. Tidak diasumsikan urutan waktu dalam satu hari.
              </p>
              <p>
                Muat ulang halaman membuang data unggahan. Ekspor memuat nilai
                masukan; simpan dan bagikan hanya bila berwenang.
              </p>
            </>
          )}
          {modal === "robust" && (
            <>
              <p>
                Median setiap parameter dihitung dari semua pengukuran. MAD
                adalah median simpangan absolut terhadap median.
              </p>
              <p>
                <code>Z = (nilai − median) / (1,4826022185 × MAD)</code>
              </p>
              <p>
                Indikasi jika |Z| &gt; {format(view.threshold)}. Jika MAD nol:
                IQR / 1,349, lalu simpangan baku sampel; data konstan diberi
                skor nol dan status tidak terdeteksi. Minimal tiga baris
                lengkap.
              </p>
              <p>
                Rentang statistik dapat melampaui batas fisik. Tidak tersedia
                precision, recall, F1, atau probabilitas kegagalan.
              </p>
            </>
          )}
          {modal === "model" && (
            <>
              <p>
                Steam Turbine oleh landinweaver, berlisensi CC BY 4.0.{" "}
                <a
                  href="https://sketchfab.com/3d-models/steam-turbine-bcc264eafbe4412d9c061d6d97f30b99"
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka karya asli
                </a>
                .
              </p>
              <p>
                Arsip diunduh dan diberikan pemilik proyek. Model dioptimalkan:
                tekstur WebP maksimum 1024 piksel, geometri digabung dan
                dikompresi Meshopt. Tidak ada animasi rotor yang direkayasa.
              </p>
              <p>
                Visualisasi turbin uap representatif, bukan kembaran digital
                atau model mesin aktual Kamojang Unit 5.
              </p>
            </>
          )}
        </ModalDialog>
      )}
    </>
  );
}
