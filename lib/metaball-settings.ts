export type MetaBallSettings = {
  color: string;
  cursorBallColor: string;
  speed: number;
  animationSize: number;
  ballCount: number;
  clumpFactor: number;
  enableMouseInteraction: boolean;
  hoverSmoothness: number;
  cursorBallSize: number;
  enableTransparency: boolean;
  lightVariable: number;
  lightIntensity: number;
  strokeWidth: number;
  opacity: number;
  frost: number;
  depth: number;
};

export type MetaBallSettingKey = keyof MetaBallSettings;
