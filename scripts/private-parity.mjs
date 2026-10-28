import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";
register();
const { validateTable, parseCSV } = await import("../src/import.ts");
const { screen, sensors } = await import("../src/domain.ts");
const { default: readXlsx } = await import("read-excel-file/node");
const path =
  process.argv[2] ?? "Data Steam Quality, TDS & NCG Unit 5 Kamojang-1.xlsx";
const bytes = await readFile(path);
const hash = createHash("sha256").update(bytes).digest("hex");
const sheets = await readXlsx(bytes);
assert.equal(sheets.length, 1);
const rows = validateTable(sheets[0].data, hash, "xlsx");
const saved = parseCSV(
  await readFile(".private/original/kamojang_clean_rows.csv", "utf8"),
);
assert.equal(rows.length, 44);
for (let i = 0; i < rows.length; i++) {
  const row = rows[i],
    old = saved[i + 1];
  assert.equal(row.source_row, Number(old[0]));
  assert.equal(row.date, old[1]);
  for (const sensor of sensors) {
    const column = saved[0].indexOf(sensor);
    assert.ok(Math.abs(row.values[sensor] - Number(old[column])) < 1e-12);
  }
}
const cached = parseCSV(
  await readFile(".private/original/kamojang_anomaly_screen.csv", "utf8"),
);
const header = cached[0];
const index = new Map(
  cached.slice(1).map((row) => [`${row[0]}:${row[2]}`, row]),
);
for (const a of screen(rows, 3.5).assessments) {
  const old = index.get(`${a.source_row}:${a.sensor}`);
  assert.ok(old);
  assert.equal(a.flagged, old[header.indexOf("candidate_anomaly")] === "True");
  assert.ok(
    Math.abs(a.z - Number(old[header.indexOf("signed_robust_z")])) < 0.0000051,
  );
}
for (const [t, count] of [
  [3, 9],
  [3.5, 7],
  [4, 6],
])
  assert.equal(screen(rows, t).flags.length, count);
console.log(
  JSON.stringify(
    {
      parser: "read-excel-file 9.3.12",
      source_sha256: hash,
      rows: rows.length,
      unique_dates: new Set(rows.map((r) => r.date)).size,
      parity: "220 source values and 220 scores/flags PASS",
      threshold_counts: { 3: 9, 3.5: 7, 4: 6 },
    },
    null,
    2,
  ),
);
