import { validateTable } from "./import";
import { canonicalHeaders, type Dataset } from "./domain";
// Intentionally fictional measurements, generated independently from restricted sources.
export function demo(): Dataset {
  const table: unknown[][] = [canonicalHeaders];
  for (let i = 0; i < 24; i++)
    table.push([
      new Date(Date.UTC(2023, i, i === 13 ? 15 : 5 + (i % 4) * 3))
        .toISOString()
        .slice(0, 10),
      7 + Math.sin(i) * 0.08 + (i === 17 ? 0.9 : 0),
      171 + Math.cos(i) * 2,
      99.6 + Math.sin(i * 0.8) * 0.3,
      0.32 + Math.cos(i * 0.7) * 0.03,
      0.8 + Math.sin(i * 0.9) * 0.2 + (i === 20 ? 2 : 0),
    ]);
  table.push([...table[14]]);
  table[25][1] = 6.2;
  return {
    name: "Contoh sintetis · bukan data Kamojang",
    hash: "synthetic-v1",
    synthetic: true,
    rows: validateTable(table, "synthetic-v1", "csv"),
  };
}
