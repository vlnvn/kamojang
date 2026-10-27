import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const staged = process.argv.includes("--staged");
const files = execFileSync(
  "git",
  staged ? ["diff", "--cached", "--name-only", "-z"] : ["ls-files", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const forbidden =
  /(^|\/)(\.private|\.venv|node_modules|dist|test-results|playwright-report)(\/|$)|\.(xlsx|pdf|zip|env|pem|key)$|(^|\/)\.env|CODEX_MASTERPROMPT/;
const secrets = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sk-[A-Za-z0-9]{40,}/,
];
let errors = 0;
for (const file of files) {
  if (forbidden.test(file)) {
    console.error("Forbidden tracked path:", file);
    errors++;
    continue;
  }
  const bytes = staged
    ? execFileSync("git", ["show", `:${file}`])
    : readFileSync(file);
  if (/\.(png|woff2?)$/.test(file)) continue;
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
