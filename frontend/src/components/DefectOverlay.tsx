import { motion } from "motion/react";
import type { Annotation } from "../types";
import { DEFECT_COLORS } from "../colors";

// Animated boxes drawn over a board image. Coordinates are in the image's pixel space.
export function DefectOverlay({
  annotations,
  width,
  height,
}: {
  annotations: Annotation[];
  width: number;
  height: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      aria-label="Defect annotations"
    >
      {annotations.map((a, i) => {
        const color = DEFECT_COLORS[a.type];
        return (
          <motion.rect
            key={`${a.x1}-${a.y1}-${i}`}
            x={Math.min(a.x1, a.x2)}
            y={Math.min(a.y1, a.y2)}
            width={Math.abs(a.x2 - a.x1)}
            height={Math.abs(a.y2 - a.y1)}
            fill={`${color}33`}
            stroke={color}
            strokeWidth={3}
            initial={{ opacity: 0, scale: 1.25 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
            style={{ transformOrigin: "center", transformBox: "fill-box" }}
          >
            <title>{a.type}</title>
          </motion.rect>
        );
      })}
    </svg>
  );
}
