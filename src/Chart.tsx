import { dateLabel, format, type Assessment, type Reference } from "./domain";
export function Chart({
  events,
  reference,
  onSelect,
  selected,
}: {
  events: Assessment[];
  reference: Reference;
  onSelect: (id: string) => void;
  selected: string | undefined;
}) {
  const start = Date.parse(events[0].date),
    end = Date.parse(events.at(-1)!.date);
  const values = [
    ...events.map((a) => a.actual),
    reference.lower,
    reference.upper,
  ];
  const min = Math.min(...values),
    max = Math.max(...values);
  const pad = (max - min) * 0.12 || 1;
  const low = min - pad,
    high = max + pad;
  const x = (d: string) =>
    35 + ((Date.parse(d) - start) / (end - start || 1)) * 805;
  const y = (n: number) => 297 - ((n - low) / (high - low)) * 257;
  const years = [...new Set(events.map((a) => a.date.slice(0, 4)))];
  return (
    <svg
      className="chart"
      viewBox="0 0 850 390"
      role="img"
      aria-label={`Grafik ${events[0].sensor}, sumbu tanggal aktual; tabel pengukuran tersedia di bawah.`}
    >
      <title>Pengukuran dan acuan median robust</title>
      <rect
        x="35"
        width="805"
        y={y(reference.upper)}
        height={Math.max(1, y(reference.lower) - y(reference.upper))}
        fill="#deebe3"
      />
      {Array.from({ length: 5 }, (_, i) => {
        const n = high - ((high - low) * i) / 4;
        return (
          <g key={i}>
            <line x1="35" x2="840" y1={y(n)} y2={y(n)} stroke="#e7e9e2" />
            <text x="27" y={y(n) + 4} textAnchor="end">
              {format(n, 2)}
            </text>
          </g>
        );
      })}
      {years.map((year) => {
        const d = `${year}-07-01`;
        const px = x(d);
        return px >= 35 && px <= 840 ? (
          <g key={year}>
            <line x1={px} x2={px} y1="40" y2="297" stroke="#f1f2ee" />
            <text x={px} y="350" textAnchor="middle">
              {year}
            </text>
          </g>
        ) : null;
      })}
      <line
        x1="35"
        x2="840"
        y1={y(reference.median)}
        y2={y(reference.median)}
        stroke="#7caa9b"
        strokeDasharray="5 5"
      />
      <polyline
        points={events.map((a) => `${x(a.date)},${y(a.actual)}`).join(" ")}
        fill="none"
        stroke="#23685e"
        strokeWidth="2"
      />
      {events.map((a) => (
        <g
          key={a.measurement_id}
          className="chart-point"
          onClick={() => onSelect(a.measurement_id)}
        >
          <circle
            cx={x(a.date)}
            cy={y(a.actual)}
            r={a.measurement_id === selected ? 8 : a.flagged ? 6 : 3}
            fill={a.flagged ? "#b74121" : "#23685e"}
            stroke={a.measurement_id === selected ? "#152721" : "#fff"}
            strokeWidth={a.measurement_id === selected ? 2 : 1}
          />
          <circle cx={x(a.date)} cy={y(a.actual)} r="12" fill="transparent">
            <title>
              {dateLabel(a.date)} · baris {a.source_row}: {format(a.actual)}{" "}
              {a.unit} · Z {format(a.z)}
              {a.flagged ? " · Indikasi" : ""}
            </title>
          </circle>
        </g>
      ))}
      <text x="35" y="385">
        Tanggal pengukuran · tanggal yang sama tidak digeser atau digabung
      </text>
    </svg>
  );
}
