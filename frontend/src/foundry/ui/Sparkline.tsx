import type { JudgeAction } from "../intel";

export interface SparklinePoint {
  index: number;
  score: number;
  delta?: number;
  action?: JudgeAction;
  label?: string;
}

export interface SparklineProps {
  points: SparklinePoint[];
  selectedIndex?: number | null;
  onSelectPoint?: (index: number) => void;
  title?: string;
}

const W = 420;
const H = 112;
const PAD_L = 34;
const PAD_R = 18;
const PAD_T = 14;
const PAD_B = 22;

function dotColor(point: SparklinePoint): string {
  if (point.action === "SURVIVE" || point.score >= 0.95) return "var(--ok)";
  if (point.action === "PRUNE" || point.score < 0.6) return "var(--danger)";
  return "var(--accent)";
}

export function Sparkline({
  points,
  selectedIndex = null,
  onSelectPoint,
  title = "DRC Fitness Trajectory",
}: SparklineProps) {
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const maxStep = Math.max(7, points.length - 1);

  const coords = points.map((p, idx) => {
    const x = PAD_L + (idx / Math.max(1, maxStep)) * innerW;
    const clamped = Math.max(0, Math.min(1, p.score));
    const y = PAD_T + (1 - clamped) * innerH;
    return { ...p, x, y };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`
      : "";

  const targetY = PAD_T + (1 - 0.95) * innerH;
  const bestScore = points.reduce((best, p) => Math.max(best, p.score), 0);

  return (
    <div className="foundry-sparkline-box">
      <div className="spread">
        <span className="mono xs dim">{title}</span>
        <span className="mono xs">
          Best:{" "}
          <strong className={bestScore >= 0.95 ? "good" : ""}>
            {(bestScore * 100).toFixed(0)}% ({bestScore.toFixed(2)})
          </strong>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="foundry-sparkline-svg"
        role="img"
        aria-label={`${title}: ${points.length} steps, best score ${bestScore.toFixed(2)}`}
      >
        <defs>
          <linearGradient id="foundry-spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal reference lines (1.0, 0.5, 0.0) */}
        {[1, 0.5, 0].map((val) => {
          const y = PAD_T + (1 - val) * innerH;
          return (
            <g key={val}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="var(--edge)"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={y + 3}
                textAnchor="end"
                className="foundry-spark-axis"
                fill="var(--text-dim)"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Sapling IPC-2221 certification line */}
        <line
          x1={PAD_L}
          y1={targetY}
          x2={W - PAD_R}
          y2={targetY}
          stroke="var(--ok)"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.7"
        />

        {/* Area & climbing line */}
        {areaPath && <path d={areaPath} fill="url(#foundry-spark-grad)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {coords.map((c) => {
          const selected = selectedIndex === c.index;
          const color = dotColor(c);
          return (
            <g
              key={`pt-${c.index}`}
              transform={`translate(${c.x}, ${c.y})`}
              className={onSelectPoint ? "foundry-spark-node clickable" : "foundry-spark-node"}
              onClick={() => onSelectPoint?.(c.index)}
            >
              {selected && (
                <circle
                  cx="0"
                  cy="0"
                  r="8"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                />
              )}
              <circle
                cx="0"
                cy="0"
                r={selected ? "5" : "4"}
                fill={color}
                stroke="var(--panel)"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y={H - c.y - 4}
                textAnchor="middle"
                className="foundry-spark-axis"
                fill={selected ? "var(--text)" : "var(--text-dim)"}
              >
                {`G${c.index}`}
              </text>
              <title>
                {`Gen #${c.index}: score ${c.score.toFixed(2)}${c.action ? ` (${c.action})` : ""}`}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
