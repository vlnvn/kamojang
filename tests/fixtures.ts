import { strToU8, zipSync } from "fflate";
import { canonicalHeaders } from "../src/domain";
export function fixtureCSV() {
  return [
    canonicalHeaders.join(","),
    ...Array.from(
      { length: 12 },
      (_, i) =>
        `2024-${String(i + 1).padStart(2, "0")}-05,${i === 10 ? 9 : 7 + i * 0.01},${170 + i * 0.1},99.5,0.3,1`,
    ),
  ].join("\n");
}
const escape = (v: unknown) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export function fixtureXLSX({
  formula = false,
  extraSheet = false,
  large = false,
}: { formula?: boolean; extraSheet?: boolean; large?: boolean } = {}) {
  const rows = [
    canonicalHeaders,
    ...Array.from({ length: 8 }, (_, i) => [
      `2024-01-${String(i + 1).padStart(2, "0")}`,
      7 + i * 0.01,
      170,
      99.5,
      0.3,
      1,
    ]),
  ];
  const worksheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => `<c r="${"ABCDEF"[j]}${i + 1}" t="inlineStr"><is><t>${escape(v)}</t></is>${formula && i === 1 && j === 1 ? "<f>1+1</f>" : ""}</c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const entries: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": strToU8(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/>${extraSheet ? '<sheet name="Sheet2" sheetId="2" r:id="rId2"/>' : ""}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>${extraSheet ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' : ""}</Relationships>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(worksheet),
  };
  if (extraSheet) entries["xl/worksheets/sheet2.xml"] = strToU8(worksheet);
  if (large)
    entries["large.xml"] = strToU8(
      "<a>" + " ".repeat(17 * 1024 * 1024) + "</a>",
    );
  return Buffer.from(zipSync(entries));
}
