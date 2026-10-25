import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import type { Board } from "../types";
import { DefectOverlay } from "./DefectOverlay";

// DeepPCB images are 640x640 in the dataset.
const SIZE = 640;

export function BoardView({ board, showDefects }: { board: Board; showDefects: boolean }) {
  const test = (
    <div className="board-frame">
      <img src={board.testUrl} alt={`Test image for board ${board.id}`} className="board-img" />
      {showDefects && <DefectOverlay annotations={board.annotations} width={SIZE} height={SIZE} />}
    </div>
  );
  const template = <ReactCompareSliderImage src={board.templateUrl} alt={`Template for board ${board.id}`} />;

  return (
    <div className="board-slider">
      <ReactCompareSlider itemOne={template} itemTwo={test} />
    </div>
  );
}
