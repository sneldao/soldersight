import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DefectOverlay } from "./DefectOverlay";
import { DEFECT_COLORS } from "../colors";
import type { Annotation } from "../types";

const annotations: Annotation[] = [
  { x1: 10, y1: 20, x2: 30, y2: 60, code: 3, type: "mousebite" },
  { x1: 100, y1: 100, x2: 90, y2: 80, code: 6, type: "pinhole" },
];

describe("DefectOverlay", () => {
  it("draws one rect per annotation with its type colour", () => {
    const { container } = render(<DefectOverlay annotations={annotations} width={640} height={640} />);
    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(2);
    expect(rects[0].getAttribute("stroke")).toBe(DEFECT_COLORS.mousebite);
    expect(rects[1].getAttribute("stroke")).toBe(DEFECT_COLORS.pinhole);
  });

  it("normalises reversed corners to a positive width and height", () => {
    const { container } = render(<DefectOverlay annotations={annotations} width={640} height={640} />);
    const rect = container.querySelectorAll("rect")[1];
    expect(rect.getAttribute("x")).toBe("90");
    expect(rect.getAttribute("y")).toBe("80");
    expect(rect.getAttribute("width")).toBe("10");
    expect(rect.getAttribute("height")).toBe("20");
  });
});
