import { useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";

// ---------- Brand mark ----------

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="brand-mark"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l5-5 4 4 7-8" />
        <path d="M15 8h5v5" />
      </svg>
    </span>
  );
}

// ---------- Badge ----------

export type BadgeTone = "success" | "warning" | "critical" | "neutral" | "brand" | "purple" | "teal";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge b-${tone}`}>{children}</span>;
}

// ---------- Button ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", block, icon, children, ...rest }: ButtonProps) {
  const cls = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", block ? "btn-block" : ""].filter(Boolean).join(" ");
  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = "secondary", size = "md", icon, children }: { to: string; variant?: ButtonVariant; size?: "md" | "sm"; icon?: ReactNode; children: ReactNode }) {
  const cls = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : ""].filter(Boolean).join(" ");
  return (
    <Link to={to} className={cls}>
      {icon}
      {children}
    </Link>
  );
}

// ---------- Avatar ----------

const AVATAR_COLORS: [string, string][] = [
  ["#E8ECFC", "#2B44AE"],
  ["#FFF0DB", "#874600"],
  ["#E1F4F0", "#0A6657"],
  ["#F2EAFB", "#6A36A6"],
  ["#FBE8F1", "#97285E"],
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) % 997;
  return hash;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const a = words[0][0] ?? "";
  const b = words.length > 1 ? words[1][0] : (words[0][1] ?? "");
  return (a + b).toUpperCase();
}

export function Avatar({ name, imageUrl, size = 28 }: { name: string; imageUrl?: string | null; size?: number }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="avatar"
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    );
  }
  const [bg, fg] = AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, color: fg }}>
      {initialsOf(name)}
    </span>
  );
}

// ---------- App badge (colored initials square, used in sidebar + apps table) ----------

const APP_BADGE_COLORS = ["#3E5BD6", "#E0702A", "#0F9D86", "#8B4FC9", "#C23A7A", "#8F7400"];

export function appBadgeColor(name: string): string {
  return APP_BADGE_COLORS[hashString(name) % APP_BADGE_COLORS.length];
}

export function AppBadge({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`app-badge${large ? " app-badge-lg" : ""}`} style={{ background: appBadgeColor(name) }}>
      {initialsOf(name)}
    </span>
  );
}

// ---------- Segmented control ----------

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`seg-btn${opt.value === value ? " is-on" : ""}`}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Select (native select styled as dropdown) ----------

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  ariaLabel: string;
  style?: React.CSSProperties;
}) {
  return (
    <select
      className="select"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------- Password field with show/hide ----------

export function PasswordField({
  id,
  label,
  name,
  value,
  onChange,
  autoComplete,
  helpText,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  helpText?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="pw">
        <input
          id={id}
          className="input"
          type={revealed ? "text" : "password"}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={revealed ? "Hide password" : "Show password"}
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {helpText && (
        <span className="muted" style={{ fontSize: 12 }}>
          {helpText}
        </span>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1" />
      <path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

// ---------- Line chart (SVG, hover tooltip) ----------

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

export function LineChart({
  series,
  labels,
  area = false,
  zeroBased = false,
  small = false,
  formatValue = (v: number) => String(Math.round(v)),
  formatTooltip,
  showLegend = false,
  legendMetric = "last",
}: {
  series: ChartSeries[];
  labels: string[];
  area?: boolean;
  zeroBased?: boolean;
  small?: boolean;
  formatValue?: (v: number) => string;
  formatTooltip?: (v: number) => string;
  showLegend?: boolean;
  legendMetric?: "total" | "last";
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const n = labels.length;
  const tipFmt = formatTooltip ?? formatValue;

  let max = -Infinity;
  let min = Infinity;
  series.forEach((s) => s.values.forEach((v) => {
    if (v > max) max = v;
    if (v < min) min = v;
  }));
  if (!isFinite(max)) {
    max = 1;
    min = 0;
  }
  if (zeroBased) {
    min = 0;
  } else {
    const pad = (max - min) * 0.25 || max * 0.1 || 1;
    min = Math.max(0, min - pad);
  }
  max = max + (max - min) * 0.08;
  if (max <= min) max = min + 1;

  const yOf = (v: number) => 190 - ((v - min) / (max - min)) * 180;
  const xOf = (i: number) => (n < 2 ? 0 : (i / (n - 1)) * 600);

  const lines = series.map((s) => {
    const pts = s.values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    return {
      color: s.color,
      points: pts,
      areaPoints: area ? `${pts} 600,200 0,200` : "0,200 0,200 0,200",
      fill: area ? `${s.color}1A` : "none",
    };
  });

  const yTicks = [0, 1, 2, 3].map((k) => ({
    label: formatValue(max - ((max - min) * k) / 3),
    top: `${5 + 30 * k}%`,
  }));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => labels[Math.round(f * (n - 1))] ?? "");

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
    setHoverIndex(idx);
  }

  const hov = hoverIndex !== null && hoverIndex < n;
  let guideLeft = "0%";
  let dots: { color: string; left: string; top: string }[] = [];
  let tipDate = "";
  let tipRows: { color: string; name: string; value: string }[] = [];
  let tipLeft = "0";
  let tipTx = "none";

  if (hov && hoverIndex !== null) {
    const i = hoverIndex;
    const lp = xOf(i) / 6;
    guideLeft = `${lp}%`;
    dots = series.map((s) => ({ color: s.color, left: `${lp}%`, top: `${yOf(s.values[i]) / 2}%` }));
    tipDate = labels[i] ?? "";
    tipRows = series.map((s) => ({ color: s.color, name: s.name, value: tipFmt(s.values[i] ?? 0) }));
    tipLeft = lp > 60 ? `calc(${lp}% - 14px)` : `calc(${lp}% + 14px)`;
    tipTx = lp > 60 ? "translateX(-100%)" : "none";
  }

  const legend = series.map((s) => ({
    name: s.name,
    color: s.color,
    total: formatValue(s.values.reduce((a, b) => a + b, 0)),
    value: tipFmt(s.values[n - 1] ?? 0),
  }));

  return (
    <>
      <div className={`chart${small ? " chart-sm" : ""}`}>
        <div className="chart-y">
          {yTicks.map((t, i) => (
            <span key={i} style={{ top: t.top }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="chart-plot" onMouseMove={handleMove} onMouseLeave={() => setHoverIndex(null)}>
          <span className="gl" style={{ top: "5%" }} />
          <span className="gl" style={{ top: "35%" }} />
          <span className="gl" style={{ top: "65%" }} />
          <span className="gl gl-base" style={{ top: "95%" }} />
          {lines.map((l, i) => (
            <svg key={i} className="chart-svg" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden>
              <polygon points={l.areaPoints} fill={l.fill} stroke="none" />
              <polyline
                points={l.points}
                fill="none"
                stroke={l.color}
                strokeWidth={series.length > 1 ? 1.75 : 2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          ))}
          {hov && (
            <>
              <span className="chart-guide" style={{ left: guideLeft }} />
              {dots.map((d, i) => (
                <span key={i} className="chart-dot" style={{ left: d.left, top: d.top, background: d.color }} />
              ))}
              <div className="chart-tip" style={{ left: tipLeft, transform: tipTx }}>
                <div className="tip-date">{tipDate}</div>
                {tipRows.map((r, i) => (
                  <div key={i} className="tip-row">
                    <span className="swatch" style={{ background: r.color }} />
                    <span className="tip-name">{r.name}</span>
                    <span className="tip-val">{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="chart-x">
        {xTicks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      {showLegend && (
        <div className="legend">
          {legend.map((l, i) => (
            <span key={i} className="legend-item">
              <span className="swatch" style={{ background: l.color }} />
              {l.name} <span className="num" style={{ color: "#17171C", fontWeight: 500 }}>{legendMetric === "total" ? l.total : l.value}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
