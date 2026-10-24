declare module "react-compare-slider" {
  import type { ComponentType, ReactNode } from "react";

  export interface ReactCompareSliderProps {
    itemOne: ReactNode;
    itemTwo: ReactNode;
    position?: number;
    onPositionChange?: (position: number) => void;
    style?: React.CSSProperties;
    className?: string;
  }

  export const ReactCompareSlider: ComponentType<ReactCompareSliderProps>;
  export const ReactCompareSliderImage: ComponentType<{
    src: string;
    alt?: string;
    style?: React.CSSProperties;
  }>;
  export const styleFitContainer: React.CSSProperties;
}
