import { useState } from "react";
import type { BoardState, Pad, Trace, Violation } from "../core/types";

const CELL = 44;
const HALF = CELL / 2;

/**
 * Deterministic, high-contrast net color palette tuned for the SolderSight
 * case-file paper surface and dark photo overlays alike.
 */
const NET_PALETTE: Record<string, string> = {
  VIN: "#d97706",
  NET_VCC: "#d97706",
  VCC: "#d97706",
  VBUS: "#d97706",
  VREF: "#d97706",
  VFILT: "#0f766e",
  VOUT: "#0f766e",
  SENSE_P: "#0f766e",
  DP: "#0f766e",
  NET_CLK: "#2563eb",
  SW: "#2563eb",
  SENSE_N: "#2563eb",
  DM: "#2563eb",
  GND: "#475569",
  PGND: "#475569",
  NET_GND: "#475569",
  NET_SDA: "#7c3aed",
};

const FALLBACK_NET_COLORS = [
  "#d97706",
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#be185d",
  "#047857",
];

export function netColor(net: string, index = 0): string {
  if (NET_PALETTE[net]) return NET_PALETTE[net];
  let hash = index;
  for (let i = 0; i < net.length; i++) {
    hash = (hash * 31 + net.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_NET_COLORS[hash % FALLBACK_NET_COLORS.length];
}

function cellCenter(x: number, y: number): [number, number] {
  return [x * CELL + HALF, y * CELL + HALF];
}

function traceToSvgPath(trace: Trace): string {
  if (!trace.path.length) return "";
  return trace.path
    .map(([x, y], idx) => {
      const [cx, cy] = cellCenter(x, y);
      return `${idx === 0 ? "M" : "L"} ${cx} ${cy}`;
    })
    .join(" ");
}

function violationKey(v: Violation): string {
  return `${v.kind}:${v.at[0]},${v.at[1]}`;
}

export interface BoardCanvasProps {
  board: BoardState;
  /** Optional prior board state to show ghosted pre-repair / pre-mutation traces. */
  previousBoard?: BoardState | null;
  /** Defects that were repaired in earlier steps (rendered green in Heal mode). */
  healedDefects?: Violation[];
  /** Currently active defect being repaired. */
  activeDefect?: Violation | null;
  /** Optional underlying DeepPCB inspection photo URL (Heal mode). */
  backgroundImageUrl?: string | null;
  /** Whether to show the real board photo behind the vector copper overlay. */
  showPhotoUnderlay?: boolean;
  /** Key that increments when a new step streams in to re-trigger trace draw animation. */
  stepKey?: string | number;
  /** Accessible label for the board canvas. */
  ariaLabel?: string;
}

export function BoardCanvas({
  board,
  previousBoard = null,
  healedDefects = [],
  activeDefect = null,
  backgroundImageUrl = null,
  showPhotoUnderlay = false,
  stepKey = 0,
  ariaLabel = "Foundry PCB layout canvas",
}: BoardCanvasProps) {
  const [imgError, setImgError] = useState(false);
  const [hoveredNet, setHoveredNet] = useState<string | null>(null);

  const width = Math.max(1, board.w) * CELL;
  const height = Math.max(1, board.h) * CELL;

  const uniqueNets = Array.from(
    new Set([
      ...board.pads.map((p) => p.net),
      ...board.traces.map((t) => t.net),
    ]),
  );

  // Deduplicate active violations by kind+coord
  const activeViolations: Violation[] = [];
  const seenViolations = new Set<string>();
  const rawViolations =
    board.violations && board.violations.length > 0
      ? board.violations
      : (board.defects ?? []);
  for (const v of rawViolations) {
    const k = violationKey(v);
    if (!seenViolations.has(k)) {
      seenViolations.add(k);
      activeViolations.push(v);
    }
  }

  // Only show healed defects that are no longer active violations
  const resolvedDefects = healedDefects.filter(
    (d) => !seenViolations.has(violationKey(d)),
  );

  const showPhoto = Boolean(backgroundImageUrl && showPhotoUnderlay && !imgError);

  return (
    <div className="foundry-canvas-wrap">
      <div
        className={`foundry-board-stage${showPhoto ? " has-photo" : ""}`}
        style={{ aspectRatio: `${board.w} / ${board.h}` }}
      >
        {backgroundImageUrl && showPhotoUnderlay && !imgError && (
          <img
            src={backgroundImageUrl}
            alt="DeepPCB reference board underlay"
            className="foundry-underlay-img"
            onError={() => setImgError(true)}
          />
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="foundry-svg"
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <pattern
              id="foundry-grid-pattern"
              width={CELL}
              height={CELL}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${CELL} 0 L 0 0 0 ${CELL}`}
                fill="none"
                stroke={showPhoto ? "rgba(255,255,255,0.16)" : "var(--edge)"}
                strokeWidth="1"
              />
              <circle
                cx={HALF}
                cy={HALF}
                r="1.3"
                fill={showPhoto ? "rgba(255,255,255,0.28)" : "var(--panel-border)"}
              />
            </pattern>
          </defs>

          {/* Substrate + grid */}
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            rx="8"
            fill={showPhoto ? "rgba(14, 20, 24, 0.58)" : "var(--panel)"}
          />
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            rx="8"
            fill="url(#foundry-grid-pattern)"
          />

          {/* Coordinate ruler ticks along top and left edges */}
          <g className="foundry-ruler" aria-hidden="true">
            {Array.from({ length: board.w }, (_, x) => (
              <text
                key={`col-${x}`}
                x={x * CELL + HALF}
                y={11}
                textAnchor="middle"
                className="foundry-coord-label"
                fill={showPhoto ? "rgba(255,255,255,0.65)" : "var(--text-dim)"}
              >
                {x}
              </text>
            ))}
            {Array.from({ length: board.h }, (_, y) => (
              <text
                key={`row-${y}`}
                x={8}
                y={y * CELL + HALF + 3}
                textAnchor="start"
                className="foundry-coord-label"
                fill={showPhoto ? "rgba(255,255,255,0.65)" : "var(--text-dim)"}
              >
                {y}
              </text>
            ))}
          </g>

          {/* Ghost traces from previous step (shows what changed during reroute/heal) */}
          {previousBoard &&
            previousBoard.traces.map((ghost, idx) => {
              const d = traceToSvgPath(ghost);
              if (!d) return null;
              return (
                <path
                  key={`ghost-${ghost.net}-${idx}`}
                  d={d}
                  fill="none"
                  stroke={showPhoto ? "rgba(255,255,255,0.28)" : "var(--panel-border)"}
                  strokeWidth="6"
                  strokeDasharray="5 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.65"
                />
              );
            })}

          {/* Routed Copper Traces */}
          <g className="foundry-traces">
            {board.traces.map((trace, idx) => {
              const d = traceToSvgPath(trace);
              if (!d) return null;
              const color = netColor(trace.net, uniqueNets.indexOf(trace.net));
              const dimmed = hoveredNet !== null && hoveredNet !== trace.net;
              const midIdx = Math.floor(trace.path.length / 2);
              const midCell = trace.path[midIdx];
              const [mx, my] = midCell ? cellCenter(midCell[0], midCell[1]) : [0, 0];

              return (
                <g
                  key={`trace-${stepKey}-${trace.net}-${idx}`}
                  opacity={dimmed ? 0.28 : 1}
                  onMouseEnter={() => setHoveredNet(trace.net)}
                  onMouseLeave={() => setHoveredNet(null)}
                >
                  {/* Clearance halo */}
                  <path
                    d={d}
                    fill="none"
                    stroke={showPhoto ? "rgba(10, 14, 18, 0.8)" : "var(--panel)"}
                    strokeWidth="13"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Animated copper conductor */}
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    className="foundry-trace-path"
                  >
                    <title>{`Net ${trace.net} (${trace.path.length} cells)`}</title>
                  </path>
                  {/* Trace net label at midpoint */}
                  {trace.path.length >= 3 && (
                    <g transform={`translate(${mx}, ${my - 12})`}>
                      <rect
                        x="-24"
                        y="-8"
                        width="48"
                        height="15"
                        rx="4"
                        fill={showPhoto ? "rgba(22,24,26,0.88)" : "var(--panel)"}
                        stroke={color}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="2.5"
                        textAnchor="middle"
                        className="foundry-net-tag"
                        fill={showPhoto ? "#ffffff" : "var(--text)"}
                      >
                        {trace.net}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Solder Pads */}
          <g className="foundry-pads">
            {board.pads.map((pad: Pad) => {
              const [cx, cy] = cellCenter(pad.x, pad.y);
              const color = netColor(pad.net, uniqueNets.indexOf(pad.net));
              const dimmed = hoveredNet !== null && hoveredNet !== pad.net;

              return (
                <g
                  key={`pad-${pad.id}`}
                  transform={`translate(${cx}, ${cy})`}
                  opacity={dimmed ? 0.35 : 1}
                  onMouseEnter={() => setHoveredNet(pad.net)}
                  onMouseLeave={() => setHoveredNet(null)}
                  className="foundry-pad-group"
                >
                  <rect
                    x="-11"
                    y="-11"
                    width="22"
                    height="22"
                    rx="5"
                    fill={color}
                    stroke={showPhoto ? "#ffffff" : "var(--text)"}
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="4.5"
                    fill={showPhoto ? "#0f172a" : "var(--panel)"}
                    stroke={showPhoto ? "#ffffff" : "var(--text)"}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="21"
                    textAnchor="middle"
                    className="foundry-pad-label"
                    fill={showPhoto ? "#f8fafc" : "var(--text)"}
                  >
                    {pad.id}
                  </text>
                  <title>{`Pad ${pad.id} · Net ${pad.net} at (${pad.x}, ${pad.y})`}</title>
                </g>
              );
            })}
          </g>

          {/* Healed Defects (flipped Red -> Green!) */}
          <g className="foundry-healed-markers" aria-label="Healed defects">
            {resolvedDefects.map((defect) => {
              const [cx, cy] = cellCenter(defect.at[0], defect.at[1]);
              const k = violationKey(defect);
              return (
                <g
                  key={`healed-${k}`}
                  transform={`translate(${cx}, ${cy})`}
                  className="foundry-healed-callout"
                >
                  <circle
                    cx="0"
                    cy="0"
                    r="21"
                    fill="rgba(4, 120, 87, 0.16)"
                    stroke="var(--ok)"
                    strokeWidth="2.5"
                  />
                  <circle cx="0" cy="0" r="10" fill="var(--ok)" />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="700"
                  >
                    ✓
                  </text>
                  <g transform="translate(0, -28)">
                    <rect
                      x="-54"
                      y="-10"
                      width="108"
                      height="18"
                      rx="5"
                      fill="var(--ok)"
                    />
                    <text
                      x="0"
                      y="2.5"
                      textAnchor="middle"
                      fill="#ffffff"
                      className="foundry-callout-text"
                    >
                      {`HEALED ${defect.kind.toUpperCase()} (${defect.at[0]},${defect.at[1]})`}
                    </text>
                  </g>
                  <title>{`Healed ${defect.kind} at (${defect.at[0]}, ${defect.at[1]})`}</title>
                </g>
              );
            })}
          </g>

          {/* Active DRC Violations / Unhealed Defects (pulsing Red) */}
          <g className="foundry-violation-markers" aria-label="Active DRC violations">
            {activeViolations.map((v) => {
              const [cx, cy] = cellCenter(v.at[0], v.at[1]);
              const k = violationKey(v);
              const isFocused =
                activeDefect &&
                activeDefect.kind === v.kind &&
                activeDefect.at[0] === v.at[0] &&
                activeDefect.at[1] === v.at[1];

              return (
                <g
                  key={`violation-${k}`}
                  transform={`translate(${cx}, ${cy})`}
                  className={`foundry-violation-callout${isFocused ? " active" : ""}`}
                >
                  <circle
                    cx="0"
                    cy="0"
                    r={isFocused ? "24" : "20"}
                    fill="rgba(220, 38, 38, 0.18)"
                    stroke="var(--danger)"
                    strokeWidth="2.5"
                    className="foundry-pulse-ring"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="11"
                    fill="rgba(220, 38, 38, 0.28)"
                    stroke="var(--danger)"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                  />
                  <line
                    x1="-6"
                    y1="-6"
                    x2="6"
                    y2="6"
                    stroke="var(--danger)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="6"
                    y1="-6"
                    x2="-6"
                    y2="6"
                    stroke="var(--danger)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <g transform="translate(0, -27)">
                    <rect
                      x="-52"
                      y="-10"
                      width="104"
                      height="18"
                      rx="5"
                      fill="var(--danger)"
                    />
                    <text
                      x="0"
                      y="2.5"
                      textAnchor="middle"
                      fill="#ffffff"
                      className="foundry-callout-text"
                    >
                      {`${v.kind.toUpperCase()} @ (${v.at[0]},${v.at[1]})`}
                    </text>
                  </g>
                  <title>
                    {`DRC ${v.kind} violation at (${v.at[0]}, ${v.at[1]})${v.detail ? ` — ${v.detail}` : ""}`}
                  </title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend bar */}
      <div className="foundry-legend" aria-label="Net and DRC legend">
        <div className="hrow">
          <span className="mono micro dim">NETS:</span>
          {uniqueNets.map((net, i) => {
            const color = netColor(net, i);
            return (
              <button
                key={net}
                type="button"
                className={`foundry-net-pill${hoveredNet === net ? " active" : ""}`}
                onClick={() => setHoveredNet((prev) => (prev === net ? null : net))}
              >
                <span className="foundry-net-swatch" style={{ background: color }} />
                <span className="mono xs">{net}</span>
              </button>
            );
          })}
        </div>
        <div className="hrow">
          <span className="foundry-status-dot danger" />
          <span className="mono xs bad">
            {activeViolations.length} active violation{activeViolations.length === 1 ? "" : "s"}
          </span>
          {resolvedDefects.length > 0 && (
            <>
              <span className="foundry-status-dot ok" />
              <span className="mono xs good">
                {resolvedDefects.length} healed (red → green)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
