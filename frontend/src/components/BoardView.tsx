import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import type { Board } from "../types";
import { DefectOverlay } from "./DefectOverlay";

// DeepPCB images are 640x640 in the dataset.
const SIZE = 640;

export function BoardView({ board, showDefects }: { board: Board; showDefects: boolean }) {
  const test = (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
      <img src={board.testUrl} alt={`Test image for board ${board.id}`} style={{ width: "100%", display: "block" }} />
      {showDefects && <DefectOverlay annotations={board.annotations} width={SIZE} height={SIZE} />}
    </div>
  );
  const template = <ReactCompareSliderImage src={board.templateUrl} alt={`Template for board ${board.id}`} />;

  return (
    <ReactCompareSlider
      itemOne={template}
      itemTwo={test}
      style={{ borderRadius: "var(--radius)", overflow: "hidden", width: "100%" }}
    />
  );
}
