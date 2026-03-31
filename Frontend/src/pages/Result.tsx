import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";

interface HourlyPoint {
  time: Date;
  pv: number;
}

interface ChartPoint {
  label: string;
  pv: number;
}
function DailyYieldCard({ points }: { points: HourlyPoint[] }) {
  const [systemKw, setSystemKw] = useState(4);

  const now = new Date();
  const todayPoints = points.filter(
    (p) => p.time.toDateString() === now.toDateString(),
  );

  const totalYield = todayPoints.reduce((sum, p) => sum + p.pv, 0) * systemKw;
  const completed = todayPoints.filter((p) => p.time <= now).length;
  const remaining = todayPoints.filter((p) => p.time > now).length;
  const soFar =
    todayPoints.filter((p) => p.time <= now).reduce((sum, p) => sum + p.pv, 0) *
    systemKw;

  return (
    <div className="result-chart-card">
      <div className="result-chart-header">
        <div className="result-chart-title">Daily Energy Yield</div>
        <div className="result-chart-subtitle">
          Estimated output for a {systemKw}kW system
        </div>
      </div>

      {/* Installed capacity input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <span style={{ fontSize: "0.8rem", color: "#888" }}>
          Installed capacity
        </span>
        <input
          type="number"
          min={0.5}
          max={100}
          step={0.5}
          value={systemKw}
          onChange={(e) =>
            setSystemKw(Math.max(0.5, parseFloat(e.target.value) || 4))
          }
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "6px",
            color: "inherit",
            fontSize: "1rem",
            fontWeight: "600",
            padding: "4px 8px",
            width: "70px",
            textAlign: "center",
          }}
        />
        <span style={{ fontSize: "0.8rem", color: "#888" }}>kW</span>
      </div>

      <div className="result-stats-row">
        <div className="result-stat-card">
          <div className="result-stat-label">Total Today</div>
          <div className="result-stat-value result-stat-value--yellow">
            {totalYield.toFixed(2)}
          </div>
          <div className="result-stat-unit">kWh</div>
        </div>
        <div className="result-stat-card">
          <div className="result-stat-label">Generated So Far</div>
          <div className="result-stat-value">{soFar.toFixed(2)}</div>
          <div className="result-stat-unit">kWh · {completed}hrs</div>
        </div>
        <div className="result-stat-card">
          <div className="result-stat-label">Still Expected</div>
          <div className="result-stat-value result-stat-value--blue">
            {(totalYield - soFar).toFixed(2)}
          </div>
          <div className="result-stat-unit">kWh · {remaining}hrs</div>
        </div>
      </div>
    </div>
  );
}

function getRating(pv: number) {
  if (pv > 0.7) return { label: "Excellent", cls: "rating--excellent" };
  if (pv > 0.4) return { label: "Good", cls: "rating--good" };
  if (pv > 0.1) return { label: "Moderate", cls: "rating--moderate" };
  return { label: "Low", cls: "rating--low" };
}

function formatHour(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ── Pure SVG area chart ───────────────────────────────────────
interface SvgChartProps {
  data: ChartPoint[];
  stroke: string;
  gradientId: string;
  gradientColor: string;
  nowLabel?: string;
  xInterval?: number;
  height?: number;
}

function SvgAreaChart({
  data,
  stroke,
  gradientId,
  gradientColor,
  nowLabel,
  xInterval = 1,
  height = 220,
}: SvgChartProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    point: ChartPoint;
  } | null>(null);

  const W = 700;
  const H = height;
  const PAD = { top: 12, right: 12, bottom: 36, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (!data.length) return null;

  const xStep = innerW / (data.length - 1 || 1);

  const pts = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + innerH - d.pv * innerH,
    ...d,
  }));

  const lineD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");
  const areaD = `${lineD} L ${pts[pts.length - 1].x},${PAD.top + innerH} L ${pts[0].x},${PAD.top + innerH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  const nowIdx = nowLabel ? data.findIndex((d) => d.label === nowLabel) : -1;
  const nowX = nowIdx >= 0 ? PAD.left + nowIdx * xStep : null;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width) - PAD.left;
    const idx = Math.min(Math.max(Math.round(mx / xStep), 0), data.length - 1);
    setTooltip({ x: pts[idx].x, y: pts[idx].y, point: data[idx] });
  }

  return (
    <div className="svg-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="svg-chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={gradientColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((t) => {
          const gy = PAD.top + innerH - t * innerH;
          return (
            <line
              key={t}
              x1={PAD.left}
              y1={gy}
              x2={PAD.left + innerW}
              y2={gy}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          );
        })}

        {/* Area + line */}
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path
          d={lineD}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Now reference line */}
        {nowX !== null && (
          <>
            <line
              x1={nowX}
              y1={PAD.top}
              x2={nowX}
              y2={PAD.top + innerH}
              stroke="#f97316"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text x={nowX + 4} y={PAD.top + 11} fill="#f97316" fontSize="10">
              Now
            </text>
          </>
        )}

        {/* Y-axis labels */}
        {yTicks.map((t) => (
          <text
            key={t}
            x={PAD.left - 6}
            y={PAD.top + innerH - t * innerH + 4}
            textAnchor="end"
            fill="#555"
            fontSize="10"
          >
            {t.toFixed(2)}
          </text>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % xInterval !== 0 ? null : (
            <text
              key={i}
              x={PAD.left + i * xStep}
              y={PAD.top + innerH + 18}
              textAnchor="middle"
              fill="#555"
              fontSize="10"
            >
              {d.label}
            </text>
          ),
        )}

        {/* Hover dot */}
        {tooltip && (
          <>
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r="7"
              fill={stroke}
              fillOpacity="0.15"
            />
            <circle cx={tooltip.x} cy={tooltip.y} r="3.5" fill={stroke} />
          </>
        )}
      </svg>

      {/* Tooltip bubble */}
      {tooltip && (
        <div
          className="svg-tooltip"
          style={{
            left: `${(tooltip.x / W) * 100}%`,
            top: `${(tooltip.y / H) * 100}%`,
          }}
        >
          <div className="svg-tooltip-label">{tooltip.point.label}</div>
          <div className="svg-tooltip-value">
            {tooltip.point.pv.toFixed(4)} kW/kW
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

export default function Result() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state?.pvOutput || !state?.hourlyPV) {
    return (
      <div className="container result-empty">
        <p className="result-empty-text">No results data found.</p>
        <button className="main-button" onClick={() => navigate("/")}>
          ← Back
        </button>
      </div>
    );
  }

  const { pvOutput, hourlyPV, location } = state as {
    pvOutput: number;
    hourlyPV: HourlyPoint[];
    location: number[];
  };

  const points: HourlyPoint[] = hourlyPV.map((p: any) => ({
    ...p,
    time: new Date(p.time),
  }));

  const now = new Date();

  const todayPoints = points.filter(
    (p) => p.time.toDateString() === now.toDateString(),
  );

  const todayChartData: ChartPoint[] = todayPoints.map((p) => ({
    label: formatHour(p.time),
    pv: parseFloat(p.pv.toFixed(4)),
  }));

  const byDay: Record<string, number> = {};
  points.forEach((p) => {
    const key = p.time.toDateString();
    if (!byDay[key] || p.pv > byDay[key]) byDay[key] = p.pv;
  });

  const weekChartData: ChartPoint[] = Object.entries(byDay)
    .slice(0, 7)
    .map(([dateStr, pv]) => ({
      label: formatDate(new Date(dateStr)),
      pv: parseFloat(pv.toFixed(4)),
    }));

  const rating = getRating(pvOutput);
  const currentHourLabel = formatHour(now);

  const todayPeak = todayPoints.length
    ? Math.max(...todayPoints.map((p) => p.pv)).toFixed(4)
    : "—";

  const productiveHours = todayPoints.filter((p) => p.pv > 0.05).length;

  const weekPeak = weekChartData.length
    ? Math.max(...weekChartData.map((d) => d.pv)).toFixed(4)
    : "—";

  return (
    <div className="container result-container">
      <div className="result-topbar">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        {location && (
          <span className="result-coords">
            {location[0]?.toFixed(4)}°, {location[1]?.toFixed(4)}°
          </span>
        )}
      </div>

      <div className="result-header">
        <h1 className="result-title">PV Results</h1>
        <p className="result-subtitle">
          Solar generation forecast for your location
        </p>
      </div>

      {/* Hero card */}
      <div className={`result-hero-card ${rating.cls}`}>
        <div className="result-hero-left">
          <div className="result-hero-label"> Current Predicted Output</div>
          <div className="result-hero-value">{pvOutput.toFixed(4)}</div>
          <div className="result-hero-unit">kW per kW installed capacity</div>
        </div>
        <div className="result-hero-right">
          <div className={`result-rating-badge ${rating.cls}`}>
            {rating.label}
          </div>
          <div className="result-rating-label">Efficiency rating</div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="result-stats-row">
        <div className="result-stat-card">
          <div className="result-stat-label">Today's Peak</div>
          <div className="result-stat-value result-stat-value--yellow">
            {todayPeak}
          </div>
          <div className="result-stat-unit">kW/kW</div>
        </div>
        <div className="result-stat-card">
          <div className="result-stat-label">Productive Hours</div>
          <div className="result-stat-value">{productiveHours}</div>
          <div className="result-stat-unit">hrs &gt; 5% today</div>
        </div>
        <div className="result-stat-card">
          <div className="result-stat-label">7-Day Peak</div>
          <div className="result-stat-value result-stat-value--blue">
            {weekPeak}
          </div>
          <div className="result-stat-unit">kW/kW</div>
        </div>
      </div>

      {/* Today's hourly chart */}
      <div className="result-chart-card">
        <DailyYieldCard points={points} />
        <div className="result-chart-header">
          <div className="result-chart-title">☀ Hourly PV Output — Today</div>
          <div className="result-chart-subtitle">
            Estimated generation across the day
          </div>
        </div>
        {todayChartData.length === 0 ? (
          <p className="result-chart-empty">
            No hourly data available for today.
          </p>
        ) : (
          <SvgAreaChart
            data={todayChartData}
            stroke="#fbbf24"
            gradientId="pvGradientToday"
            gradientColor="#fbbf24"
            nowLabel={currentHourLabel}
            xInterval={3}
            height={220}
          />
        )}
      </div>

      {/* 7-day chart */}
      <div className="result-chart-card">
        <div className="result-chart-header">
          <div className="result-chart-title">7-Day Daily Peak PV Output</div>
          <div className="result-chart-subtitle">
            Best generation expected each day
          </div>
        </div>
        <SvgAreaChart
          data={weekChartData}
          stroke="#38bdf8"
          gradientId="pvGradientWeek"
          gradientColor="#38bdf8"
          xInterval={1}
          height={200}
        />
      </div>
    </div>
  );
}