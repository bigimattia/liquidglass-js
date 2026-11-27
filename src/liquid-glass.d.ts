export type LiquidGlassMode = "auto" | "viewport" | "backdrop" | "frost" | "off";
export type LiquidGlassRenderer = "viewport" | "backdrop" | "frost" | "off";

export interface LiquidGlassOptions {
  /** Auto (default) tries native backdrop, viewport SVG, then frost. */
  mode?: LiquidGlassMode;
  /** Viewport SVG source in auto or viewport mode. A selector resolves in the lens’s document or shadow root. */
  viewportSource?: string | HTMLElement | null;
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
  /** Recheck the renderer and source geometry after changing their relative position. */
  refresh(): void;
  destroy(): void;
}

export function liquidGlass(element: HTMLElement, options?: LiquidGlassOptions): LiquidGlassController;
