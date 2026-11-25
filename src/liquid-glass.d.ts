export type LiquidGlassMode = "auto" | "content" | "backdrop" | "sampled" | "scene" | "frost";
export type LiquidGlassRenderer = "content" | "backdrop" | "sampled" | "scene" | "frost";

export interface LiquidGlassOptions {
  /** Auto prefers live refraction, then a supplied or discovered media backdrop, then frost. */
  mode?: LiquidGlassMode;
  /** Optional image, canvas, or video displayed behind a lens in auto, sampled, or backdrop mode. */
  backdrop?: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null;
  /** Scene element or key of a marked ancestor. Omit for the nearest marked ancestor. */
  scene?: HTMLElement | string | null;
  /** Uniform corner radius in CSS pixels. Defaults to 24. */
  radius?: number;
  /** Blur in CSS pixels. Defaults to 2. */
  blur?: number;
  /** Maximum edge displacement in CSS pixels. Defaults to 18. */
  refraction?: number;
  /** Width of the refractive edge in CSS pixels. Defaults to 24. */
  bevel?: number;
  /** Falloff exponent from 0.25 to 8. Defaults to 2. */
  curvature?: number;
  /** Chromatic spread from 0 to 1. Defaults to 0. */
  chroma?: number;
  /** Saturation multiplier. Defaults to 1.35. */
  saturation?: number;
  /** Tint opacity from 0 to 1. Defaults to 0.14. */
  tint?: number;
  /** Interior highlight opacity from 0 to 1. Defaults to 0.23. */
  glow?: number;
  /** Rim highlight intensity from 0 to 1. Defaults to 0.85. */
  edgeHighlight?: number;
  /** Rim gradient angle in degrees. Defaults to 145. */
  lightAngle?: number;
  /** Enable pointer-tracking highlights. Defaults to true. */
  interactive?: boolean;
}

export interface LiquidGlassController {
  /** The active renderer after the last scheduled paint. */
  readonly renderer: LiquidGlassRenderer;
  /** Merge changes, or reset omitted options to their defaults with replace. */
  update(options: LiquidGlassOptions, behavior?: { replace?: boolean }): void;
  /** Rediscover and resample the backdrop after moving the lens or drawing canvas content. */
  refresh(): void;
  destroy(): void;
}

export function liquidGlass(element: HTMLElement, options?: LiquidGlassOptions): LiquidGlassController;
