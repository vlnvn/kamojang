import {
  canonicalHeaders,
  columnSensors,
  workbookHeaders,
  type Dataset,
  type Measurement,
  type Sensor,
} from "./domain";
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 5000;
const fail = (message: string): never => {
  throw new Error(message);
};
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) fail("CSV: tanda kutip tidak valid.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
      }
    } else {
      if (closed) fail("CSV: karakter setelah tanda kutip.");
      cell += c;
    }
    if (rows.length > MAX_ROWS + 4) fail("Maksimum 5.000 pembacaan.");
  }
  if (quoted) fail("CSV: tanda kutip belum ditutup.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
function normalizeDate(value: unknown, row: number): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    if (
      value.getUTCHours() ||
      value.getUTCMinutes() ||
      value.getUTCSeconds() ||
      value.getUTCMilliseconds()
    )
      fail(
        `Baris ${row}: skema memerlukan tanggal tanpa jam; waktu intrahari tidak boleh dibuang diam-diam.`,
      );
    return value.toISOString().slice(0, 10);
  }
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 60 &&
    value < 2958466
  )
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000)
      .toISOString()
      .slice(0, 10);
  const text = String(value ?? "").trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    !Number.isFinite(Date.parse(text)) ||
    new Date(text).toISOString().slice(0, 10) !== text
  )
    fail(
      `Baris ${row}: tanggal harus ISO YYYY-MM-DD atau tanggal Excel yang valid.`,
    );
  return text;
}
export function validateTable(
  table: unknown[][],
  hash: string,
  source: "csv" | "xlsx",
): Measurement[] {
  const headerIndex =
    source === "xlsx" &&
    String(table[0]?.[0]).startsWith("Rekap Data Steam Quality")
      ? 2
      : 0;
  const expected =
    source === "xlsx" && headerIndex === 2 ? workbookHeaders : canonicalHeaders;
  const actual = table[headerIndex]?.map((v) =>
    String(v ?? "")
      .replace(/^\ufeff/, "")
      .trim(),
  );
  if (
    !actual ||
    actual.length !== 6 ||
    actual.some((v, i) => v !== expected[i])
  )
    fail(
      "Kolom atau satuan tidak sesuai. Gunakan templat CSV atau workbook Kamojang dengan enam kolom asli.",
    );
  const rows: Measurement[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const raw = table[i];
    if (raw.every((v) => v == null || v === "")) continue;
    if (
      source === "xlsx" &&
      i === 48 &&
      String(raw[0]).startsWith("Data pressure dan temperatur diukur") &&
      raw.slice(1).every((v) => v == null || v === "")
    )
      continue;
    const line = i + 1;
    if (raw.length !== 6) fail(`Baris ${line}: diperlukan enam nilai lengkap.`);
    const values = {} as Record<Sensor, number>;
    columnSensors.forEach((s, j) => {
      const v = raw[j + 1];
      if (
        v == null ||
        String(v).trim() === "" ||
        (typeof v !== "number" &&
          !/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(String(v).trim()))
      )
        fail(
          `Baris ${line}, ${s}: isi angka tanpa formula dan gunakan titik desimal.`,
        );
      const n = Number(v);
      if (!Number.isFinite(n) || Math.abs(n) > 1e100)
        fail(`Baris ${line}, ${s}: angka di luar rentang.`);
      values[s] = n;
    });
    rows.push({
      measurement_id: `${hash}:${line}`,
      source_file_hash: hash,
      source_row: line,
      date: normalizeDate(raw[0], line),
      values,
    });
    if (rows.length > MAX_ROWS) fail("Maksimum 5.000 pembacaan.");
  }
  if (rows.length < 3) fail("Sedikitnya 3 pembacaan lengkap diperlukan.");
  return rows.sort(
    (a, b) => a.date.localeCompare(b.date) || a.source_row - b.source_row,
  );
}
export async function importFile(
  file: File,
  progress: (message: string) => void,
): Promise<Dataset> {
  if (file.size > MAX_BYTES) fail("Berkas melebihi 2 MiB.");
  if (file.size === 0) fail("Berkas kosong.");
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "csv" && extension !== "xlsx")
    fail("Format tidak didukung. Pilih .csv atau .xlsx.");
  const allowed =
    extension === "csv"
      ? ["", "text/csv", "application/csv", "application/vnd.ms-excel"]
      : [
          "",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];
  if (!allowed.includes(file.type))
    fail("Jenis MIME tidak sesuai dengan ekstensi berkas.");
  progress("Membaca berkas dan menghitung SHA-256…");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  let table: unknown[][];
  if (extension === "csv") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail("CSV harus menggunakan UTF-8.");
    }
    if (text!.includes("\0")) fail("CSV mengandung karakter biner.");
    table = parseCSV(text!);
  } else {
    if (bytes[0] !== 80 || bytes[1] !== 75)
      fail("Berkas XLSX bukan arsip ZIP yang valid.");
    progress("Memvalidasi struktur workbook…");
    const { Unzip, UnzipInflate } = await import("fflate");
    // Streaming decompression caps expanded bytes before retaining entries (ZIP bomb guard).
    let expanded = 0;
    let entries = 0;
    let issue = "";
    const unzip = new Unzip((entry) => {
      entries++;
      if (
        entries > 200 ||
        (entry.originalSize && entry.originalSize > 16 * 1024 * 1024)
      ) {
        issue = "Workbook terlalu besar setelah diekstrak.";
        return;
      }
      if (/vbaProject|externalLinks/i.test(entry.name)) {
        issue = "Makro dan tautan eksternal tidak diperbolehkan.";
        return;
      }
      const isXML = /\.xml$/.test(entry.name);
      const decoder = new TextDecoder();
      let tail = "";
      entry.ondata = (err, data, final) => {
        if (err) {
          issue = "Arsip XLSX rusak.";
          return;
        }
        expanded += data.length;
        if (expanded > 16 * 1024 * 1024) {
          issue = "Workbook terlalu besar setelah diekstrak.";
          entry.terminate();
          return;
        }
        if (!isXML) return;
        const text = tail + decoder.decode(data, { stream: !final });
        if (/<(?:\w+:)?f(?:\s|>|\/)/.test(text))
          issue = "Formula spreadsheet tidak diperbolehkan; unggah nilai asli.";
        tail = text.slice(-100);
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    try {
      for (let offset = 0; offset < bytes.length && !issue; offset += 4096) {
        unzip.push(
          bytes.subarray(offset, offset + 4096),
          offset + 4096 >= bytes.length,
        );
      }
    } catch {
      fail("Arsip XLSX tidak dapat dibaca.");
    }
    if (issue) fail(issue);
    const { default: readXlsxFile } =
      await import("read-excel-file/web-worker");
    try {
      const sheets = await readXlsxFile(file);
      if (sheets.length !== 1)
        fail("Workbook harus memiliki tepat satu lembar.");
      table = sheets[0].data;
      if (table.length > MAX_ROWS + 4) fail("Maksimum 5.000 pembacaan.");
    } catch (e) {
      fail(e instanceof Error ? e.message : "Workbook tidak dapat dibaca.");
    }
  }
  progress("Memvalidasi baris, tanggal, dan satuan…");
  return {
    name: file.name,
    hash,
    rows: validateTable(table!, hash, extension as "csv" | "xlsx"),
    synthetic: false,
  };
}
