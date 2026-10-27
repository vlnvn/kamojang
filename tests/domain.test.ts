import { describe, it, expect } from "vitest";
import {
  canonicalHeaders,
  screen,
  safeCSVCell,
  quality,
  sensors,
} from "../src/domain";
import { parseCSV, validateTable, importFile } from "../src/import";
import { demo } from "../src/demo";
describe("retrospective screening", () => {
  it("recomputes flags monotonically and deterministically", () => {
    const r = demo().rows;
    expect(screen(r, 3)).toEqual(screen(r, 3));
    expect(screen(r, 3).flags.length).toBeGreaterThanOrEqual(
      screen(r, 4).flags.length,
    );
    expect(screen(r, 3.5).assessments).toHaveLength(r.length * 5);
  });
  it("reports constant and fallback estimators", () => {
    const r = demo().rows;
    for (const row of r) for (const s of sensors) row.values[s] = 2;
    expect(screen(r, 3.5).references.pressure_bara.estimator).toBe("constant");
    expect(screen(r, 3.5).flags).toHaveLength(0);
    r[0].values.pressure_bara = 20;
    expect(screen(r, 3.5).references.pressure_bara.estimator).toBe("SD");
  });
  it("rejects nonfinite, insufficient and invalid threshold input", () => {
    expect(() => screen([], 3)).toThrow();
    expect(() => screen(demo().rows, NaN)).toThrow();
    const r = demo().rows;
    r[0].values.tds_ppm = Infinity;
    expect(() => screen(r, 3)).toThrow();
  });
  it("preserves duplicated dates with unique row identities", () => {
    const r = demo().rows;
    expect(quality(r).duplicates).toHaveLength(1);
    expect(new Set(r.map((x) => x.measurement_id)).size).toBe(r.length);
  });
});
describe("input boundary", () => {
  const row = ["2024-01-02", 7, 170, 99, 0.2, 1];
  it("rejects timestamps with intraday time instead of discarding it", () => {
    expect(() =>
      validateTable(
        [
          canonicalHeaders,
          [new Date("2024-01-02T12:00:00Z"), ...row.slice(1)],
          row,
          row,
        ],
        "hash",
        "csv",
      ),
    ).toThrow("waktu intrahari");
  });
  it("preserves ISO dates, strict schema and source rows", () => {
    const rows = validateTable(
      [canonicalHeaders, row, [...row], [...row]],
      "hash",
      "csv",
    );
    expect(rows.map((r) => r.source_row)).toEqual([2, 3, 4]);
  });
  it.each([
    ["2024-02-30", 7, 170, 99, 0.2, 1],
    ["02/03/2024", 7, 170, 99, 0.2, 1],
    ["2024-01-02", "", 170, 99, 0.2, 1],
    ["2024-01-02", "=1+1", 170, 99, 0.2, 1],
    ["2024-01-02", "NaN", 170, 99, 0.2, 1],
  ])("rejects invalid row %j", (...bad) => {
    expect(() =>
      validateTable([canonicalHeaders, bad, row, row], "x", "csv"),
    ).toThrow();
  });
  it("rejects duplicate column names and extra cells", () => {
    expect(() =>
      validateTable(
        [["date", "date", ...canonicalHeaders.slice(2)], row, row, row],
        "x",
        "csv",
      ),
    ).toThrow();
    expect(() =>
      validateTable([canonicalHeaders, [...row, 2], row, row], "x", "csv"),
    ).toThrow();
  });
  it("parses quoted CSV and rejects malformed syntax", () => {
    expect(parseCSV('"a,b",c\r\n"d""e",f')).toEqual([
      ["a,b", "c"],
      ['d"e', "f"],
    ]);
    expect(() => parseCSV('"a')).toThrow();
    expect(() => parseCSV('"a"x')).toThrow();
  });
  it("guards spreadsheet formula injection", () => {
    expect(safeCSVCell("=1+2")).toBe('"\'=1+2"');
    expect(safeCSVCell(" \t@SUM(A1)")).toContain("'");
    expect(safeCSVCell('a"b')).toBe('"a""b"');
  });
  it("handles size, MIME, unsupported and empty files", async () => {
    await expect(importFile(new File([], "x.csv"), () => {})).rejects.toThrow(
      "kosong",
    );
    await expect(
      importFile(new File(["x"], "x.exe"), () => {}),
    ).rejects.toThrow("Format");
    await expect(
      importFile(new File(["x"], "x.csv", { type: "text/html" }), () => {}),
    ).rejects.toThrow("MIME");
    await expect(
      importFile(new File([new Uint8Array(2097153)], "x.csv"), () => {}),
    ).rejects.toThrow("2 MiB");
  });
  it("rejects too many records", () => {
    expect(() =>
      validateTable(
        [canonicalHeaders, ...Array.from({ length: 5001 }, () => row)],
        "x",
        "csv",
      ),
    ).toThrow("5.000");
  });
});
