import { Component, type ReactNode } from "react";

export default class ViewerBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="turbine-status">
        <img
          src="/models/steam-turbine-poster.webp"
          alt="Render statis dari mesh Steam Turbine oleh landinweaver"
        />
        <p role="alert">
          Modul tampilan 3D tidak tersedia. Analisis tetap dapat digunakan. Muat
          ulang halaman untuk mencoba kembali.
        </p>
      </div>
    );
  }
}
