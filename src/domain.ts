export const parameters = {
  pressure_bara: { label: "Tekanan", unit: "bara" },
  ncg_percent_mass: { label: "NCG", unit: "% massa" },
  steam_quality_percent: { label: "Kualitas uap", unit: "%" },
  tds_ppm: { label: "TDS", unit: "ppm" },
  temperature_degC: { label: "Suhu", unit: "°C" },
} as const;
export type Sensor = keyof typeof parameters;
export const sensors = Object.keys(parameters) as Sensor[];
export const columnSensors: Sensor[] = [
  "pressure_bara",
  "temperature_degC",
  "steam_quality_percent",
  "ncg_percent_mass",
  "tds_ppm",
];
export const canonicalHeaders = ["date", ...columnSensors];
export const workbookHeaders = [
  "Tanggal",
  "Pressure (bara)",
  "Temperature (deg-C)",
  "Steam Quality (%)",
  "NCG (%berat)",
  "TDS (ppm)",
];
export type Measurement = {
  measurement_id: string;
  source_file_hash: string;
  source_row: number;
  date: string;
  values: Record<Sensor, number>;
};
export type Dataset = {
  name: string;
  hash: string;
  rows: Measurement[];
  synthetic: boolean;
};
export type Reference = {
  median: number;
  mad: number;
  scale: number | null;
  estimator: "MAD" | "IQR" | "SD" | "constant";
  lower: number;
  upper: number;
};
export type Assessment = {
  measurement_id: string;
  source_row: number;
  source_file_hash: string;
  date: string;
  sensor: Sensor;
  unit: string;
  actual: number;
  baseline: number;
  scale: number | null;
  z: number;
  flagged: boolean;
  threshold: number;
  version: string;
};
export const VERSION = "robust-retrospective/1.0.0";
export function quantile(values: number[], p: number): number {
  const a = [...values].sort((x, y) => x - y);
  const i = (a.length - 1) * p;
  const lo = Math.floor(i);
  return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo);
}
export function screen(rows: Measurement[], threshold: number) {
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 10)
    throw new Error("Ambang harus antara 1 dan 10.");
  if (rows.length < 3)
    throw new Error("Sedikitnya 3 pembacaan lengkap diperlukan.");
  const references = {} as Record<Sensor, Reference>;
  for (const sensor of sensors) {
    const x = rows.map((r) => r.values[sensor]);
    if (!x.every(Number.isFinite))
      throw new Error("Semua nilai harus berupa angka berhingga.");
    const median = quantile(x, 0.5);
    const mad = quantile(
      x.map((v) => Math.abs(v - median)),
      0.5,
    );
    let scale: number | null = 1.4826022185 * mad;
    let estimator: Reference["estimator"] = "MAD";
    if (scale <= 1e-12) {
      scale = (quantile(x, 0.75) - quantile(x, 0.25)) / 1.349;
      estimator = "IQR";
    }
    if (scale <= 1e-12) {
      const mean = x.reduce((a, b) => a + b, 0) / x.length;
      scale = Math.sqrt(
        x.reduce((a, b) => a + (b - mean) ** 2, 0) / (x.length - 1),
      );
      estimator = "SD";
    }
    if (scale <= 1e-12) {
      scale = null;
      estimator = "constant";
    }
    references[sensor] = {
      median,
      mad,
      scale,
      estimator,
      lower: median - threshold * (scale ?? 0),
      upper: median + threshold * (scale ?? 0),
    };
  }
  const assessments: Assessment[] = rows.flatMap((row) =>
    sensors.map((sensor) => {
      const ref = references[sensor];
      const z =
        ref.scale === null ? 0 : (row.values[sensor] - ref.median) / ref.scale;
      if (!Number.isFinite(z))
        throw new Error("Rentang angka melampaui kapasitas perhitungan.");
      return {
        measurement_id: row.measurement_id,
        source_row: row.source_row,
        source_file_hash: row.source_file_hash,
        date: row.date,
        sensor,
        unit: parameters[sensor].unit,
        actual: row.values[sensor],
        baseline: ref.median,
        scale: ref.scale,
        z,
        flagged: Math.abs(z) > threshold,
        threshold,
        version: VERSION,
      };
    }),
  );
  return {
    references,
    assessments,
    flags: assessments.filter((a) => a.flagged),
  };
}
export function quality(rows: Measurement[]) {
  const dates = new Map<string, number>();
  rows.forEach((r) => dates.set(r.date, (dates.get(r.date) ?? 0) + 1));
  return {
    uniqueDates: dates.size,
    duplicates: [...dates].filter(([, n]) => n > 1),
    over100: rows.filter((r) => r.values.steam_quality_percent > 100),
    negative: rows.filter((r) => sensors.some((s) => r.values[s] < 0)),
  };
}
export function safeCSVCell(value: unknown): string {
  const text = String(value ?? "");
  const escaped = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${escaped.replaceAll('"', '""')}"`;
}
export function exportCSV(assessments: Assessment[]): string {
  const keys = Object.keys(assessments[0] ?? {}) as (keyof Assessment)[];
  return (
    "\ufeff" +
    [
      keys.map(safeCSVCell).join(","),
      ...assessments.map((a) => keys.map((k) => safeCSVCell(a[k])).join(",")),
    ].join("\r\n")
  );
}
export const format = (n: number, digits = 4) =>
  n.toLocaleString("id-ID", { maximumFractionDigits: digits });
export const dateLabel = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
