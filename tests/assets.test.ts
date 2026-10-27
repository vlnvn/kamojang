import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
it("ships only the reviewed authentic mesh with matching hash and license", () => {
  const manifest = JSON.parse(
    readFileSync("public/models/manifest.json", "utf8"),
  );
  const bytes = readFileSync("public" + manifest.file);
  expect(bytes.subarray(0, 4).toString()).toBe("glTF");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    manifest.sha256,
  );
  expect(manifest.license).toBe("CC-BY-4.0");
  expect(manifest.author).toBe("landinweaver");
  expect(manifest.validation.optimized_errors).toBe(0);
  expect(manifest.optimized_stats.rendered_triangles).toBe(173699);
  expect(bytes.length).toBe(manifest.bytes);
  expect(readFileSync("public/models/LICENSE.txt", "utf8")).toContain(
    "CC-BY-4.0",
  );
});
