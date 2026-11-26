const defaults = Object.freeze({
  mode: "auto",
  backdrop: null,
  radius: 24,
  blur: 2,
  refraction: 18,
  bevel: 24,
  curvature: 2,
  chroma: 0,
  saturation: 1.35,
  tint: 0.14,
  glow: 0.23,
  edgeHighlight: 0.85,
  lightAngle: 145,
  interactive: true,
});

const ranges = {
  radius: [0, Infinity],
  blur: [0, Infinity],
  refraction: [0, Infinity],
  bevel: [0.5, Infinity],
  curvature: [0.25, 8],
  chroma: [0, 1],
  saturation: [0, Infinity],
  tint: [0, 1],
  glow: [0, 1],
  edgeHighlight: [0, 1],
  lightAngle: [-Infinity, Infinity],
};

export function resolveOptions(view, changes, current = defaults) {
  const options = { ...current };
  for (const key of Object.keys(defaults)) {
    if (changes[key] !== undefined) options[key] = changes[key];
  }
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = options[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError("Invalid liquidGlass option: " + key);
    }
  }
  if (!["auto", "content", "backdrop", "sampled", "frost"].includes(options.mode)) {
    throw new TypeError('mode must be "auto", "content", "backdrop", "sampled", or "frost"');
  }
  if (typeof options.interactive !== "boolean") {
    throw new TypeError("interactive must be a boolean");
  }
  const source = options.backdrop;
  if (source !== null &&
    (!(source instanceof view.HTMLImageElement || source instanceof view.HTMLCanvasElement ||
      source instanceof view.HTMLVideoElement) ||
      source.ownerDocument !== view.document)) {
    throw new TypeError("backdrop must be an image, canvas, or video from the same document, or null");
  }
  return options;
}
