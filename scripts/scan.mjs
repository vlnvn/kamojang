import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const staged = process.argv.includes("--staged");
const files = execFileSync(
  "git",
  staged ? ["diff", "--cached", "--name-only", "-z"] : ["ls-files", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const forbidden =
  /(^|\/)(\.private|\.venv|node_modules|dist|test-results|playwright-report)(\/|$)|\.(xlsx|pdf|zip|env|pem|key)$|(^|\/)\.env|CODEX_MASTERPROMPT|KAMOJANG_CODEX_CONTINUATION|source-preview|kamojang_(?:clean_rows|anomaly_screen|dashboard_data|results|forecast_holdout)\.(?:csv|json)$/;
const secrets = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sk-[A-Za-z0-9]{40,}/,
];
// Original handoff fingerprints also catch renamed copies of restricted inputs.
const restrictedHashes = new Set([
  "95d9373844860251f2589afe8e6585a715e2e549ad17a1ffcfbb5797126e16dd",
  "3446f0a50ace972b8afa05225904a93ff7de7d199c95410744b4c9c791ec1109",
  "504ad839720a5bedf5b1759db8cf31425b93c62182b927db7ee4b969553abd2e",
  "091a2de74329f06da465d46a3b73c4abac01a4534dc5ad0d41f6a1f33e486566",
]);
let errors = 0;
for (const file of files) {
  if (forbidden.test(file)) {
    console.error("Forbidden tracked path:", file);
    errors++;
    continue;
  }
  const bytes = staged
    ? execFileSync("git", ["show", `:${file}`], { maxBuffer: 32 * 1024 * 1024 })
    : readFileSync(file);
  if (restrictedHashes.has(createHash("sha256").update(bytes).digest("hex"))) {
    console.error("Restricted original fingerprint:", file);
    errors++;
  }
  if (/\.(png|webp|glb|woff2?)$/.test(file)) continue;
  const text = bytes.toString("utf8");
  if (secrets.some((re) => re.test(text))) {
    console.error("Potential credential in:", file);
    errors++;
  }
}
if (errors) process.exit(1);
console.log(
  `PASS: ${files.length} ${staged ? "staged" : "tracked"} paths scanned; no forbidden inputs or recognized secret patterns. This is a bounded pattern scan, not a security audit.`,
);
