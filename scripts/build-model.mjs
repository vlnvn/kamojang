import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { TextDecoder } from "node:util";
import { unzipSync } from "fflate";
import validator from "gltf-validator";
const archive = process.argv[2] ?? "steam_turbine.zip";
const source = path.resolve(".private/turbine-source");
const out = path.resolve("public/models");
await mkdir(source, { recursive: true });
await mkdir(out, { recursive: true });
await mkdir(".private/model-audit", { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const zip = await readFile(archive);
const files = unzipSync(zip);
const license = new TextDecoder().decode(files["license.txt"]);
if (
  !license.includes("CC-BY-4.0") ||
  !license.includes("landinweaver") ||
  !license.includes("bcc264eafbe4412d9c061d6d97f30b99")
)
  throw Error("Unexpected asset license/source: review before distribution");
for (const [name, bytes] of Object.entries(files)) {
  const target = path.resolve(source, name);
  if (!target.startsWith(source + path.sep)) throw Error("Unsafe archive path");
  if (name.endsWith("/")) continue;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
const cli = "node_modules/@gltf-transform/cli/bin/cli.js";
execFileSync(
  process.execPath,
  [
    cli,
    "copy",
    path.join(source, "scene.gltf"),
    path.join(source, "source-preview.glb"),
  ],
  { stdio: "inherit" },
);
const curated = JSON.parse(new TextDecoder().decode(files["scene.gltf"]));
for (const n of curated.nodes)
  if (["Object_44", "Object_46"].includes(n.name)) delete n.mesh;
await writeFile(path.join(source, "curated.gltf"), JSON.stringify(curated));
execFileSync(
  process.execPath,
  [
    cli,
    "copy",
    path.join(source, "curated.gltf"),
    path.join(source, "source-preview.glb"),
  ],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [
    cli,
    "optimize",
    path.join(source, "source-preview.glb"),
    path.join(out, "steam-turbine.glb"),
    "--simplify",
    "false",
    "--texture-size",
    "1024",
    "--texture-compress",
    "webp",
    "--compress",
    "meshopt",
  ],
  { stdio: "inherit" },
);
const original = JSON.parse(new TextDecoder().decode(files["scene.gltf"]));
const final = await readFile(path.join(out, "steam-turbine.glb"));
const packed = JSON.parse(
  final.subarray(20, 20 + final.readUInt32LE(12)).toString(),
);
const reportSource = await validator.validateString(JSON.stringify(original), {
  uri: "scene.gltf",
  externalResourceFunction: async (uri) =>
    new Uint8Array(
      await readFile(path.resolve(source, decodeURIComponent(uri))),
    ),
});
const reportFinal = await validator.validateBytes(new Uint8Array(final), {
  uri: "steam-turbine.glb",
});
await writeFile(
  ".private/model-audit/source-validation.json",
  JSON.stringify(reportSource, null, 2),
);
await writeFile(
  ".private/model-audit/optimized-validation.json",
  JSON.stringify(reportFinal, null, 2),
);
if (reportSource.issues.numErrors || reportFinal.issues.numErrors)
  throw Error("glTF validation failed; inspect private reports");
const stats = (g) => ({
  rendered_triangles: g.nodes
    .filter((n) => n.mesh !== undefined)
    .reduce(
      (sum, n) =>
        sum +
        g.meshes[n.mesh].primitives.reduce(
          (a, p) => a + g.accessors[p.indices].count / 3,
          0,
        ) *
          (n.extensions?.EXT_mesh_gpu_instancing
            ? g.accessors[
                Object.values(
                  n.extensions.EXT_mesh_gpu_instancing.attributes,
                )[0]
              ].count
            : 1),
      0,
    ),
  nodes: g.nodes?.length ?? 0,
  meshes: g.meshes?.length ?? 0,
  materials: g.materials?.length ?? 0,
  textures: g.images?.length ?? 0,
  primitives: g.meshes.reduce((n, m) => n + m.primitives.length, 0),
  triangles: g.meshes.reduce(
    (n, m) =>
      n +
      m.primitives.reduce((s, p) => s + g.accessors[p.indices].count / 3, 0),
    0,
  ),
  extensions: g.extensionsUsed ?? [],
});
const manifest = {
  title: "Steam Turbine",
  author: "landinweaver",
  author_url: "https://sketchfab.com/landinweaver",
  license: "CC-BY-4.0",
  license_url: "https://creativecommons.org/licenses/by/4.0/",
  acquired: "2026-10-28",
  acquisition:
    "Owner-provided downloaded steam_turbine.zip with matching embedded source/author/license metadata",
  original_archive: path.basename(archive),
  archive_sha256: sha(zip),
  source_gltf_sha256: sha(files["scene.gltf"]),
  source_glb_bytes: (await readFile(path.join(source, "source-preview.glb")))
    .length,
  source_url:
    "https://sketchfab.com/3d-models/steam-turbine-bcc264eafbe4412d9c061d6d97f30b99",
  original_stats: stats(original),
  optimized_stats: stats(packed),
  file: "/models/steam-turbine.glb",
  bytes: final.length,
  sha256: sha(final),
  transformations:
    "glTF Transform 4.5.1: merge/weld/prune/instance; remove only the identified backdrop wall/floor planes Object_44/Object_46; no turbine mesh simplification; maximum 1024px WebP textures; Meshopt compression. Materials and geometry retained; representative equipment, not a Kamojang digital twin.",
  validation: {
    source_errors: reportSource.issues.numErrors,
    source_warnings: reportSource.issues.numWarnings,
    optimized_errors: reportFinal.issues.numErrors,
    optimized_warnings: reportFinal.issues.numWarnings,
  },
};

await writeFile(path.join(out, "LICENSE.txt"), license);
await writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify(manifest, null, 2));
