import type { MetaBallSettings } from "@/lib/metaball-settings";

/** Tuned for Apple liquid-glass metaballs over the provided background. */
export const DEFAULT_SETTINGS: MetaBallSettings = {
  color: "#ffffff",
  cursorBallColor: "#ffffff",
  speed: 0.3,
  animationSize: 30,
  ballCount: 15,
  clumpFactor: 1,
  enableMouseInteraction: true,
  hoverSmoothness: 0.05,
  cursorBallSize: 3,
  enableTransparency: true,
  refraction: 0.5,
  frost: 0.55,
};
