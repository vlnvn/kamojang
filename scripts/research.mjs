import { spawn } from "node:child_process";
const preview = process.argv.includes("--preview");
const children = [];
const stop = () => {
  for (const child of children) child.kill();
};
const python = spawn(
  process.env.KAMOJANG_PYTHON ?? "python",
  ["scripts/research_server.py"],
  { stdio: "inherit", windowsHide: true },
);
children.push(python);
python.on("error", () => {
  console.error(
    "Python tidak tersedia. Instal persyaratan riset atau gunakan npm run dev untuk analisis robust.",
  );
  stop();
  process.exitCode = 1;
});
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    ...(preview ? ["preview"] : []),
    "--host",
    "127.0.0.1",
    "--port",
    preview ? "4173" : "5173",
    "--strictPort",
  ],
  { stdio: "inherit", windowsHide: true },
);
children.push(vite);
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
