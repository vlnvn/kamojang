import { describe, it, expect } from "vitest";
import { demo as makeDemo } from "../src/demo";
const demo = makeDemo();
import { sensors } from "../src/domain";
import {
  validateIsolation,
  isolationCSV,
  type IsolationResult,
} from "../src/isolation";
function response(): IsolationResult {
  const points = demo.rows.map((r, i) => ({
    source_row: r.source_row,
    date: r.date,
    values: r.values,
    score: i === 0 ? -0.1 : 0.2,
    flagged: i === 0,
  }));
  return {
    protocol: "isolation-reference-holdout/1.0.0",
    request_id: "test",
    source_hash: demo.hash,
    seed: 42,
    features: sensors,
    config: {
      contamination: 0.05,
      n_estimators: 100,
      preprocessing: "StandardScaler",
    },
    versions: { numpy: "test", scikit_learn: "test" },
    reference: { fit_rows: 25, offset: -0.5, observations: points },
    holdout: {
      train_rows: 20,
      test_rows: 5,
      train_last_date: points[19].date,
      test_first_date: points[20].date,
      offset: -0.5,
      observations: points.slice(20),
    },
    manual: null,
    sensitivity: [0.01, 0.05, 0.1, 0.15, 0.2, 0.3].map((contamination) => ({
      contamination,
      offset: -0.5,
      flagged: 1,
    })),
  };
}
const validate = (r: unknown) =>
  validateIsolation(
    r,
    demo,
    "test",
    { contamination: 0.05, n_estimators: 100 },
    null,
  );
describe("multivariate response and export boundary", () => {
  it("accepts source-aligned results and exports distinct fit scopes", () => {
    const r = validate(response()),
      csv = isolationCSV(r);
    expect(csv.split("\n").filter(Boolean)).toHaveLength(31);
    expect(csv).toContain('"reference_in_sample"');
    expect(csv).toContain('"chronological_holdout"');
    expect(csv).toContain(demo.hash);
  });
  it("rejects stale, nonfinite, mislabelled and misattributed results", () => {
    for (const change of [
      (r: IsolationResult) => {
        r.source_hash = "other";
      },
      (r: IsolationResult) => {
        r.request_id = "old";
      },
      (r: IsolationResult) => {
        r.reference.observations[0].score = NaN;
      },
      (r: IsolationResult) => {
        r.reference.observations[0].flagged = false;
      },
      (r: IsolationResult) => {
        r.holdout.observations[0].source_row = 9000;
      },
      (r: IsolationResult) => {
        r.config.contamination = 0.2;
      },
    ]) {
      const r = structuredClone(response());
      change(r);
      expect(() => validate(r)).toThrow();
    }
  });
  it("guards spreadsheet formula prefixes in trace metadata", () => {
    const r = response();
    r.source_hash = '=HYPERLINK("unsafe")';
    expect(isolationCSV(r)).toContain("'=HYPERLINK");
  });
});
