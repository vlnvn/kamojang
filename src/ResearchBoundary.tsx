import { Component, type ReactNode } from "react";
export default class ResearchBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="error" role="alert">
        Modul eksperimen tidak dapat dimuat. Analisis utama tetap tersedia.
        Simpan ekspor Anda sebelum memuat ulang halaman untuk mencoba kembali.
      </p>
    ) : (
      this.props.children
    );
  }
}
