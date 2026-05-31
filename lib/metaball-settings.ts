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
  refraction: number;
  frost: number;
};

export type MetaBallSettingKey = keyof MetaBallSettings;
