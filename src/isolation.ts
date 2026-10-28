import { sensors, safeCSVCell, type Dataset, type Sensor } from "./domain";
export type IsolationConfig = { contamination: number; n_estimators: number };
export type IsolationPoint = {
  source_row: number;
  date: string;
  values: Record<Sensor, number>;
  score: number;
  flagged: boolean;
};
export type IsolationResult = {
  protocol: string;
  source_hash: string;
  request_id: string;
  seed: number;
  features: Sensor[];
  config: IsolationConfig & { preprocessing: string };
  versions: { numpy: string; scikit_learn: string };
  reference: {
    fit_rows: number;
    offset: number;
    observations: IsolationPoint[];
  };
  holdout: {
    train_rows: number;
    test_rows: number;
    train_last_date: string;
    test_first_date: string;
    offset: number;
    observations: IsolationPoint[];
  };
  sensitivity: { contamination: number; offset: number; flagged: number }[];
  manual: {
    values: Record<Sensor, number>;
    score: number;
    flagged: boolean;
  } | null;
};
export function validateIsolation(
  value: unknown,
  dataset: Dataset,
  id: string,
  config: IsolationConfig,
  manual: Record<Sensor, number> | null,
): IsolationResult {
  const r = value as IsolationResult;
  const fail = () => {
    throw Error("Respons Isolation Forest tidak sesuai kontrak.");
  };
  const validScore = (p: { score: number; flagged: boolean }) =>
    p && Number.isFinite(p.score) && p.flagged === p.score < 0;
  const sameValues = (a: Record<Sensor, number>, b: Record<Sensor, number>) =>
    a && sensors.every((s) => Number.isFinite(a[s]) && a[s] === b[s]);
  const rows = [...dataset.rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.source_row - b.source_row,
  );
  const count = Math.ceil(rows.length * 0.2),
    cut = rows.length - count;
  if (
    !r ||
    r.protocol !== "isolation-reference-holdout/1.0.0" ||
    r.source_hash !== dataset.hash ||
    r.request_id !== id ||
    r.seed !== 42 ||
    r.config?.contamination !== config.contamination ||
    r.config?.n_estimators !== config.n_estimators ||
    r.config?.preprocessing !== "StandardScaler" ||
    !Array.isArray(r.features) ||
    r.features.length !== 5 ||
    !sensors.every((s) => r.features.includes(s)) ||
    typeof r.versions?.numpy !== "string" ||
    typeof r.versions?.scikit_learn !== "string" ||
    r.reference?.fit_rows !== rows.length ||
    r.holdout?.train_rows !== cut ||
    r.holdout?.test_rows !== count ||
    r.holdout?.train_last_date !== rows[cut - 1]?.date ||
    r.holdout?.test_first_date !== rows[cut]?.date ||
    !Number.isFinite(r.reference?.offset) ||
    !Number.isFinite(r.holdout?.offset)
  )
    fail();
  for (const [points, expected] of [
    [r.reference.observations, rows],
    [r.holdout.observations, rows.slice(cut)],
  ] as const) {
    if (!Array.isArray(points) || points.length !== expected.length) fail();
    points.forEach((p, i) => {
      const row = expected[i];
      if (
        !validScore(p) ||
        p.source_row !== row.source_row ||
        p.date !== row.date ||
        !sameValues(p.values, row.values)
      )
        fail();
    });
  }
  if (
    !Array.isArray(r.sensitivity) ||
    r.sensitivity.length < 6 ||
    r.sensitivity.length > 7 ||
    new Set(r.sensitivity.map((s) => s.contamination)).size !==
      r.sensitivity.length ||
    r.sensitivity.some(
      (s) =>
        !Number.isFinite(s.offset) ||
        !Number.isFinite(s.contamination) ||
        s.contamination < 0.01 ||
        s.contamination > 0.3 ||
        !Number.isInteger(s.flagged) ||
        s.flagged < 0 ||
        s.flagged > rows.length,
    ) ||
    !r.sensitivity.some(
      (s) =>
        s.contamination === config.contamination &&
        s.flagged === r.reference.observations.filter((p) => p.flagged).length,
    )
  )
    fail();
  if (
    manual
      ? !r.manual ||
        !validScore(r.manual) ||
        !sameValues(r.manual.values, manual)
      : r.manual !== null
  )
    fail();
  return r;
}
export function isolationCSV(result: IsolationResult) {
  const headers = [
    "protocol",
    "source_hash",
    "scope",
    "source_row",
    "date",
    ...sensors,
    "decision_score",
    "flagged",
    "contamination",
    "n_estimators",
    "seed",
  ];
  const rows = [headers.map(safeCSVCell).join(",")];
  const add = (
    scope: string,
    p: {
      source_row: number | string;
      date: string;
      values: Record<Sensor, number>;
      score: number;
      flagged: boolean;
    },
  ) =>
    rows.push(
      [
        result.protocol,
        result.source_hash,
        scope,
        p.source_row,
        p.date,
        ...sensors.map((s) => p.values[s]),
        p.score,
        p.flagged,
        result.config.contamination,
        result.config.n_estimators,
        result.seed,
      ]
        .map(safeCSVCell)
        .join(","),
    );
  result.reference.observations.forEach((p) => add("reference_in_sample", p));
  result.holdout.observations.forEach((p) => add("chronological_holdout", p));
  if (result.manual)
    add("manual_against_full_reference", {
      ...result.manual,
      source_row: "",
      date: "",
    });
  return rows.join("\n") + "\n";
}
