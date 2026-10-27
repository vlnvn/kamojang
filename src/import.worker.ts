import { importFile } from "./import";
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const dataset = await importFile(event.data, (message) =>
      self.postMessage({ type: "progress", message }),
    );
    self.postMessage({ type: "done", dataset });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Berkas gagal diproses.",
    });
  }
};
